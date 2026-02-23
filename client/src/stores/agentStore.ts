import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'thegrid-settings';
const MAX_PERSISTED_EVENTS = 500;

export type AgentType = 'main' | 'subagent';
export type AgentStatus = 'running' | 'completed' | 'error';
export type AgentProvider =
  | 'claude' | 'gemini' | 'codex' | 'goose'
  | 'kilocode' | 'opencode' | 'kimi' | 'cline'
  | 'augment' | 'qwen' | 'aider' | 'copilot' | 'generic';

export interface AgentState {
  sessionId: string;
  agentType: AgentType;
  currentPath?: string;
  lastActivity: string;
  color: string;
  status?: AgentStatus;
  provider?: AgentProvider;
  canResume?: boolean;
  claudeSessionId?: string;
  workingDirectory?: string;
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
  provider?: AgentProvider;
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

export interface ProcessInfo {
  pid: number;
  command: string;
  name: string;
  cwd: string;
  port?: number;
}

export interface GitStatusFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
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
  processes: ProcessInfo[];
  selectedAgentId: string | null;
  searchQuery: string;
  searchResults: string[];
  highlightedPath: string | null;
  filesystemDirty: number;
  teleportCounter: number;
  dangerousMode: boolean;
  selectedProvider: AgentProvider;
  viewingFile: string | null;

  // Git
  isGitRepo: boolean;
  gitBranch: string;
  gitStatus: GitStatusFile[];
  gitLog: GitLogEntry[];
  isGitPanelOpen: boolean;
  gitRepos: string[];          // discovered repo root paths
  activeGitRepoPath: string | null;
  gitAheadCount: number;       // number of unpushed commits on the active branch
  gitAnimations: { repoPath: string; type: 'commit' | 'push' | 'pull' | 'checkout'; timestamp: number }[];

  setAgents: (agents: AgentState[]) => void;
  setFileSystem: (fs: FileSystemNode) => void;
  setCurrentPath: (path: string) => void;
  setLastEvent: (event: AgentEvent) => void;
  setConnected: (connected: boolean) => void;
  setSelectedProvider: (provider: AgentProvider) => void;
  setViewingFile: (path: string | null) => void;
  addEvent: (event: AgentEvent) => void;
  addFileEffect: (effect: FileEffect) => void;
  removeFileEffect: (path: string) => void;
  removeAgent: (sessionId: string) => void;
  selectAgent: (sessionId: string | null) => void;
  getAgentLogs: (sessionId: string) => AgentEvent[];
  getAllEvents: () => AgentEvent[];
  clearAllEvents: () => void;
  search: (query: string) => void;
  clearSearch: () => void;
  setHighlightedPath: (path: string | null) => void;
  teleportToOrigin: () => void;
  setDangerousMode: (enabled: boolean) => void;
  addFileAnimation: (animation: FileAnimation) => void;
  removeFileAnimation: (path: string) => void;
  setProcesses: (processes: ProcessInfo[]) => void;

  // Git Actions
  refreshGitStatus: (dirPath?: string) => Promise<void>;
  refreshGitLog: () => Promise<void>;
  setGitPanelOpen: (isOpen: boolean) => void;
  setActiveGitRepoPath: (repoPath: string | null) => void;
  discoverGitRepos: (rootPath: string) => Promise<void>;
  triggerGitAnimation: (repoPath: string, type: 'commit' | 'push' | 'pull' | 'checkout') => void;
  removeGitAnimation: (timestamp: number) => void;
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
      currentPath: '/Users',
      lastEvent: null,
      connected: false,
      eventLogs: new Map(),
      allEvents: [],
      fileEffects: [],
      fileAnimations: [],
      processes: [],
      selectedAgentId: null,
      searchQuery: '',
      searchResults: [],
      highlightedPath: null,
      filesystemDirty: 0,
      teleportCounter: 0,
      dangerousMode: false,
      selectedProvider: 'claude',
      viewingFile: null,

      isGitRepo: false,
      gitBranch: '',
      gitStatus: [],
      gitLog: [],
      isGitPanelOpen: false,
      gitRepos: [],
      activeGitRepoPath: null,
      gitAheadCount: 0,
      gitAnimations: [],

      setAgents: (agents) => {
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

      setSelectedProvider: (provider) => set({ selectedProvider: provider }),

      setViewingFile: (path) => set({ viewingFile: path }),

      getAgentLogs: (sessionId) => {
        return get().eventLogs.get(sessionId) || [];
      },

      getAllEvents: () => {
        return get().allEvents;
      },

      clearAllEvents: () => {
        set({ eventLogs: new Map(), allEvents: [] });
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

      setProcesses: (processes) => set({ processes }),

      refreshGitStatus: async (dirPath?: string) => {
        try {
          const pathParam = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
          const res = await fetch(`/api/git/status${pathParam}`);
          if (res.ok) {
            const data = await res.json();
            set({
              isGitRepo: data.isRepo,
              gitBranch: data.branch || '',
              gitStatus: data.files || [],
              gitAheadCount: data.aheadCount || 0
            });
          }
        } catch (err) {
          console.error('Failed to fetch git status', err);
        }
      },

      refreshGitLog: async () => {
        try {
          const res = await fetch('/api/git/log');
          if (res.ok) {
            const data = await res.json();
            set({ gitLog: Array.isArray(data) ? data : [] });
          }
        } catch (err) {
          console.error('Failed to fetch git log', err);
        }
      },

      setGitPanelOpen: (isOpen) => set({ isGitPanelOpen: isOpen }),

      setActiveGitRepoPath: (repoPath) => set({ activeGitRepoPath: repoPath }),

      triggerGitAnimation: (repoPath, type) => {
        const animation = { repoPath, type, timestamp: Date.now() };
        set(state => ({ gitAnimations: [...state.gitAnimations, animation] }));
      },

      removeGitAnimation: (timestamp) => {
        set(state => ({ gitAnimations: state.gitAnimations.filter(a => a.timestamp !== timestamp) }));
      },

      discoverGitRepos: async (rootPath) => {
        try {
          const res = await fetch(`/api/git/find-repos?root=${encodeURIComponent(rootPath)}`);
          if (res.ok) {
            const repos = await res.json();
            set({ gitRepos: Array.isArray(repos) ? repos : [] });
          }
        } catch (err) {
          console.error('Failed to discover git repos', err);
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        dangerousMode: state.dangerousMode,
        currentPath: state.currentPath,
        selectedProvider: state.selectedProvider,
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
