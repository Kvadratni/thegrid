import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { spawn, ChildProcess, exec } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { watch, FSWatcher } from 'fs';
import type { AgentEvent, AgentState, FileSystemNode, ServerMessage, ClientMessage, ProcessInfo, AgentProvider, ToolName } from './types.js';
import { PROVIDER_CONFIGS, PROVIDER_COLORS, PROVIDER_NAMES, PROVIDER_COMMANDS, ALL_PROVIDERS, SPAWNABLE_PROVIDERS, normalizeToolName } from './providers.js';
import { spawnAcpAgent } from './acp-client.js';
import * as git from './git.js';

const execAsync = promisify(exec);

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

function getAgentColor(provider?: AgentProvider, agentType: 'main' | 'subagent' = 'main'): string {
  if (provider && PROVIDER_COLORS[provider]) {
    return PROVIDER_COLORS[provider];
  }
  return AGENT_COLORS[agentType];
}

let watchedDirectory = '';
let cachedProcesses: ProcessInfo[] = [];
let fsWatcher: FSWatcher | null = null;
let currentWatchPath = '';
let unbridgedAgents = new Set<string>();
let observerModeEnabled = false;

// ─── Observer Mode: Heuristic Scoring ──────────────────────────────────────────
// When multiple unbridged agents are active, score each to determine who made a file change.

async function scoreAndPickAgent(candidates: AgentState[], filePath: string): Promise<AgentState | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const scores = new Map<string, number>();
  for (const a of candidates) scores.set(a.sessionId, 0);

  // 1. lsof check: does the agent currently have the file open? (+3)
  try {
    const pids = candidates
      .map(a => { const m = a.sessionId.match(/unbridged-\w+-(\d+)/); return m ? m[1] : null; })
      .filter(Boolean) as string[];

    if (pids.length > 0) {
      const pidArg = pids.map(p => `-p ${p}`).join(' ');
      const { stdout } = await execAsync(`lsof ${pidArg} 2>/dev/null | grep "${filePath.replace(/"/g, '\\"')}" || true`, { timeout: 1000 });
      if (stdout.trim()) {
        // Find which PID(s) matched
        for (const line of stdout.trim().split('\n')) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          if (pid) {
            const matchingAgent = candidates.find(a => a.sessionId.includes(`-${pid}`));
            if (matchingAgent) {
              scores.set(matchingAgent.sessionId, (scores.get(matchingAgent.sessionId) || 0) + 3);
            }
          }
        }
      }
    }
  } catch { /* lsof failed, skip this signal */ }

  // 2. CWD proximity: how many path segments does the agent's CWD share with the file? (+2 for closest)
  let maxDepth = 0;
  const cwdDepths = new Map<string, number>();
  for (const a of candidates) {
    const agentCwd = a.currentPath || a.workingDirectory || '';
    if (agentCwd && filePath.startsWith(agentCwd)) {
      const depth = agentCwd.split('/').filter(Boolean).length;
      cwdDepths.set(a.sessionId, depth);
      if (depth > maxDepth) maxDepth = depth;
    }
  }
  for (const [sid, depth] of cwdDepths) {
    if (depth === maxDepth) {
      scores.set(sid, (scores.get(sid) || 0) + 2);
    }
  }

  // 3. Recency: most recently active agent gets +1
  let mostRecent: AgentState | null = null;
  let mostRecentTime = 0;
  for (const a of candidates) {
    const t = new Date(a.lastActivity).getTime();
    if (t > mostRecentTime) {
      mostRecentTime = t;
      mostRecent = a;
    }
  }
  if (mostRecent) {
    scores.set(mostRecent.sessionId, (scores.get(mostRecent.sessionId) || 0) + 1);
  }

  // Pick highest scoring agent
  let bestAgent = candidates[0];
  let bestScore = -1;
  for (const a of candidates) {
    const s = scores.get(a.sessionId) || 0;
    if (s > bestScore) {
      bestScore = s;
      bestAgent = a;
    }
  }

  return bestAgent;
}

function setupWatcher(dir: string) {
  if (currentWatchPath === dir) return;

  if (fsWatcher) {
    fsWatcher.close();
    fsWatcher = null;
  }

  currentWatchPath = dir;
  try {
    fsWatcher = watch(dir, { recursive: true }, async (eventType, filename) => {
      const fullPath = filename ? join(dir, filename) : dir;
      let action: string = eventType;

      // Determine if it's a create/rename vs a delete by stat-ing the file
      if (eventType === 'rename' && filename) {
        try {
          await stat(fullPath);
          action = 'create'; // File exists now
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            action = 'delete'; // File no longer exists
          }
        }
      } else if (eventType === 'change') {
        action = 'edit';
      }

      broadcast({ type: 'filesystemChange', payload: { action, path: fullPath } });

      // Observer Mode attribution with heuristic scoring
      if (observerModeEnabled) {
        const activeUnbridged = Array.from(agents.values()).filter(a => a.sessionId.startsWith('unbridged-') && a.status === 'running');
        if (activeUnbridged.length > 0) {
          const agent = await scoreAndPickAgent(activeUnbridged, fullPath);
          if (agent) {
            let toolName: ToolName = 'Edit';
            if (action === 'create') toolName = 'Write';
            if (action === 'delete') toolName = 'Delete';

            agent.lastActivity = new Date().toISOString();
            agent.currentPath = fullPath;

            broadcast({
              type: 'event',
              payload: {
                timestamp: agent.lastActivity,
                sessionId: agent.sessionId,
                hookEvent: 'PostToolUse',
                toolName: toolName,
                filePath: fullPath,
                agentType: 'main',
                provider: agent.provider,
                message: `[Observer] File ${action} detected`
              } as AgentEvent
            });
            broadcast({ type: 'agents', payload: Array.from(agents.values()) });
          }
        }
      }
    });
    console.log(`👁️  Watching filesystem at ${dir}`);
  } catch (err) {
    console.log(`⚠️  Could not watch ${dir}:`, err);
  }
}

async function getRunningProcesses(basePath: string): Promise<ProcessInfo[]> {
  // Only scan if path is 6 levels deep or less (e.g. /Users/name/Dev/project/sub/folder)
  const depth = basePath.split('/').filter(Boolean).length;
  if (depth > 6) {
    return [];
  }

  try {
    const { stdout } = await execAsync(`ps aux | grep -E "${basePath}" | grep -v grep || true`, { timeout: 2000 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const processes: ProcessInfo[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = parseInt(parts[1], 10);
      if (isNaN(pid) || pid === process.pid) continue;

      const fullCommand = parts.slice(10).join(' ');

      // Skip if doesn't actually contain the path
      if (!fullCommand.includes(basePath)) continue;

      // Extract the working directory from the command path
      // e.g. /Users/x/Dev/thegrid/client/node_modules/.bin/vite -> /Users/x/Dev/thegrid/client
      const pathMatch = fullCommand.match(new RegExp(`(${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s]*)`));
      let cwd = basePath;
      if (pathMatch) {
        const fullPath = pathMatch[1];
        // Remove node_modules and everything after, or .bin, dist, build, etc.
        const cleanPath = fullPath.replace(/\/(node_modules|\.bin|dist|build|__pycache__|\.venv|venv)\/.*$/, '');
        // Only use if it's a child of basePath
        if (cleanPath.startsWith(basePath) && cleanPath.length > basePath.length) {
          cwd = cleanPath;
        }
      }

      // Get friendly name from command
      let name = 'Process';
      if (fullCommand.includes('vite')) name = 'Vite';
      else if (fullCommand.includes('next')) name = 'Next.js';
      else if (fullCommand.includes('webpack')) name = 'Webpack';
      else if (fullCommand.includes('nodemon')) name = 'Nodemon';
      else if (fullCommand.includes('ts-node')) name = 'TypeScript';
      else if (fullCommand.includes('flask')) name = 'Flask';
      else if (fullCommand.includes('django')) name = 'Django';
      else if (fullCommand.includes('cargo')) name = 'Cargo';
      else if (fullCommand.includes('go run')) name = 'Go';
      else if (fullCommand.includes('python')) name = 'Python';
      else if (fullCommand.includes('node')) name = 'Node.js';
      // Agents
      else if (fullCommand.includes('aider')) name = 'Aider';
      else if (fullCommand.includes('goose')) name = 'Goose';
      else if (fullCommand.includes('cline') || fullCommand.includes('roocode') || fullCommand.includes('roo')) name = 'Cline';
      else if (fullCommand.includes('gemini')) name = 'Gemini';
      else if (fullCommand.includes('openhands')) name = 'OpenHands';
      else if (fullCommand.includes('kilo')) name = 'Kilocode';
      else if (fullCommand.includes('codex')) name = 'Codex';
      else if (fullCommand.includes('cursor')) name = 'Cursor';
      else if (fullCommand.includes('windsurf')) name = 'Windsurf';
      else if (fullCommand.includes('antigravity')) name = 'Anti-gravity';
      else if (fullCommand.includes('copilot')) name = 'Copilot';

      // Try to extract port from command
      let port: number | undefined;
      const portMatch = fullCommand.match(/(?:--port|PORT=|-p)\s*(\d{4,5})/i) || fullCommand.match(/:(\d{4,5})/);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
      }

      // Only include if cwd is within basePath (not in Library, Applications, hidden dirs, etc.)
      if (!cwd.startsWith(basePath) || cwd.includes('/Library/') || cwd.includes('/Applications/') || cwd.includes('/.')) {
        continue;
      }

      // Skip generic "Process" - only show recognized dev processes
      if (name === 'Process') continue;

      if (!processes.some(p => p.pid === pid)) {
        processes.push({
          pid,
          command: fullCommand.slice(0, 100),
          name,
          cwd,
          port,
        });
      }
    }

    // 2. Observer Mode: Discover native unbridged agents by checking their actual CWD via lsof
    // ps aux fails here because global commands (like `goose` or `kilo`) don't have the directory in their arguments
    try {
      const agentCommands = ['aider', 'goose', 'codex', 'kilo', 'cline', 'roo', 'roocode', 'gemini', 'openhands', 'cursor', 'windsurf', 'antigravity', 'copilot'];
      const lsofFlags = agentCommands.map(c => `-c ${c}`).join(' ');
      const { stdout: lsofOut } = await execAsync(`lsof -a -d cwd ${lsofFlags} || true`, { timeout: 2000 });

      const lsofLines = lsofOut.trim().split('\n').filter(Boolean);
      // Skip header line (COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME)
      for (let i = 1; i < lsofLines.length; i++) {
        const line = lsofLines[i];
        const parts = line.split(/\s+/);
        if (parts.length >= 9) {
          const cmd = parts[0].toLowerCase();
          const pid = parseInt(parts[1], 10);
          // Path might have spaces, so join everything from index 8
          const cwd = parts.slice(8).join(' ');

          if (cwd.startsWith(basePath) && !processes.some(p => p.pid === pid)) {
            let name = 'Agent';
            if (cmd.includes('aider')) name = 'Aider';
            else if (cmd.includes('goose')) name = 'Goose';
            else if (cmd.includes('codex')) name = 'Codex';
            else if (cmd.includes('kilo')) name = 'Kilocode';
            else if (cmd.includes('cline') || cmd.includes('roo')) name = 'Cline';
            else if (cmd.includes('gemini')) name = 'Gemini';
            else if (cmd.includes('openhands')) name = 'OpenHands';
            else if (cmd.includes('cursor')) name = 'Cursor';
            else if (cmd.includes('windsurf')) name = 'Windsurf';
            else if (cmd.includes('antigravity')) name = 'Anti-gravity';
            else if (cmd.includes('copilot')) name = 'Copilot';

            processes.push({
              pid,
              command: cmd,
              name,
              cwd,
            });
          }
        }
      }
    } catch (lsofErr) {
      console.log(`📊 lsof agent detection error:`, lsofErr);
    }

    // 3. IDE Agent Detection: Anti-gravity, Cursor, Windsurf, etc.
    // These Electron-based IDEs set CWD to '/', so lsof -d cwd won't find them.
    // Instead, parse their command lines for workspace paths.
    try {
      const idePatterns: { grep: string; name: string; provider: AgentProvider; workspaceRegex: RegExp }[] = [
        {
          grep: 'Antigravity',
          name: 'Anti-gravity',
          provider: 'antigravity',
          // language_server --workspace_id file_Users_maxnovich_Development_thegrid
          workspaceRegex: /--workspace_id\s+file_([\w\/]+)/,
        },
        {
          grep: 'Cursor.app',
          name: 'Cursor',
          provider: 'cursor',
          // --folder-uri file:///Users/x/Dev/project or --workspace_id
          workspaceRegex: /--folder-uri\s+file:\/\/([\S]+)/,
        },
        {
          grep: 'Windsurf.app',
          name: 'Windsurf',
          provider: 'windsurf',
          workspaceRegex: /--folder-uri\s+file:\/\/([\S]+)/,
        },
      ];

      for (const ide of idePatterns) {
        const { stdout: ideOut } = await execAsync(
          `ps aux | grep "${ide.grep}" | grep -v grep | head -10 || true`,
          { timeout: 1000 }
        );
        if (!ideOut.trim()) continue;

        for (const line of ideOut.trim().split('\n')) {
          const match = line.match(ide.workspaceRegex);
          if (match) {
            // Convert workspace_id format: file_Users_x_Dev -> /Users/x/Dev
            let workspace = match[1];
            if (!workspace.startsWith('/')) {
              workspace = '/' + workspace.replace(/_/g, '/');
            }

            if (workspace.startsWith(basePath)) {
              const parts = line.split(/\s+/);
              const pid = parseInt(parts[1], 10);
              if (!isNaN(pid) && !processes.some(p => p.pid === pid)) {
                processes.push({
                  pid,
                  command: ide.name.toLowerCase(),
                  name: ide.name,
                  cwd: workspace,
                });
              }
            }
          }
        }
      }
    } catch (ideErr) {
      console.log(`📊 IDE agent detection error:`, ideErr);
    }

    console.log(`📊 Found ${processes.length} dev processes for ${basePath}:`, processes.map(p => ({ name: p.name, cwd: p.cwd })));
    return processes;
  } catch (err) {
    console.log(`📊 No processes found for ${basePath}:`, err);
    return [];
  }
}

function startProcessWatcher() {
  setInterval(async () => {
    if (!watchedDirectory || clients.size === 0) return;

    const processes = await getRunningProcesses(watchedDirectory);

    // Observer Mode: Detect unbridged agents from running processes
    const currentUnbridged = new Set<string>();
    let filteredProcesses: ProcessInfo[] = [];

    if (observerModeEnabled) {
      for (const p of processes) {
        let provider: AgentProvider | null = null;
        const cmd = p.command.toLowerCase();
        if (cmd.includes('aider')) provider = 'aider';
        else if (cmd.includes('goose')) provider = 'goose';
        else if (cmd.includes('cline') || cmd.includes('roocode') || cmd.includes('roo-cline') || cmd.includes('roo')) provider = 'cline';
        else if (cmd.includes('gemini') && !cmd.includes('thegrid')) provider = 'gemini';
        else if (cmd.includes('openhands')) provider = 'opencode';
        else if (cmd.includes('kilo')) provider = 'kilocode';
        else if (cmd.includes('codex')) provider = 'codex';
        else if (cmd.includes('cursor')) provider = 'cursor';
        else if (cmd.includes('windsurf')) provider = 'windsurf';
        else if (cmd.includes('antigravity') || cmd.includes('anti-gravity')) provider = 'antigravity';
        else if (cmd.includes('copilot')) provider = 'copilot';

        if (provider) {
          const sessionId = `unbridged-${provider}-${p.pid}`;
          currentUnbridged.add(sessionId);

          if (!agents.has(sessionId)) {
            agents.set(sessionId, {
              sessionId: sessionId,
              agentType: 'main',
              currentPath: p.cwd,
              lastActivity: new Date().toISOString(),
              color: getAgentColor(provider, 'main'),
              status: 'running',
              provider: provider,
            });
            broadcast({ type: 'agents', payload: Array.from(agents.values()) });
            console.log(`🕵️‍♂️  Observer Mode: Detected unbridged agent ${provider} (PID ${p.pid})`);
          }
        } else {
          filteredProcesses.push(p);
        }
      }
    } else {
      filteredProcesses = processes;
    }

    // Mark missing unbridged agents as completed, then clean up
    for (const sessionId of unbridgedAgents) {
      if (!currentUnbridged.has(sessionId)) {
        const agent = agents.get(sessionId);
        if (agent && agent.status === 'running') {
          agent.status = 'completed';
          broadcast({ type: 'agents', payload: Array.from(agents.values()) });
          setTimeout(() => {
            agents.delete(sessionId);
            broadcast({ type: 'agents', payload: Array.from(agents.values()) });
          }, 10000);
        }
      }
    }
    unbridgedAgents = currentUnbridged;

    // Only broadcast if changed
    const newJson = JSON.stringify(filteredProcesses);
    const oldJson = JSON.stringify(cachedProcesses);

    if (newJson !== oldJson) {
      cachedProcesses = filteredProcesses;
      broadcast({ type: 'processes', payload: filteredProcesses });
      console.log(`📊 Processes updated: ${filteredProcesses.length} found`);
    }
  }, 3000);
}

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
  event.provider = event.provider || 'claude';

  // Normalize tool name from any provider format
  if (event.toolName) {
    event.toolName = normalizeToolName(event.toolName) as any;
  }

  // Check if Bash command is a delete operation
  if (event.toolName === 'Bash' && event.details?.command) {
    const command = event.details.command as string;
    const deleteCheck = isDeleteCommand(command);
    if (deleteCheck.isDelete) {
      event.toolName = 'Delete';
      if (deleteCheck.paths[0]) {
        event.filePath = deleteCheck.paths[0];
      }
    }
  }

  const agentKey = `${event.sessionId}-${event.agentType}`;

  if (event.hookEvent === 'SessionStart' || event.hookEvent === 'SubagentStart') {
    agents.set(agentKey, {
      sessionId: event.sessionId,
      agentType: event.agentType,
      currentPath: event.filePath,
      lastActivity: event.timestamp,
      color: getAgentColor(event.provider, event.agentType),
      status: 'running',
      provider: event.provider,
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
        color: getAgentColor(event.provider, event.agentType),
        status: 'running',
        provider: event.provider,
      });
    }
  }

  broadcast({ type: 'event', payload: event });
  broadcast({ type: 'agents', payload: Array.from(agents.values()) });

  // Trigger filesystem refresh for file-modifying operations
  if (event.toolName && ['Write', 'Edit', 'Delete', 'NotebookEdit'].includes(event.toolName)) {
    setTimeout(() => {
      broadcast({ type: 'filesystemChange', payload: { action: event.toolName!.toLowerCase(), path: event.filePath } });
    }, 500);
  }

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

// ─── File Content ─────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']);
const MODEL_EXTS = new Set(['glb', 'gltf', 'obj', 'stl', 'mtl']);
const TEXT_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'css', 'scss', 'html', 'yaml', 'yml', 'sh', 'bash', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'toml', 'env', 'gitignore', 'lock', 'xml', 'svg', 'sql', 'graphql', 'vue', 'svelte', 'astro', 'conf', 'ini', 'log']);

const MIME_MAP: Record<string, string> = {
  // Images
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff', avif: 'image/avif',
  // Audio
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', opus: 'audio/opus',
  // Video
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', m4v: 'video/mp4',
  // 3D Models
  glb: 'model/gltf-binary', gltf: 'model/gltf+json',
  obj: 'text/plain', stl: 'model/stl', mtl: 'text/plain',
};

app.get('/api/file/:encodedPath(*)', async (req, res) => {
  const { readFile: fsReadFile } = await import('fs/promises');
  const filePath = decodeURIComponent(req.params.encodedPath);
  const ext = extname(filePath).slice(1).toLowerCase();

  try {
    if (IMAGE_EXTS.has(ext)) {
      const data = await fsReadFile(filePath);
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      res.set('Content-Type', mime);
      res.send(data);
    } else if (AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext) || MODEL_EXTS.has(ext)) {
      const data = await fsReadFile(filePath);
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      res.set('Content-Type', mime);
      res.set('Accept-Ranges', 'bytes');
      res.send(data);
    } else if (TEXT_EXTS.has(ext) || !ext) {
      const content = await fsReadFile(filePath, 'utf-8');
      res.json({ type: 'text', content, ext });
    } else {
      res.status(415).json({ error: 'Unsupported file type', ext });
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (err.code === 'EISDIR') {
      res.status(400).json({ error: 'Path is a directory' });
    } else {
      res.status(500).json({ error: 'Failed to read file', details: String(err) });
    }
  }
});

app.get('/api/agents', (_req, res) => {
  res.json(Array.from(agents.values()));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agents: agents.size, clients: clients.size });
});

// ─── Provider Detection ─────────────────────────────────────────────────────

app.get('/api/providers', async (_req, res) => {
  const results: Array<{
    id: AgentProvider;
    name: string;
    color: string;
    available: boolean;
    spawnable: boolean;
    canResume: boolean;
  }> = [];

  for (const providerId of ALL_PROVIDERS) {
    const command = PROVIDER_COMMANDS[providerId];
    const spawnable = SPAWNABLE_PROVIDERS.includes(providerId);
    let available = false;

    if (command) {
      try {
        await execAsync(`which ${command}`, { timeout: 2000 });
        available = true;
      } catch {
        available = false;
      }
    }

    results.push({
      id: providerId,
      name: PROVIDER_NAMES[providerId],
      color: PROVIDER_COLORS[providerId],
      available,
      spawnable,
      canResume: PROVIDER_CONFIGS[providerId]?.canResume || false,
    });
  }

  res.json(results);
});

// --- GIT ENDPOINTS ---

app.get('/api/git/find-repos', async (req, res) => {
  try {
    const root = req.query.root as string;
    if (!root) return res.status(400).json({ error: 'root query param required' });
    const repos = await git.findGitRepos(root);
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/git/branches', async (req, res) => {
  try {
    const dirPath = req.query.path as string | undefined;
    const branches = await git.getBranches(dirPath);
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/git/checkout', async (req, res) => {
  try {
    const { branch, createNew, path: dirPath } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name required' });
    const result = await git.checkoutBranch(branch, createNew, dirPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/git/status', async (req, res) => {
  try {
    const dirPath = req.query.path as string | undefined;
    const isRepo = await git.checkIsGitRepo(dirPath);
    if (!isRepo) {
      return res.json({ isRepo: false, branch: '', files: [] });
    }
    const status = await git.getStatus(dirPath);
    res.json({ isRepo: true, ...status });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/git/log', async (req, res) => {
  try {
    const dirPath = req.query.path as string | undefined;
    const log = await git.getLog(dirPath);
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/git/diff/:encodedPath(*)?', async (req, res) => {
  try {
    const filePath = req.params.encodedPath ? decodeURIComponent(req.params.encodedPath) : undefined;
    const dirPath = req.query.path as string | undefined;
    const diff = await git.getDiff(filePath, dirPath);
    res.json({ diff });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/git/commit', async (req, res) => {
  try {
    const { message, path: dirPath } = req.body;
    const result = await git.commitChanges(message, dirPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/git/push', async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const result = await git.pushChanges(dirPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/git/pull', async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const result = await git.pullChanges(dirPath);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// --- AGENT ENDPOINTS ---

app.post('/api/agents/spawn', async (req, res) => {
  const { workingDirectory, prompt, dangerousMode, provider: requestedProvider } = req.body as {
    workingDirectory: string; prompt: string; dangerousMode?: boolean; provider?: AgentProvider;
  };

  if (!workingDirectory || !prompt) {
    res.status(400).json({ error: 'workingDirectory and prompt are required' });
    return;
  }

  const provider: AgentProvider = requestedProvider || 'claude';
  const providerConfig = PROVIDER_CONFIGS[provider];

  if (!providerConfig) {
    res.status(400).json({ error: `Unknown or unspawnable provider: ${provider}` });
    return;
  }

  const sessionId = `grid-${randomUUID().slice(0, 8)}`;

  try {
    // ─── ACP-First: Try ACP if provider supports it ──────────────────────────
    if (providerConfig.acpCommand) {
      let resolvedAcpCommand: string | null = null;
      try {
        const { stdout } = await execAsync(`which ${providerConfig.acpCommand}`, { timeout: 2000 });
        resolvedAcpCommand = stdout.trim();
      } catch {
        // ACP binary not installed — fall through to legacy
      }

      if (resolvedAcpCommand) {
        const resolvedCwd = workingDirectory.startsWith('/') ? workingDirectory : join(process.cwd(), workingDirectory);

        // Register agent immediately
        agents.set(`${sessionId}-main`, {
          sessionId,
          agentType: 'main',
          currentPath: workingDirectory,
          lastActivity: new Date().toISOString(),
          color: providerConfig.color,
          status: 'running',
          provider,
          canResume: providerConfig.canResume,
          workingDirectory,
        });
        broadcast({ type: 'agents', payload: Array.from(agents.values()) });

        const acpArgsArray = typeof providerConfig.acpArgs === 'function'
          ? providerConfig.acpArgs(dangerousMode)
          : (providerConfig.acpArgs || []);
        const acpArgs = [...acpArgsArray];

        console.log(`[${sessionId}] Using ACP protocol: ${resolvedAcpCommand} ${acpArgs.join(' ')}`);

        await spawnAcpAgent({
          acpCommand: resolvedAcpCommand,
          acpArgs,
          sessionId,
          workingDirectory: resolvedCwd,
          prompt,
          provider,
          providerColor: providerConfig.color,
          broadcast,
          agents,
          spawnedProcesses,
        });

        res.json({ sessionId, provider, mode: 'acp' });
        return;
      } else {
        console.log(`[${sessionId}] ACP binary '${providerConfig.acpCommand}' not found, falling back to legacy spawn`);
      }
    }

    // ─── Legacy: stdout-parsing spawn ────────────────────────────────────────
    const args = providerConfig.buildArgs(prompt, workingDirectory, dangerousMode);

    // Resolve the working directory to an absolute path
    const resolvedCwd = workingDirectory.startsWith('/') ? workingDirectory : join(process.cwd(), workingDirectory);

    // Resolve the command to its full path to avoid ENOENT
    let resolvedCommand = providerConfig.command;
    try {
      const { stdout } = await execAsync(`which ${providerConfig.command}`, { timeout: 2000 });
      resolvedCommand = stdout.trim();
    } catch {
      // Fall back to the bare command name
    }

    console.log(`[${sessionId}] Spawning ${provider}: ${resolvedCommand} ${args.join(' ')}${dangerousMode ? ' (DANGEROUS MODE)' : ''}`);

    const agentProcess = spawn(resolvedCommand, args, {
      cwd: resolvedCwd,
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    seenToolUseIds.set(sessionId, new Set());
    spawnedProcesses.set(sessionId, agentProcess);

    agents.set(`${sessionId}-main`, {
      sessionId,
      agentType: 'main',
      currentPath: workingDirectory,
      lastActivity: new Date().toISOString(),
      color: providerConfig.color,
      status: 'running',
      provider,
      canResume: providerConfig.canResume,
      workingDirectory,
    });

    broadcast({ type: 'agents', payload: Array.from(agents.values()) });

    // Buffer for incomplete JSON lines
    let stdoutBuffer = '';

    agentProcess.stdout?.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      // Keep the last incomplete line in the buffer
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        console.log(`[${sessionId}] stdout:`, line.slice(0, 300));

        const seenIds = seenToolUseIds.get(sessionId) || new Set();

        // Use provider-specific parser
        const streamEvent = providerConfig.parseStream(line, sessionId, workingDirectory);
        if (!streamEvent) continue;

        if (streamEvent.type === 'tool_use') {
          // Deduplicate
          const dedupeKey = `tool:${streamEvent.toolName}:${streamEvent.filePath}`;
          if (seenIds.has(dedupeKey)) continue;
          seenIds.add(dedupeKey);
          // Auto-expire dedup keys after 2s
          setTimeout(() => seenIds.delete(dedupeKey), 2000);

          let toolName = streamEvent.toolName || 'Unknown';
          let filePath = streamEvent.filePath || workingDirectory;

          // Resolve relative paths to absolute using workingDirectory
          if (filePath && !filePath.startsWith('/')) {
            filePath = join(workingDirectory, filePath);
          }

          // Check if Bash command is a delete operation
          if (toolName === 'Bash' && streamEvent.details?.command) {
            const deleteCheck = isDeleteCommand(streamEvent.details.command as string);
            if (deleteCheck.isDelete) {
              toolName = 'Delete';
              filePath = deleteCheck.paths[0] || filePath;
            }
          }

          const event: AgentEvent = {
            timestamp: new Date().toISOString(),
            sessionId,
            hookEvent: 'PreToolUse', // Fired when ACP streams a tool call
            toolName: toolName as any,
            filePath,
            agentType: 'main',
            provider,
          };
          console.log(`[${sessionId}] Broadcasting tool event:`, event.toolName);
          broadcast({ type: 'event', payload: event });

          const agent = agents.get(`${sessionId}-main`);
          if (agent) {
            agent.currentPath = filePath;
            agent.lastActivity = event.timestamp;
          }
          broadcast({ type: 'agents', payload: Array.from(agents.values()) });

          if (['Write', 'Edit', 'Delete', 'NotebookEdit'].includes(toolName)) {
            setTimeout(() => {
              broadcast({ type: 'filesystemChange', payload: { action: toolName.toLowerCase(), path: filePath } });
            }, 500);
          }

        } else if (streamEvent.type === 'text') {
          const textHash = `text:${streamEvent.message?.slice(0, 100)}`;
          if (seenIds.has(textHash)) continue;
          seenIds.add(textHash);

          const event: AgentEvent = {
            timestamp: new Date().toISOString(),
            sessionId,
            hookEvent: 'AssistantMessage',
            agentType: 'main',
            message: streamEvent.message,
            provider,
          };
          broadcast({ type: 'event', payload: event });

        } else if (streamEvent.type === 'result') {
          const resultKey = `result:${streamEvent.message?.slice(0, 50)}`;
          if (seenIds.has(resultKey)) continue;
          seenIds.add(resultKey);

          // Capture Claude's session ID for resumption
          if (streamEvent.details?.claudeSessionId) {
            const agent = agents.get(`${sessionId}-main`);
            if (agent) {
              agent.claudeSessionId = streamEvent.details.claudeSessionId as string;
              console.log(`[${sessionId}] Captured session ID: ${streamEvent.details.claudeSessionId}`);
            }
          }

          const event: AgentEvent = {
            timestamp: new Date().toISOString(),
            sessionId,
            hookEvent: 'Result',
            agentType: 'main',
            message: streamEvent.message,
            details: streamEvent.details,
            provider,
          };
          broadcast({ type: 'event', payload: event });
        }
      }
    });

    agentProcess.stderr?.on('data', (data) => {
      console.log(`[${sessionId}] stderr:`, data.toString().slice(0, 500));
    });

    agentProcess.on('close', (code, signal) => {
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

    agentProcess.on('error', (err) => {
      console.error(`[${sessionId}] Spawn error:`, err);
      spawnedProcesses.delete(sessionId);
      const agent = agents.get(`${sessionId}-main`);
      if (agent) {
        agent.status = 'error';
        agent.lastActivity = new Date().toISOString();
      }
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
    });

    agentProcess.on('spawn', () => {
      console.log(`[${sessionId}] Process spawned successfully, pid: ${agentProcess.pid}`);
    });

    res.json({ success: true, sessionId, provider });
    console.log(`Spawned ${provider} agent ${sessionId} in ${workingDirectory}`);

  } catch (err) {
    res.status(500).json({ error: 'Failed to spawn agent', details: String(err) });
  }
});

// Resume/follow-up with a completed agent
app.post('/api/agents/:sessionId/resume', (req, res) => {
  const { sessionId } = req.params;
  const { prompt, dangerousMode } = req.body as { prompt: string; dangerousMode?: boolean };

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const agentKey = `${sessionId}-main`;
  const agent = agents.get(agentKey);

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (!agent.claudeSessionId) {
    res.status(400).json({ error: 'Agent has no Claude session ID - cannot resume' });
    return;
  }

  if (spawnedProcesses.has(sessionId)) {
    res.status(400).json({ error: 'Agent is still running' });
    return;
  }

  const workingDirectory = agent.workingDirectory || agent.currentPath || process.cwd();

  try {
    const args = [
      '--resume', agent.claudeSessionId,
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (dangerousMode) {
      args.push('--dangerously-skip-permissions');
    }

    console.log(`[${sessionId}] Resuming with Claude session ${agent.claudeSessionId}`);

    const claudeProcess = spawn('claude', args, {
      cwd: workingDirectory,
      env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    seenToolUseIds.set(sessionId, new Set());
    spawnedProcesses.set(sessionId, claudeProcess);

    // Update agent status
    agent.status = 'running';
    agent.lastActivity = new Date().toISOString();
    broadcast({ type: 'agents', payload: Array.from(agents.values()) });

    // Reuse the same stdout/stderr handlers
    claudeProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[${sessionId}] stdout:`, output.slice(0, 500));

      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (parsed.type === 'assistant' && parsed.message?.content) {
            const seenIds = seenToolUseIds.get(sessionId) || new Set();

            for (const block of parsed.message.content) {
              if (block.type === 'tool_use') {
                if (block.id && seenIds.has(block.id)) continue;
                if (block.id) seenIds.add(block.id);

                let toolName = block.name || 'Unknown';
                let filePath = block.input?.file_path || block.input?.path || workingDirectory;

                if (toolName === 'Bash' && block.input?.command) {
                  const command = block.input.command;
                  const deleteCheck = isDeleteCommand(command);
                  if (deleteCheck.isDelete) {
                    toolName = 'Delete';
                    filePath = deleteCheck.paths[0] || filePath;
                  } else if (/\b(ls|dir|tree)\b/.test(command)) {
                    toolName = 'Glob';
                  } else if (/\b(find|grep|ag|rg|fd)\b/.test(command)) {
                    toolName = 'Grep';
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
                broadcast({ type: 'event', payload: event });

                const agent = agents.get(`${sessionId}-main`);
                if (agent) {
                  agent.currentPath = filePath;
                  agent.lastActivity = event.timestamp;
                }
                broadcast({ type: 'agents', payload: Array.from(agents.values()) });
              } else if (block.type === 'text' && block.text) {
                const textHash = `text:${block.text.slice(0, 100)}`;
                const seenIds = seenToolUseIds.get(sessionId) || new Set();
                if (seenIds.has(textHash)) continue;
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

          if (parsed.type === 'result') {
            const seenIds = seenToolUseIds.get(sessionId) || new Set();
            const resultKey = `result:${parsed.result?.slice(0, 50)}`;
            if (!seenIds.has(resultKey)) {
              seenIds.add(resultKey);

              if (parsed.session_id) {
                agent.claudeSessionId = parsed.session_id;
              }

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
                  claudeSessionId: parsed.session_id,
                },
              };
              broadcast({ type: 'event', payload: event });
            }
          }
        } catch {
          // Not JSON
        }
      }
    });

    claudeProcess.stderr?.on('data', (data) => {
      console.log(`[${sessionId}] stderr:`, data.toString().slice(0, 500));
    });

    claudeProcess.on('close', (code) => {
      spawnedProcesses.delete(sessionId);
      seenToolUseIds.delete(sessionId);
      agent.status = code === 0 ? 'completed' : 'error';
      agent.lastActivity = new Date().toISOString();
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
    });

    claudeProcess.on('error', (err) => {
      console.error(`[${sessionId}] Resume error:`, err);
      spawnedProcesses.delete(sessionId);
      agent.status = 'error';
      agent.lastActivity = new Date().toISOString();
      broadcast({ type: 'agents', payload: Array.from(agents.values()) });
    });

    res.json({ success: true, sessionId });
    console.log(`[${sessionId}] Resumed agent conversation`);

  } catch (err) {
    res.status(500).json({ error: 'Failed to resume agent', details: String(err) });
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
        watchedDirectory = message.path;
        setupWatcher(message.path);
        const node = await scanDirectory(message.path);
        if (node) {
          sendToClient(ws, { type: 'filesystem', payload: node });
        }
        const processes = await getRunningProcesses(message.path);
        cachedProcesses = processes;
        sendToClient(ws, { type: 'processes', payload: processes });
      } else if (message.type === 'setObserverMode' && message.enabled !== undefined) {
        observerModeEnabled = message.enabled;
        console.log(`🕵️‍♂️  Observer Mode set to: ${message.enabled}`);
        if (!observerModeEnabled) {
          // Clean up existing unbridged tracking objects
          for (const id of unbridgedAgents) {
            agents.delete(id);
          }
          unbridgedAgents.clear();
          broadcast({ type: 'agents', payload: Array.from(agents.values()) });
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

  // Start watching for processes
  startProcessWatcher();
  console.log(`   Process watcher started`);
});
