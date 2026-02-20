export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'SessionEnd'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'AssistantMessage'
  | 'Result';

export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Delete'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'TodoWrite'
  | 'NotebookEdit'
  | 'AskUserQuestion'
  | 'Unknown';

export type AgentType = 'main' | 'subagent';

export type AgentProvider =
  | 'claude'
  | 'gemini'
  | 'codex'
  | 'goose'
  | 'kilocode'
  | 'opencode'
  | 'kimi'
  | 'cline'
  | 'augment'
  | 'qwen'
  | 'aider'
  | 'copilot'
  | 'generic';

export interface ProviderConfig {
  name: string;
  command: string;
  color: string;
  icon: string;
  buildArgs: (prompt: string, workingDirectory: string, dangerousMode?: boolean) => string[];
  parseStream: (line: string, sessionId: string, workingDirectory: string) => ParsedStreamEvent | null;
}

export interface ParsedStreamEvent {
  type: 'tool_use' | 'text' | 'result';
  toolName?: string;
  filePath?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: HookEventType;
  toolName?: ToolName;
  filePath?: string;
  agentType: AgentType;
  message?: string;
  details?: Record<string, unknown>;
  provider?: AgentProvider;
}

export type AgentStatus = 'running' | 'completed' | 'error';

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
  status: AgentStatus;
  provider?: AgentProvider;
  claudeSessionId?: string;  // The actual Claude session ID for resumption
  workingDirectory?: string; // Original working directory for the agent
}

export interface FileSystemNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileSystemNode[];
  extension?: string;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  name: string;
  cwd: string;
  port?: number;
}

export interface ServerMessage {
  type: 'event' | 'agents' | 'filesystem' | 'error' | 'filesystemChange' | 'processes';
  payload: AgentEvent | AgentState[] | FileSystemNode | { message: string } | { action: string; path?: string } | ProcessInfo[];
}

export interface ClientMessage {
  type: 'subscribe' | 'getFilesystem' | 'ping';
  path?: string;
}
