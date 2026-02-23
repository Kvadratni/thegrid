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
import { spawn, execSync, type ChildProcess } from 'node:child_process';
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

    // Wrap the command in stdbuf to disable stdout/stderr buffering.
    // This is critical for NDJSON streams over stdio because Node.js 
    // will otherwise block until the buffer fills up, causing massive delays 
    // in the ACP SDK initialization handshake.
    let finalCommand = acpCommand;
    let finalArgs = acpArgs;

    // Check if stdbuf is available for buffering fix
    try {
        // Try to find stdbuf or gstdbuf (Homebrew coreutils on Mac)
        let stdbufExe = 'stdbuf';
        try {
            execSync('command -v stdbuf');
        } catch {
            stdbufExe = 'gstdbuf';
            execSync('command -v gstdbuf');
        }

        finalCommand = stdbufExe;
        finalArgs = ['-o0', '-e0', acpCommand, ...acpArgs];
    } catch (e) {
        // Fallback to original command if wrapper fails
        console.warn(`[${sessionId}] Warning: stdbuf/gstdbuf not found. ACP messages may be delayed.`);
    }

    console.log(`[${sessionId}] Spawning ACP agent via: ${finalCommand} ${finalArgs.join(' ')}`);

    // Spawn the ACP bridge binary
    const child = spawn(finalCommand, finalArgs, {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'dumb', PYTHONUNBUFFERED: '1', FORCE_COLOR: '0' },
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

                // Parse bash commands to detect file creation/deletion
                const anyUpdate = update as any;
                const toolArgs = anyUpdate.arguments || anyUpdate.input;
                if (toolName === 'Bash' && toolArgs && typeof toolArgs === 'object') {
                    const command = toolArgs.command || toolArgs.script;
                    if (typeof command === 'string') {
                        // Check for deletions
                        const deletePatterns = [
                            /\brm\s+(?:-[rfiv]+\s+)?([^\s;&|]+)/,
                            /\brmdir\s+([^\s;&|]+)/,
                            /\bunlink\s+([^\s;&|]+)/,
                        ];
                        for (const pattern of deletePatterns) {
                            const match = command.match(pattern);
                            if (match) {
                                toolName = 'Delete';
                                filePath = match[1].trim();
                                break;
                            }
                        }

                        // Check for writes/edits (e.g. echo "foo" > file.txt)
                        if (toolName === 'Bash') {
                            const writePattern = />\s*([^\s;&|]+)/;
                            const writeMatch = command.match(writePattern);
                            if (writeMatch) {
                                toolName = 'Write';
                                filePath = writeMatch[1].trim();
                            } else if (/\b(ls|dir|tree)\b/.test(command)) {
                                toolName = 'Glob';
                            } else if (/\b(find|grep|ag|rg|fd)\b/.test(command)) {
                                toolName = 'Grep';
                            }
                        }
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
