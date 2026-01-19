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

const AGENT_COLORS = {
  main: '#00FFFF',
  subagent: '#FF6600',
};

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

  if (!event.sessionId || !event.hookEvent) {
    res.status(400).json({ error: 'Invalid event payload' });
    return;
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
    });
  } else if (event.hookEvent === 'SessionEnd' || event.hookEvent === 'SubagentStop') {
    agents.delete(agentKey);
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
  const { workingDirectory, prompt } = req.body as { workingDirectory: string; prompt: string };

  if (!workingDirectory || !prompt) {
    res.status(400).json({ error: 'workingDirectory and prompt are required' });
    return;
  }

  const sessionId = `grid-${randomUUID().slice(0, 8)}`;

  try {
    const claudeProcess = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
      cwd: workingDirectory,
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      shell: true,
    });

    spawnedProcesses.set(sessionId, claudeProcess);

    agents.set(`${sessionId}-main`, {
      sessionId,
      agentType: 'main',
      currentPath: workingDirectory,
      lastActivity: new Date().toISOString(),
      color: AGENT_COLORS.main,
    });

    broadcast({ type: 'agents', payload: Array.from(agents.values()) });

    claudeProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'tool_use' && parsed.tool) {
            const filePath = parsed.tool.input?.file_path || parsed.tool.input?.path || workingDirectory;
            const event: AgentEvent = {
              timestamp: new Date().toISOString(),
              sessionId,
              hookEvent: 'PostToolUse',
              toolName: parsed.tool.name || 'Unknown',
              filePath,
              agentType: 'main',
            };
            broadcast({ type: 'event', payload: event });

            const agent = agents.get(`${sessionId}-main`);
            if (agent) {
              agent.currentPath = filePath;
              agent.lastActivity = event.timestamp;
            }
            broadcast({ type: 'agents', payload: Array.from(agents.values()) });
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    claudeProcess.on('close', () => {
      spawnedProcesses.delete(sessionId);
      agents.delete(`${sessionId}-main`);
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
      console.log(`Agent ${sessionId} finished`);
    });

    claudeProcess.on('error', (err) => {
      console.error(`Agent ${sessionId} error:`, err);
      spawnedProcesses.delete(sessionId);
      agents.delete(`${sessionId}-main`);
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
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
    res.status(404).json({ error: 'Agent not found' });
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
