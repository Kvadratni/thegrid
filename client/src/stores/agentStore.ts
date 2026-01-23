import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'thegrid-settings';
const MAX_PERSISTED_EVENTS = 500;

export type AgentType = 'main' | 'subagent';
export type AgentStatus = 'running' | 'completed' | 'error';

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
  status?: AgentStatus;
}

export interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: string;
  toolName?: string;
  filePath?: string;
  agentType: AgentType;
  message?: string;
  details?: Record<string, unknown>;
}

export type FileEffectType = 'create' | 'edit' | 'delete' | 'read';

export interface FileEffect {
  path: string;
  type: FileEffectType;
  timestamp: number;
  color: string;
}

export interface FileAnimation {
  path: string;
  type: 'create' | 'delete';
  startTime: number;
  position?: { x: number; z: number; height: number };
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
  allEvents: AgentEvent[];
  fileEffects: FileEffect[];
  fileAnimations: FileAnimation[];
  selectedAgentId: string | null;
  searchQuery: string;
  searchResults: string[];
  highlightedPath: string | null;
  filesystemDirty: number;
  teleportCounter: number;
  dangerousMode: boolean;

  setAgents: (agents: AgentState[]) => void;
  setFileSystem: (fs: FileSystemNode) => void;
  setCurrentPath: (path: string) => void;
  setLastEvent: (event: AgentEvent) => void;
  setConnected: (connected: boolean) => void;
  addEvent: (event: AgentEvent) => void;
  addFileEffect: (effect: FileEffect) => void;
  removeFileEffect: (path: string) => void;
  removeAgent: (sessionId: string) => void;
  selectAgent: (sessionId: string | null) => void;
  getAgentLogs: (sessionId: string) => AgentEvent[];
  getAllEvents: () => AgentEvent[];
  search: (query: string) => void;
  clearSearch: () => void;
  setHighlightedPath: (path: string | null) => void;
  teleportToOrigin: () => void;
  setDangerousMode: (enabled: boolean) => void;
  addFileAnimation: (animation: FileAnimation) => void;
  removeFileAnimation: (path: string) => void;
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

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
  agents: [],
  fileSystem: null,
  currentPath: '/Users/mnovich/Development/thegrid',
  lastEvent: null,
  connected: false,
  eventLogs: new Map(),
  allEvents: [],
  fileEffects: [],
  fileAnimations: [],
  selectedAgentId: null,
  searchQuery: '',
  searchResults: [],
  highlightedPath: null,
  filesystemDirty: 0,
  teleportCounter: 0,
  dangerousMode: false,

  setAgents: (agents) => {
    // Auto-remove completed/error agents after 30 seconds
    const COMPLETED_AGENT_TIMEOUT = 30000;

    agents.forEach(agent => {
      if (agent.status === 'completed' || agent.status === 'error') {
        setTimeout(() => {
          const currentAgents = get().agents;
          const stillExists = currentAgents.find(a =>
            a.sessionId === agent.sessionId &&
            (a.status === 'completed' || a.status === 'error')
          );
          if (stillExists) {
            get().removeAgent(agent.sessionId);
          }
        }, COMPLETED_AGENT_TIMEOUT);
      }
    });

    set({ agents });
  },

  setFileSystem: (fs) => set({ fileSystem: fs }),

  setCurrentPath: (path) => {
    set({ currentPath: path, teleportCounter: get().teleportCounter + 1 });
  },

  teleportToOrigin: () => {
    set({ teleportCounter: get().teleportCounter + 1 });
  },

  setLastEvent: (event) => set({ lastEvent: event }),

  setConnected: (connected) => set({ connected }),

  selectAgent: (sessionId) => set({ selectedAgentId: sessionId }),

  getAgentLogs: (sessionId) => {
    return get().eventLogs.get(sessionId) || [];
  },

  getAllEvents: () => {
    return get().allEvents;
  },

  addFileEffect: (effect) => {
    const fileEffects = get().fileEffects.filter(e => e.path !== effect.path);
    fileEffects.push(effect);
    set({ fileEffects });

    setTimeout(() => {
      get().removeFileEffect(effect.path);
    }, 2000);
  },

  removeFileEffect: (path) => {
    set({ fileEffects: get().fileEffects.filter(e => e.path !== path) });
  },

  removeAgent: (sessionId) => {
    const agents = get().agents.filter(a => a.sessionId !== sessionId);
    const selectedAgentId = get().selectedAgentId === sessionId ? null : get().selectedAgentId;
    set({ agents, selectedAgentId });
  },

  addEvent: (event) => {
    // Create a unique key for deduplication
    const eventKey = `${event.sessionId}:${event.hookEvent}:${event.toolName || ''}:${event.filePath || ''}:${event.message?.slice(0, 50) || ''}`;

    // Check last few events to prevent duplicates
    const recentEvents = get().allEvents.slice(-10);
    const isDuplicate = recentEvents.some(e => {
      const existingKey = `${e.sessionId}:${e.hookEvent}:${e.toolName || ''}:${e.filePath || ''}:${e.message?.slice(0, 50) || ''}`;
      return existingKey === eventKey;
    });

    if (isDuplicate) {
      console.log('⏭️ Skipping duplicate event:', eventKey.slice(0, 80));
      return;
    }

    console.log('📡 Event received:', event);

    const eventLogs = get().eventLogs;
    const logs = eventLogs.get(event.sessionId) || [];
    logs.push(event);
    if (logs.length > 100) logs.shift();
    eventLogs.set(event.sessionId, logs);

    const allEvents = [...get().allEvents, event];
    if (allEvents.length > 200) allEvents.shift();

    set({ lastEvent: event, eventLogs: new Map(eventLogs), allEvents });

    if (event.filePath) {
      const agents = get().agents.map((agent) => {
        if (agent.sessionId === event.sessionId && agent.agentType === event.agentType) {
          return { ...agent, currentPath: event.filePath, lastActivity: event.timestamp };
        }
        return agent;
      });
      set({ agents });

      const agent = get().agents.find(a => a.sessionId === event.sessionId);
      const color = agent?.color || '#00FFFF';

      let effectType: FileEffectType | null = null;
      switch (event.toolName) {
        case 'Write':
          effectType = 'create';
          break;
        case 'Edit':
          effectType = 'edit';
          break;
        case 'Read':
          effectType = 'read';
          break;
        case 'Delete':
          effectType = 'delete';
          break;
      }

      if (effectType && event.filePath) {
        get().addFileEffect({
          path: event.filePath,
          type: effectType,
          timestamp: Date.now(),
          color,
        });

        // Add file animation for create/delete
        if (effectType === 'create' || effectType === 'delete') {
          get().addFileAnimation({
            path: event.filePath,
            type: effectType,
            startTime: Date.now(),
          });
        }

        if (effectType === 'create' || effectType === 'edit' || effectType === 'delete') {
          set({ filesystemDirty: get().filesystemDirty + 1 });
        }
      }
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

  setDangerousMode: (enabled) => set({ dangerousMode: enabled }),

  addFileAnimation: (animation) => {
    const animations = get().fileAnimations.filter(a => a.path !== animation.path);
    animations.push(animation);
    set({ fileAnimations: animations });

    // Auto-remove after animation completes (3 seconds)
    setTimeout(() => {
      get().removeFileAnimation(animation.path);
    }, 3000);
  },

  removeFileAnimation: (path) => {
    set({ fileAnimations: get().fileAnimations.filter(a => a.path !== path) });
  },
}),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        dangerousMode: state.dangerousMode,
        currentPath: state.currentPath,
        allEvents: state.allEvents.slice(-MAX_PERSISTED_EVENTS),
        eventLogs: Object.fromEntries(
          Array.from(state.eventLogs.entries()).map(([k, v]) => [k, v.slice(-100)])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.eventLogs && !(state.eventLogs instanceof Map)) {
          state.eventLogs = new Map(Object.entries(state.eventLogs as Record<string, AgentEvent[]>));
        }
      },
    }
  )
);
