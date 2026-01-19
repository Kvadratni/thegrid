export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'SessionEnd'
  | 'SubagentStart'
  | 'SubagentStop';

export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'TodoWrite'
  | 'AskUserQuestion'
  | 'Unknown';

export type AgentType = 'main' | 'subagent';

export interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: HookEventType;
  toolName?: ToolName;
  filePath?: string;
  agentType: AgentType;
  details?: Record<string, unknown>;
}

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
}

export interface FileSystemNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileSystemNode[];
  extension?: string;
}

export interface ServerMessage {
  type: 'event' | 'agents' | 'filesystem' | 'error';
  payload: AgentEvent | AgentState[] | FileSystemNode | { message: string };
}

export interface ClientMessage {
  type: 'subscribe' | 'getFilesystem' | 'ping';
  path?: string;
}
