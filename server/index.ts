import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { spawn, ChildProcess } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import type { AgentEvent, AgentState, FileSystemNode, ServerMessage, ClientMessage } from './types.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const agents = new Map<string, AgentState>();
const clients = new Set<WebSocket>();
const spawnedProcesses = new Map<string, ChildProcess>();
const seenToolUseIds = new Map<string, Set<string>>();

const AGENT_COLORS = {
  main: '#00FFFF',
  subagent: '#FF6600',
};

function isDeleteCommand(command: string): { isDelete: boolean; paths: string[] } {
  const deletePatterns = [
    /\brm\s+(?:-[rf]+\s+)?(.+)/,
    /\brmdir\s+(.+)/,
    /\bunlink\s+(.+)/,
  ];

  for (const pattern of deletePatterns) {
    const match = command.match(pattern);
    if (match) {
      const pathsStr = match[1].trim();
      const paths = pathsStr.split(/\s+/).filter(p => !p.startsWith('-'));
      return { isDelete: true, paths };
    }
  }
  return { isDelete: false, paths: [] };
}

function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendToClient(client: WebSocket, message: ServerMessage) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

async function scanDirectory(dirPath: string, depth = 2): Promise<FileSystemNode | null> {
  try {
    const stats = await stat(dirPath);
    const name = basename(dirPath);

    if (!stats.isDirectory()) {
      return {
        name,
        path: dirPath,
        type: 'file',
        size: stats.size,
        extension: extname(name).slice(1) || undefined,
      };
    }

    const node: FileSystemNode = {
      name,
      path: dirPath,
      type: 'directory',
      children: [],
    };

    if (depth > 0) {
      const entries = await readdir(dirPath);
      const filteredEntries = entries.filter(
        (e) => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist' && e !== 'build'
      );

      const children = await Promise.all(
        filteredEntries.map((entry) => scanDirectory(join(dirPath, entry), depth - 1))
      );

      node.children = children.filter((c): c is FileSystemNode => c !== null);
    }

    return node;
  } catch {
    return null;
  }
}

app.post('/api/events', (req, res) => {
  const event = req.body as AgentEvent;

  console.log('📡 Received event:', JSON.stringify(event, null, 2));

  if (!event.sessionId || !event.hookEvent) {
    console.log('❌ Invalid event - missing sessionId or hookEvent');
    res.status(400).json({ error: 'Invalid event payload' });
    return;
  }

  // Ignore hook events from paths that match spawned agent working directories
  // Hook events have sessionId as a path (starts with /), spawned agents have grid-* IDs
  if (event.sessionId.startsWith('/')) {
    for (const [key, agent] of agents.entries()) {
      if (key.startsWith('grid-') && agent.currentPath?.startsWith(event.sessionId)) {
        console.log('⏭️ Ignoring hook event - overlaps with spawned agent:', key);
        res.json({ success: true, ignored: true });
        return;
      }
    }
  }

  event.timestamp = event.timestamp || new Date().toISOString();
  event.agentType = event.agentType || 'main';

  const agentKey = `${event.sessionId}-${event.agentType}`;

  if (event.hookEvent === 'SessionStart' || event.hookEvent === 'SubagentStart') {
    agents.set(agentKey, {
      sessionId: event.sessionId,
      agentType: event.agentType,
      currentPath: event.filePath,
      lastActivity: event.timestamp,
      color: AGENT_COLORS[event.agentType],
      status: 'running',
    });
  } else if (event.hookEvent === 'SessionEnd' || event.hookEvent === 'SubagentStop') {
    const agent = agents.get(agentKey);
    if (agent) {
      agent.status = 'completed';
      agent.lastActivity = event.timestamp;
    }
  } else {
    const agent = agents.get(agentKey);
    if (agent) {
      agent.currentPath = event.filePath || agent.currentPath;
      agent.lastActivity = event.timestamp;
    } else {
      agents.set(agentKey, {
        sessionId: event.sessionId,
        agentType: event.agentType,
        currentPath: event.filePath,
        lastActivity: event.timestamp,
        color: AGENT_COLORS[event.agentType],
        status: 'running',
      });
    }
  }

  broadcast({ type: 'event', payload: event });
  broadcast({ type: 'agents', payload: Array.from(agents.values()) });

  res.json({ success: true, agentCount: agents.size });
});

app.get('/api/filesystem/:encodedPath(*)', async (req, res) => {
  const path = decodeURIComponent(req.params.encodedPath);
  const depth = parseInt(req.query.depth as string) || 2;

  const node = await scanDirectory(path, depth);
  if (node) {
    res.json(node);
  } else {
    res.status(404).json({ error: 'Path not found' });
  }
});

app.get('/api/agents', (_req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agents: agents.size, clients: clients.size });
});

app.post('/api/agents/spawn', (req, res) => {
  const { workingDirectory, prompt, dangerousMode } = req.body as { workingDirectory: string; prompt: string; dangerousMode?: boolean };

  if (!workingDirectory || !prompt) {
    res.status(400).json({ error: 'workingDirectory and prompt are required' });
    return;
  }

  const sessionId = `grid-${randomUUID().slice(0, 8)}`;

  try {
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (dangerousMode) {
      args.push('--dangerously-skip-permissions');
    }

    console.log(`[${sessionId}] Spawning: claude ${args.join(' ')}${dangerousMode ? ' (DANGEROUS MODE)' : ' (SAFE MODE - writes will fail)'}`);

    const claudeProcess = spawn('claude', args, {
      cwd: workingDirectory,
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    seenToolUseIds.set(sessionId, new Set());

    spawnedProcesses.set(sessionId, claudeProcess);

    agents.set(`${sessionId}-main`, {
      sessionId,
      agentType: 'main',
      currentPath: workingDirectory,
      lastActivity: new Date().toISOString(),
      color: AGENT_COLORS.main,
      status: 'running',
    });

    broadcast({ type: 'agents', payload: Array.from(agents.values()) });

    claudeProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[${sessionId}] stdout:`, output.slice(0, 500));

      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          console.log(`[${sessionId}] Parsed JSON type:`, parsed.type);

          // Handle assistant messages
          if (parsed.type === 'assistant' && parsed.message?.content) {
            const seenIds = seenToolUseIds.get(sessionId) || new Set();

            for (const block of parsed.message.content) {
              if (block.type === 'tool_use') {
                // Deduplicate by tool_use id
                if (block.id && seenIds.has(block.id)) {
                  continue;
                }
                if (block.id) {
                  seenIds.add(block.id);
                }

                let toolName = block.name || 'Unknown';
                let filePath = block.input?.file_path || block.input?.path || workingDirectory;

                // Check if Bash command is a delete operation
                if (toolName === 'Bash' && block.input?.command) {
                  const deleteCheck = isDeleteCommand(block.input.command);
                  if (deleteCheck.isDelete) {
                    toolName = 'Delete';
                    filePath = deleteCheck.paths[0] || filePath;
                  }
                }

                const event: AgentEvent = {
                  timestamp: new Date().toISOString(),
                  sessionId,
                  hookEvent: 'PostToolUse',
                  toolName,
                  filePath,
                  agentType: 'main',
                };
                console.log(`[${sessionId}] Broadcasting tool event:`, event.toolName, block.id);
                broadcast({ type: 'event', payload: event });

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
              } else if (block.type === 'text' && block.text) {
                // Deduplicate text messages by content hash
                const textHash = `text:${block.text.slice(0, 100)}`;
                if (seenIds.has(textHash)) {
                  continue;
                }
                seenIds.add(textHash);

                const event: AgentEvent = {
                  timestamp: new Date().toISOString(),
                  sessionId,
                  hookEvent: 'AssistantMessage',
                  agentType: 'main',
                  message: block.text,
                };
                broadcast({ type: 'event', payload: event });
              }
            }
          }

          // Handle final result
          if (parsed.type === 'result') {
            const seenIds = seenToolUseIds.get(sessionId) || new Set();
            const resultKey = `result:${parsed.result?.slice(0, 50)}`;
            if (!seenIds.has(resultKey)) {
              seenIds.add(resultKey);
              const event: AgentEvent = {
                timestamp: new Date().toISOString(),
                sessionId,
                hookEvent: 'Result',
                agentType: 'main',
                message: parsed.result,
                details: {
                  success: !parsed.is_error,
                  duration_ms: parsed.duration_ms,
                  num_turns: parsed.num_turns,
                  cost_usd: parsed.total_cost_usd,
                },
              };
              broadcast({ type: 'event', payload: event });
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    claudeProcess.stderr?.on('data', (data) => {
      console.log(`[${sessionId}] stderr:`, data.toString().slice(0, 500));
    });

    claudeProcess.on('close', (code, signal) => {
      spawnedProcesses.delete(sessionId);
      seenToolUseIds.delete(sessionId);
      const agent = agents.get(`${sessionId}-main`);
      if (agent) {
        agent.status = code === 0 ? 'completed' : 'error';
        agent.lastActivity = new Date().toISOString();
      }
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
      console.log(`[${sessionId}] Agent finished with code ${code}, signal ${signal}`);
    });

    claudeProcess.on('error', (err) => {
      console.error(`[${sessionId}] Spawn error:`, err);
      spawnedProcesses.delete(sessionId);
      const agent = agents.get(`${sessionId}-main`);
      if (agent) {
        agent.status = 'error';
        agent.lastActivity = new Date().toISOString();
      }
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
    });

    claudeProcess.on('spawn', () => {
      console.log(`[${sessionId}] Process spawned successfully, pid: ${claudeProcess.pid}`);
    });

    res.json({ success: true, sessionId });
    console.log(`Spawned agent ${sessionId} in ${workingDirectory}`);

  } catch (err) {
    res.status(500).json({ error: 'Failed to spawn agent', details: String(err) });
  }
});

app.delete('/api/agents/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const proc = spawnedProcesses.get(sessionId);

  if (proc) {
    proc.kill('SIGTERM');
    spawnedProcesses.delete(sessionId);
    agents.delete(`${sessionId}-main`);
    broadcast({ type: 'agents', payload: Array.from(agents.values()) });
    res.json({ success: true });
  } else {
    // For external agents, just remove from the agents map
    const agentKey = `${sessionId}-main`;
    const subagentKey = `${sessionId}-subagent`;
    if (agents.has(agentKey) || agents.has(subagentKey)) {
      agents.delete(agentKey);
      agents.delete(subagentKey);
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  }
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total clients: ${clients.size}`);

  sendToClient(ws, { type: 'agents', payload: Array.from(agents.values()) });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      if (message.type === 'getFilesystem' && message.path) {
        const node = await scanDirectory(message.path);
        if (node) {
          sendToClient(ws, { type: 'filesystem', payload: node });
        }
      } else if (message.type === 'ping') {
        sendToClient(ws, { type: 'agents', payload: Array.from(agents.values()) });
      }
    } catch {
      sendToClient(ws, { type: 'error', payload: { message: 'Invalid message format' } });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total clients: ${clients.size}`);
  });
});

server.listen(PORT, () => {
  console.log(`🔷 The Grid Bridge Server running on port ${PORT}`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});
