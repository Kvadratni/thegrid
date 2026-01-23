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

export interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: HookEventType;
  toolName?: ToolName;
  filePath?: string;
  agentType: AgentType;
  message?: string;
  details?: Record<string, unknown>;
}

export type AgentStatus = 'running' | 'completed' | 'error';

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
  status: AgentStatus;
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
  type: 'event' | 'agents' | 'filesystem' | 'error' | 'filesystemChange';
  payload: AgentEvent | AgentState[] | FileSystemNode | { message: string } | { action: string; path?: string };
}

export interface ClientMessage {
  type: 'subscribe' | 'getFilesystem' | 'ping';
  path?: string;
}
