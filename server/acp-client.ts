import {
    ClientSideConnection,
    ndJsonStream,
    PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk';
import type {
    Client,
    SessionNotification,
    RequestPermissionRequest,
    RequestPermissionResponse,
} from '@agentclientprotocol/sdk';
import { spawn, type ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { normalizeToolName } from './providers.js';
import type { AgentEvent, AgentProvider, AgentState, ServerMessage } from './types.js';

// ─── Tool Kind → Grid Tool Name Mapping ───────────────────────────────────────

const ACP_TOOL_KIND_MAP: Record<string, string> = {
    read: 'Read',
    edit: 'Edit',
    delete: 'Delete',
    move: 'Edit',
    search: 'Grep',
    execute: 'Bash',
    think: 'Unknown',
    fetch: 'WebFetch',
    switch_mode: 'Unknown',
    other: 'Unknown',
};

// ─── ACP Client Options ────────────────────────────────────────────────────────

export interface AcpSpawnOptions {
    acpCommand: string;
    acpArgs: string[];
    sessionId: string;
    workingDirectory: string;
    prompt: string;
    provider: AgentProvider;
    providerColor: string;
    /** Called to broadcast a message to all WebSocket clients */
    broadcast: (msg: ServerMessage) => void;
    /** The live agents map */
    agents: Map<string, AgentState>;
    /** The spawned processes map for lifecycle tracking */
    spawnedProcesses: Map<string, ChildProcess>;
}

export interface AcpHandle {
    cancel: () => void;
    process: ChildProcess;
}

// ─── Spawn ACP Agent ───────────────────────────────────────────────────────────

export async function spawnAcpAgent(opts: AcpSpawnOptions): Promise<AcpHandle> {
    const {
        acpCommand, acpArgs, sessionId, workingDirectory, prompt,
        provider, providerColor, broadcast, agents, spawnedProcesses,
    } = opts;

    console.log(`[${sessionId}] Spawning ACP agent: ${acpCommand} ${acpArgs.join(' ')}`);

    // Spawn the ACP bridge binary
    const child = spawn(acpCommand, acpArgs, {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'dumb' },
    });

    spawnedProcesses.set(sessionId, child);

    // Pipe stderr to console
    child.stderr?.on('data', (data: Buffer) => {
        console.error(`[${sessionId}] ACP stderr:`, data.toString().trim());
    });

    // Create ACP NDJSON stream over stdin/stdout
    const writeToAgent = Writable.toWeb(child.stdin!) as WritableStream;
    const readFromAgent = Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>;
    const stream = ndJsonStream(writeToAgent, readFromAgent);

    // Track seen tool call IDs for deduplication
    const seenToolCalls = new Set<string>();

    // ACP Client implementation — receives sessionUpdate notifications
    class GridAcpClient implements Client {
        async requestPermission(_params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
            // Auto-allow all tool calls (The Grid is a visualizer, not a gatekeeper)
            return { result: 'allow' } as any;
        }

        async sessionUpdate(params: SessionNotification): Promise<void> {
            const update = params.update;

            if (update.sessionUpdate === 'tool_call') {
                const toolCallId = update.toolCallId;
                if (seenToolCalls.has(toolCallId)) return;
                seenToolCalls.add(toolCallId);
                // Auto-expire after 2s to handle repeat events
                setTimeout(() => seenToolCalls.delete(toolCallId), 2000);

                // Map ACP ToolKind to Grid tool name
                let toolName = 'Unknown';
                if (update.kind) {
                    toolName = ACP_TOOL_KIND_MAP[update.kind] || normalizeToolName(update.kind);
                } else if (update.title) {
                    // Try to extract tool name from the title
                    toolName = normalizeToolName(update.title);
                }

                // Extract file path from locations
                let filePath = workingDirectory;
                if (update.locations && update.locations.length > 0) {
                    const loc = update.locations[0];
                    if ('uri' in loc && typeof loc.uri === 'string') {
                        filePath = loc.uri.replace('file://', '');
                    } else if ('path' in loc && typeof (loc as any).path === 'string') {
                        filePath = (loc as any).path;
                    }
                }

                const event: AgentEvent = {
                    timestamp: new Date().toISOString(),
                    sessionId,
                    hookEvent: 'PreToolUse',
                    toolName: toolName as any,
                    filePath,
                    agentType: 'main',
                    provider,
                };

                console.log(`[${sessionId}] ACP tool_call:`, toolName, filePath);
                broadcast({ type: 'event', payload: event });

                // Update agent state
                const agent = agents.get(`${sessionId}-main`);
                if (agent) {
                    agent.currentPath = filePath;
                    agent.lastActivity = event.timestamp;
                }
                broadcast({ type: 'agents', payload: Array.from(agents.values()) });

                // Trigger filesystem refresh for file-modifying operations
                if (['Write', 'Edit', 'Delete', 'NotebookEdit'].includes(toolName)) {
                    setTimeout(() => {
                        broadcast({ type: 'filesystemChange', payload: { action: toolName.toLowerCase(), path: filePath } });
                    }, 500);
                }
            } else if (update.sessionUpdate === 'agent_message_chunk') {
                // Text streaming — broadcast as an assistant message event
                const content = update.content;
                if (content && 'text' in content && content.text) {
                    const event: AgentEvent = {
                        timestamp: new Date().toISOString(),
                        sessionId,
                        hookEvent: 'AssistantMessage',
                        agentType: 'main',
                        message: content.text,
                        provider,
                    };
                    broadcast({ type: 'event', payload: event });
                }
            }
            // Other sessionUpdate types (plan, tool_call_update, etc.) are silently ignored
        }
    }

    // Create the client-side connection
    const connection = new ClientSideConnection(() => new GridAcpClient(), stream);

    // Run the ACP lifecycle
    (async () => {
        try {
            // 1) Initialize
            console.log(`[${sessionId}] ACP initializing...`);
            const initResp = await connection.initialize({
                protocolVersion: PROTOCOL_VERSION,
                clientCapabilities: {},
                clientInfo: { name: 'thegrid', version: '1.0.0' },
            });
            console.log(`[${sessionId}] ACP initialized:`, initResp.protocolVersion);

            // 2) Create session
            const sessionResp = await connection.newSession({
                cwd: workingDirectory,
                mcpServers: [],
            });
            const acpSessionId = sessionResp.sessionId;
            console.log(`[${sessionId}] ACP session created:`, acpSessionId);

            // 3) Send prompt
            console.log(`[${sessionId}] ACP sending prompt...`);
            const promptResp = await connection.prompt({
                sessionId: acpSessionId,
                prompt: [{ type: 'text', text: prompt }],
            });
            console.log(`[${sessionId}] ACP prompt completed:`, promptResp.stopReason);

            // Broadcast result event
            const resultEvent: AgentEvent = {
                timestamp: new Date().toISOString(),
                sessionId,
                hookEvent: 'Result',
                agentType: 'main',
                message: `Completed (${promptResp.stopReason})`,
                provider,
            };
            broadcast({ type: 'event', payload: resultEvent });

        } catch (err) {
            console.error(`[${sessionId}] ACP error:`, err);
            const errorEvent: AgentEvent = {
                timestamp: new Date().toISOString(),
                sessionId,
                hookEvent: 'Result',
                agentType: 'main',
                message: `Error: ${err}`,
                provider,
            };
            broadcast({ type: 'event', payload: errorEvent });
        } finally {
            // Mark agent as completed
            const agent = agents.get(`${sessionId}-main`);
            if (agent) {
                agent.status = 'completed';
                agent.lastActivity = new Date().toISOString();
            }
            broadcast({ type: 'agents', payload: Array.from(agents.values()) });
            spawnedProcesses.delete(sessionId);
        }
    })();

    // Handle process lifecycle
    child.on('error', (err) => {
        console.error(`[${sessionId}] ACP process error:`, err);
        spawnedProcesses.delete(sessionId);
    });

    child.on('close', (code) => {
        console.log(`[${sessionId}] ACP process exited with code ${code}`);
    });

    return {
        cancel: () => {
            child.kill('SIGTERM');
        },
        process: child,
    };
}
