import { create } from 'zustand';

export type AgentType = 'main' | 'subagent';

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
}

export interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: string;
  toolName?: string;
  filePath?: string;
  agentType: AgentType;
  details?: Record<string, unknown>;
}

export interface FileSystemNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileSystemNode[];
  extension?: string;
}

interface AgentStore {
  agents: AgentState[];
  fileSystem: FileSystemNode | null;
  currentPath: string;
  lastEvent: AgentEvent | null;
  connected: boolean;
  eventLogs: Map<string, AgentEvent[]>;
  selectedAgentId: string | null;
  searchQuery: string;
  searchResults: string[];
  highlightedPath: string | null;

  setAgents: (agents: AgentState[]) => void;
  setFileSystem: (fs: FileSystemNode) => void;
  setCurrentPath: (path: string) => void;
  setLastEvent: (event: AgentEvent) => void;
  setConnected: (connected: boolean) => void;
  addEvent: (event: AgentEvent) => void;
  selectAgent: (sessionId: string | null) => void;
  getAgentLogs: (sessionId: string) => AgentEvent[];
  search: (query: string) => void;
  clearSearch: () => void;
  setHighlightedPath: (path: string | null) => void;
}

function searchFileSystem(node: FileSystemNode, query: string, results: string[] = []): string[] {
  const lowerQuery = query.toLowerCase();
  if (node.name.toLowerCase().includes(lowerQuery)) {
    results.push(node.path);
  }
  if (node.children) {
    for (const child of node.children) {
      searchFileSystem(child, query, results);
    }
  }
  return results;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  fileSystem: null,
  currentPath: '/Users/mnovich/Development/thegrid',
  lastEvent: null,
  connected: false,
  eventLogs: new Map(),
  selectedAgentId: null,
  searchQuery: '',
  searchResults: [],
  highlightedPath: null,

  setAgents: (agents) => set({ agents }),

  setFileSystem: (fs) => set({ fileSystem: fs }),

  setCurrentPath: (path) => {
    set({ currentPath: path });
  },

  setLastEvent: (event) => set({ lastEvent: event }),

  setConnected: (connected) => set({ connected }),

  selectAgent: (sessionId) => set({ selectedAgentId: sessionId }),

  getAgentLogs: (sessionId) => {
    return get().eventLogs.get(sessionId) || [];
  },

  addEvent: (event) => {
    const eventLogs = get().eventLogs;
    const logs = eventLogs.get(event.sessionId) || [];
    logs.push(event);
    if (logs.length > 100) logs.shift();
    eventLogs.set(event.sessionId, logs);

    set({ lastEvent: event, eventLogs: new Map(eventLogs) });

    if (event.filePath) {
      const agents = get().agents.map((agent) => {
        if (agent.sessionId === event.sessionId && agent.agentType === event.agentType) {
          return { ...agent, currentPath: event.filePath, lastActivity: event.timestamp };
        }
        return agent;
      });
      set({ agents });
    }
  },

  search: (query) => {
    const fs = get().fileSystem;
    if (!fs || !query.trim()) {
      set({ searchQuery: query, searchResults: [], highlightedPath: null });
      return;
    }
    const results = searchFileSystem(fs, query.trim());
    set({
      searchQuery: query,
      searchResults: results,
      highlightedPath: results.length > 0 ? results[0] : null,
    });
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [], highlightedPath: null }),

  setHighlightedPath: (path) => set({ highlightedPath: path }),
}));
