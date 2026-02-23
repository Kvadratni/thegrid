import { useState, useEffect, useRef } from 'react';
import { useAgentStore, AgentEvent, AgentProvider } from '../stores/agentStore';
import GitControlPanel from './GitControlPanel';

function isDirectory(path: string, fileSystem: import('../stores/agentStore').FileSystemNode | null): boolean {
  if (!fileSystem) return false;

  function findNode(node: import('../stores/agentStore').FileSystemNode): import('../stores/agentStore').FileSystemNode | null {
    if (node.path === path) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
    }
    return null;
  }

  const node = findNode(fileSystem);
  return node?.type === 'directory';
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useAgentStore((state) => state.searchQuery);
  const searchResults = useAgentStore((state) => state.searchResults);
  const highlightedPath = useAgentStore((state) => state.highlightedPath);
  const fileSystem = useAgentStore((state) => state.fileSystem);
  const search = useAgentStore((state) => state.search);
  const setHighlightedPath = useAgentStore((state) => state.setHighlightedPath);
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchResults.length > 0) {
      setSelectedIndex(0);
      setHighlightedPath(searchResults[0]);
    }
  }, [searchResults, setHighlightedPath]);

  const navigateToResult = (path: string) => {
    if (isDirectory(path, fileSystem)) {
      setCurrentPath(path);
    } else {
      const parentPath = path.split('/').slice(0, -1).join('/');
      setCurrentPath(parentPath);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
      setSelectedIndex(newIndex);
      setHighlightedPath(searchResults[newIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(newIndex);
      setHighlightedPath(searchResults[newIndex]);
    } else if (e.key === 'Enter' && highlightedPath) {
      navigateToResult(highlightedPath);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '500px',
      background: 'rgba(0, 0, 20, 0.98)',
      border: '1px solid #00FFFF',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'monospace',
      color: '#FFF',
      boxShadow: '0 0 40px rgba(0, 255, 255, 0.4)',
      zIndex: 2000,
    }}>
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#00FFFF', fontSize: '14px' }}>⌘F</span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => search(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files and folders..."
          style={{
            flex: 1,
            background: 'rgba(0, 0, 40, 0.8)',
            border: '1px solid #00FFFF',
            borderRadius: '4px',
            color: '#FFF',
            padding: '10px 12px',
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
      </div>

      {searchQuery && (
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {searchResults.map((path, i) => {
          const fileName = path.split('/').pop();
          const parentDir = path.split('/').slice(-2, -1)[0];
          const isSelected = i === selectedIndex;

          return (
            <div
              key={path}
              onClick={() => {
                setSelectedIndex(i);
                setHighlightedPath(path);
                navigateToResult(path);
              }}
              style={{
                padding: '10px 12px',
                marginBottom: '4px',
                background: isSelected ? 'rgba(0, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                borderLeft: isSelected ? '3px solid #00FFFF' : '3px solid transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ color: isSelected ? '#00FFFF' : '#FFF', fontSize: '13px' }}>
                {fileName}
              </div>
              <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
                {parentDir}/
              </div>
            </div>
          );
        })}

        {searchQuery && searchResults.length === 0 && (
          <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
            No matches found
          </div>
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '10px', color: '#444', textAlign: 'center' }}>
        ↑↓ Navigate • Enter to go to file • Esc to close
      </div>
    </div>
  );
}

function getAgentName(sessionId: string): string {
  if (sessionId.startsWith('grid-')) {
    return sessionId.replace('grid-', '').toUpperCase();
  }
  const hash = sessionId.slice(-6).toUpperCase();
  return hash;
}

const PROVIDER_DISPLAY: Record<AgentProvider, { icon: string; label: string }> = {
  claude: { icon: '●', label: 'Claude Code' },
  gemini: { icon: '◆', label: 'Gemini CLI' },
  codex: { icon: '■', label: 'Codex CLI' },
  goose: { icon: '▲', label: 'Goose' },
  kilocode: { icon: '◎', label: 'Kilocode' },
  opencode: { icon: '⬡', label: 'OpenCode' },
  kimi: { icon: '✦', label: 'Kimi CLI' },
  cline: { icon: '◇', label: 'Cline' },
  augment: { icon: '⬢', label: 'Augment' },
  qwen: { icon: '★', label: 'Qwen Code' },
  aider: { icon: '▼', label: 'Aider' },
  copilot: { icon: '◈', label: 'Copilot' },
  generic: { icon: '○', label: 'Generic' },
};

interface ProviderInfo {
  id: AgentProvider;
  name: string;
  color: string;
  available: boolean;
  spawnable: boolean;
}

function LogPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const logs = useAgentStore((state) => state.getAgentLogs(sessionId));
  const agent = useAgentStore((state) => state.agents.find(a => a.sessionId === sessionId));

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '400px',
      maxHeight: '80vh',
      background: 'rgba(0, 0, 20, 0.95)',
      border: `1px solid ${agent?.color || '#00FFFF'}`,
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'monospace',
      color: '#FFF',
      boxShadow: `0 0 20px ${agent?.color || '#00FFFF'}40`,
      zIndex: 1001,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        borderBottom: `1px solid ${agent?.color || '#00FFFF'}40`,
        paddingBottom: '8px',
      }}>
        <div>
          <div style={{ color: agent?.color, fontSize: '14px', fontWeight: 'bold' }}>
            ● AGENT {getAgentName(sessionId)}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>{sessionId}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #FF0066',
            color: '#FF0066',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            borderRadius: '3px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        EVENT LOG ({logs.length} events)
      </div>

      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '20px' }}>
            No events recorded
          </div>
        ) : (
          [...logs].reverse().map((event: AgentEvent, i: number) => {
            const isMessage = event.hookEvent === 'AssistantMessage' || event.hookEvent === 'Result';
            const isResult = event.hookEvent === 'Result';
            const borderColor = isResult ? '#00FF00' : isMessage ? '#00FFFF' : event.toolName ? '#FFFF00' : '#666';

            return (
              <div
                key={i}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  background: isResult ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '4px',
                  borderLeft: `2px solid ${borderColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: borderColor, fontSize: '11px' }}>
                    {event.toolName || event.hookEvent}
                  </span>
                  <span style={{ color: '#444', fontSize: '9px' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.filePath && (
                  <div style={{ color: '#888', fontSize: '10px', wordBreak: 'break-all' }}>
                    → {event.filePath.split('/').slice(-2).join('/')}
                  </div>
                )}
                {event.message && (
                  <div style={{
                    color: '#CCC',
                    fontSize: '11px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '100px',
                    overflow: 'auto',
                  }}>
                    {event.message.slice(0, 500)}{event.message.length > 500 ? '...' : ''}
                  </div>
                )}
                {isResult && event.details && (
                  <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                    {String(event.details.num_turns)} turns • ${Number(event.details.cost_usd || 0).toFixed(4)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AllEventsPanel({ onClose }: { onClose: () => void }) {
  const allEvents = useAgentStore((state) => state.allEvents);
  const clearAllEvents = useAgentStore((state) => state.clearAllEvents);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '500px',
      maxHeight: '90vh',
      background: 'rgba(0, 0, 20, 0.95)',
      border: '1px solid #FF6600',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'monospace',
      color: '#FFF',
      boxShadow: '0 0 20px rgba(255, 102, 0, 0.4)',
      zIndex: 1001,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        borderBottom: '1px solid rgba(255, 102, 0, 0.4)',
        paddingBottom: '8px',
      }}>
        <div>
          <div style={{ color: '#FF6600', fontSize: '14px', fontWeight: 'bold' }}>
            ◆ ALL EVENTS LOG
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            Real-time hook events from all agents
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={clearAllEvents}
            disabled={allEvents.length === 0}
            style={{
              background: 'none',
              border: '1px solid #FF6600',
              color: '#FF6600',
              padding: '4px 12px',
              cursor: allEvents.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              borderRadius: '3px',
              opacity: allEvents.length === 0 ? 0.5 : 1,
            }}
          >
            Clear
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #FF0066',
              color: '#FF0066',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              borderRadius: '3px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        {allEvents.length} events captured
      </div>

      <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {allEvents.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '30px' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📡</div>
            <div style={{ marginBottom: '8px' }}>No events received yet</div>
            <div style={{ fontSize: '10px', color: '#444' }}>
              Events will appear here when Claude Code hooks fire.
              <br />
              Make sure the server is running and hooks are configured.
            </div>
          </div>
        ) : (
          [...allEvents].map((event: AgentEvent, i: number) => {
            const isMessage = event.hookEvent === 'AssistantMessage' || event.hookEvent === 'Result' || event.hookEvent === 'ParsedText';
            const isResult = event.hookEvent === 'Result';

            return (
              <div
                key={i}
                style={{
                  padding: '10px',
                  marginBottom: '6px',
                  background: isResult ? 'rgba(0, 255, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '4px',
                  borderLeft: `3px solid ${event.agentType === 'main' ? '#00FFFF' : '#FF6600'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      color: event.agentType === 'main' ? '#00FFFF' : '#FF6600',
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '3px',
                    }}>
                      {event.agentType?.toUpperCase() || 'MAIN'}
                    </span>
                    <span style={{ color: isResult ? '#00FF00' : isMessage ? '#00FFFF' : '#FFFF00', fontSize: '12px', fontWeight: 'bold' }}>
                      {event.toolName || event.hookEvent}
                    </span>
                  </div>
                  <span style={{ color: '#444', fontSize: '9px' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                  Session: {event.sessionId.slice(0, 20)}...
                </div>
                {event.filePath && (
                  <div style={{ color: '#888', fontSize: '11px', wordBreak: 'break-all' }}>
                    → {event.filePath}
                  </div>
                )}
                {event.message && (
                  <div style={{
                    color: '#CCC',
                    fontSize: '11px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '80px',
                    overflow: 'auto',
                  }}>
                    {event.message.slice(0, 300)}{event.message.length > 300 ? '...' : ''}
                  </div>
                )}
                {isResult && event.details && (
                  <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                    {String(event.details.num_turns)} turns • ${Number(event.details.cost_usd || 0).toFixed(4)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilesystemNavigator({ onClose }: { onClose: () => void }) {
  const [inputPath, setInputPath] = useState('');
  const [entries, setEntries] = useState<Array<{ name: string; path: string; type: string }>>([]);
  const [browsePath, setBrowsePath] = useState('/');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);
  const inputRef = useRef<HTMLInputElement>(null);

  // Split input into dir path and search term
  const getSearchParts = (input: string) => {
    let dir = browsePath;
    let filter = input;

    if (input.includes('/')) {
      const parts = input.split('/');
      filter = parts.pop() || '';
      const inputDir = parts.join('/');

      if (input.startsWith('/')) {
        dir = inputDir || '/';
      } else {
        dir = browsePath === '/' ? `/${inputDir}` : `${browsePath}/${inputDir}`;
      }
    }

    // Normalize dir
    dir = dir.replace(/\/+/g, '/');
    return { dir, filter: filter.toLowerCase() };
  };

  const { dir: fetchDir, filter: searchTerm } = getSearchParts(inputPath);

  // Load directory entries
  useEffect(() => {
    const encodedPath = encodeURIComponent(fetchDir);
    fetch(`/api/filesystem/${encodedPath}?depth=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.children) {
          const sorted = [...data.children].sort((a: any, b: any) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          });
          setEntries(sorted);
          setSelectedIndex(0);
        } else {
          setEntries([]);
        }
      })
      .catch(() => setEntries([]));
  }, [fetchDir]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const navigate = (path: string) => {
    let finalPath = path;
    if (!finalPath.startsWith('/')) {
      finalPath = browsePath === '/' ? `/${finalPath}` : `${browsePath}/${finalPath}`;
    }
    setCurrentPath(finalPath);
    onClose();
  };

  const filteredEntries = searchTerm
    ? entries.filter(e => e.name.toLowerCase().includes(searchTerm))
    : entries;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredEntries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (filteredEntries[selectedIndex]) {
        const entry = filteredEntries[selectedIndex];
        if (entry.type === 'directory') {
          setBrowsePath(entry.path);
          setInputPath('');
          setSelectedIndex(0);
        } else {
          const parts = inputPath.split('/');
          parts.pop(); // remove filter term
          parts.push(entry.name);
          setInputPath(parts.join('/'));
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (inputPath.trim()) {
        navigate(inputPath.trim());
      } else {
        navigate(browsePath);
      }
    } else if (e.key === 'Backspace' && !inputPath) {
      const parent = browsePath.split('/').slice(0, -1).join('/') || '/';
      setBrowsePath(parent);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '500px',
      maxHeight: '60vh',
      background: 'rgba(0, 0, 10, 0.95)',
      border: '1px solid #00FFFF',
      borderRadius: '8px',
      zIndex: 2000,
      fontFamily: 'monospace',
      overflow: 'hidden',
      boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
    }} onKeyDown={handleKeyDown}>
      <div style={{ padding: '12px', borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>
          📂 {browsePath}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputPath}
          onChange={(e) => {
            setInputPath(e.target.value);
            setSelectedIndex(0);
          }}
          placeholder="Type path or filter... (Tab to autocomplete)"
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid #00FFFF',
            borderRadius: '4px',
            color: '#FFF',
            padding: '10px 12px',
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '4px 0' }}>
        {filteredEntries.map((entry, i) => (
          <div
            key={entry.path}
            onClick={() => {
              if (entry.type === 'directory') {
                setBrowsePath(entry.path);
                setInputPath('');
              } else {
                navigate(entry.path.split('/').slice(0, -1).join('/'));
              }
            }}
            onDoubleClick={() => navigate(entry.path)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: i === selectedIndex ? 'rgba(0, 255, 255, 0.1)' : 'transparent',
              borderLeft: i === selectedIndex ? '3px solid #00FFFF' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '14px' }}>
              {entry.type === 'directory' ? '📁' : '📄'}
            </span>
            <span style={{
              color: entry.type === 'directory' ? '#00FFFF' : '#AAA',
              fontSize: '13px',
            }}>
              {entry.name}
            </span>
          </div>
        ))}
        {filteredEntries.length === 0 && (
          <div style={{ padding: '20px', color: '#666', textAlign: 'center', fontSize: '12px' }}>
            No entries found
          </div>
        )}
      </div>
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(0, 255, 255, 0.2)',
        fontSize: '10px',
        color: '#555',
        display: 'flex',
        gap: '12px',
      }}>
        <span>↑↓ navigate</span>
        <span>Tab/→ select item</span>
        <span>Enter accept path</span>
        <span>⌫ parent dir</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}

export default function HUD() {
  const [prompt, setPrompt] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [followUpAgentId, setFollowUpAgentId] = useState<string | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const selectedProvider = useAgentStore((state) => state.selectedProvider);
  const setSelectedProvider = useAgentStore((state) => state.setSelectedProvider);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const currentPath = useAgentStore((state) => state.currentPath);
  const agents = useAgentStore((state) => state.agents);
  const connected = useAgentStore((state) => state.connected);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const selectAgent = useAgentStore((state) => state.selectAgent);
  const removeAgent = useAgentStore((state) => state.removeAgent);
  const clearSearch = useAgentStore((state) => state.clearSearch);
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);
  const allEventsCount = useAgentStore((state) => state.allEvents.length);
  const dangerousMode = useAgentStore((state) => state.dangerousMode);
  const setDangerousMode = useAgentStore((state) => state.setDangerousMode);
  const refreshGitStatus = useAgentStore((state) => state.refreshGitStatus);
  const refreshGitLog = useAgentStore((state) => state.refreshGitLog);
  const isGitPanelOpen = useAgentStore((state) => state.isGitPanelOpen);
  const setGitPanelOpen = useAgentStore((state) => state.setGitPanelOpen);
  const discoverGitRepos = useAgentStore((state) => state.discoverGitRepos);

  // Initial Git fetch and repo discovery on load
  useEffect(() => {
    refreshGitStatus();
    refreshGitLog();
    if (currentPath) discoverGitRepos(currentPath);
  }, [refreshGitStatus, refreshGitLog, discoverGitRepos, currentPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.getElementById('spawn-agent-btn')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch available providers on mount
  useEffect(() => {
    fetch('/api/providers')
      .then(res => res.json())
      .then((data: ProviderInfo[]) => {
        setProviders(data);

        // Only auto-select if current selected provider is not available
        // Wait a tick to ensure Zustand has hydrated from localStorage
        setTimeout(() => {
          const currentProvider = useAgentStore.getState().selectedProvider;
          const currentProviderInfo = data.find(p => p.id === currentProvider);

          if (!currentProviderInfo || !currentProviderInfo.available || !currentProviderInfo.spawnable) {
            const firstAvailable = data.find(p => p.available && p.spawnable);
            if (firstAvailable) useAgentStore.getState().setSelectedProvider(firstAvailable.id);
          }
        }, 100);
      })
      .catch(err => console.error('Failed to fetch providers:', err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowNavigator(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const handleSpawn = async () => {
    if (!prompt.trim() || isSpawning) return;

    setIsSpawning(true);
    try {
      const response = await fetch('/api/agents/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workingDirectory: currentPath,
          prompt: prompt.trim(),
          dangerousMode,
          provider: selectedProvider,
        }),
      });

      if (response.ok) {
        setPrompt('');
      }
    } catch (err) {
      console.error('Failed to spawn agent:', err);
    } finally {
      setIsSpawning(false);
    }
  };

  const handleKill = async (sessionId: string) => {
    try {
      await fetch(`/api/agents/${sessionId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to kill agent:', err);
    }
  };

  const handleRemove = async (sessionId: string) => {
    try {
      await fetch(`/api/agents/${sessionId}`, { method: 'DELETE' });
      removeAgent(sessionId);
    } catch (err) {
      console.error('Failed to remove agent:', err);
      removeAgent(sessionId);
    }
  };

  const handleGoToAgent = (agentPath: string | undefined) => {
    if (!agentPath) return;
    // Get parent folder of the file/folder the agent is working on
    const parentPath = agentPath.split('/').slice(0, -1).join('/') || agentPath;
    setCurrentPath(parentPath);
  };

  const handleResume = async (sessionId: string) => {
    if (!followUpPrompt.trim()) return;

    setIsSpawning(true);
    try {
      const response = await fetch(`/api/agents/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: followUpPrompt.trim(),
          dangerousMode,
        }),
      });

      if (response.ok) {
        setFollowUpPrompt('');
        setFollowUpAgentId(null);
      } else {
        const error = await response.json();
        console.error('Resume failed:', error);
      }
    } catch (err) {
      console.error('Failed to resume agent:', err);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      zIndex: 1000,
      fontFamily: 'monospace',
      color: '#00FFFF',
      userSelect: 'none',
    }}>
      <div style={{
        background: 'rgba(0, 0, 20, 0.9)',
        border: '1px solid #00FFFF',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '320px',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', letterSpacing: '2px' }}>
            ◆ THE GRID
          </h2>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#00FF00' : '#FF0000',
            }} />
            {connected ? 'ONLINE' : 'OFFLINE'}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: '1px solid #00FFFF',
                color: '#00FFFF',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {expanded ? '−' : '+'}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            <div style={{
              fontSize: '11px',
              color: '#888',
              marginBottom: '12px',
              padding: '8px',
              background: 'rgba(0, 255, 255, 0.05)',
              borderRadius: '4px',
            }}>
              <div style={{ color: '#FFFF00', marginBottom: '4px' }}>WORKING DIR:</div>
              <div style={{ color: '#FFF', wordBreak: 'break-all' }}>{currentPath}</div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter task for agent..."
                style={{
                  width: '100%',
                  height: '60px',
                  background: 'rgba(0, 0, 40, 0.8)',
                  border: '1px solid #00FFFF',
                  borderRadius: '4px',
                  color: '#FFF',
                  padding: '8px',
                  fontSize: '12px',
                  resize: 'none',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleSpawn();
                  }
                }}
              />
              <button
                onClick={handleSpawn}
                disabled={isSpawning || !prompt.trim()}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  background: isSpawning || !prompt.trim() ? '#333' : (providers.find(p => p.id === selectedProvider)?.color || '#00FFFF'),
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: isSpawning || !prompt.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  letterSpacing: '1px',
                }}
              >
                {isSpawning ? '◌ SPAWNING...' : `▶ SPAWN ${(PROVIDER_DISPLAY[selectedProvider]?.label || selectedProvider).toUpperCase()}`}
              </button>

              {/* Provider Selector */}
              <div style={{ position: 'relative', marginTop: '8px' }}>
                <button
                  onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 40, 0.8)',
                    border: `1px solid ${providers.find(p => p.id === selectedProvider)?.color || '#00FFFF'}`,
                    borderRadius: '4px',
                    color: providers.find(p => p.id === selectedProvider)?.color || '#00FFFF',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {PROVIDER_DISPLAY[selectedProvider]?.icon} {PROVIDER_DISPLAY[selectedProvider]?.label || selectedProvider}
                  </span>
                  <span style={{ fontSize: '8px' }}>{showProviderDropdown ? '▲' : '▼'}</span>
                </button>

                {showProviderDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'rgba(0, 0, 20, 0.98)',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1002,
                  }}>
                    {providers.filter(p => p.spawnable).map(provider => (
                      <div
                        key={provider.id}
                        onClick={() => {
                          if (provider.available) {
                            setSelectedProvider(provider.id);
                            setShowProviderDropdown(false);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: provider.available ? 'pointer' : 'not-allowed',
                          opacity: provider.available ? 1 : 0.35,
                          background: selectedProvider === provider.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                          borderLeft: `3px solid ${provider.available ? provider.color : '#333'}`,
                        }}
                      >
                        <span style={{
                          color: provider.available ? provider.color : '#555',
                          fontSize: '11px',
                        }}>
                          {PROVIDER_DISPLAY[provider.id]?.icon} {provider.name}
                        </span>
                        {!provider.available && (
                          <span style={{ fontSize: '9px', color: '#666' }}>NOT FOUND</span>
                        )}
                        {provider.available && selectedProvider === provider.id && (
                          <span style={{ fontSize: '9px', color: provider.color }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                ⌘+Enter to launch
              </div>
            </div>

            {/* Dangerous Mode Toggle */}
            <div
              onClick={() => setDangerousMode(!dangerousMode)}
              style={{
                marginBottom: '12px',
                padding: '10px',
                background: dangerousMode ? 'rgba(255, 0, 102, 0.15)' : 'rgba(0, 255, 255, 0.05)',
                border: `1px solid ${dangerousMode ? '#FF0066' : '#00FFFF'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{dangerousMode ? '⚠️' : '🔒'}</span>
                  <span style={{
                    color: dangerousMode ? '#FF0066' : '#00FFFF',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                  }}>
                    {dangerousMode ? 'DANGEROUS MODE' : 'SAFE MODE'}
                  </span>
                </div>
                <div style={{
                  width: '36px',
                  height: '18px',
                  background: dangerousMode ? '#FF0066' : '#333',
                  borderRadius: '9px',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    background: '#FFF',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: dangerousMode ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
              {dangerousMode && (
                <div style={{
                  fontSize: '9px',
                  color: '#FF6666',
                  marginTop: '6px',
                }}>
                  Agent will bypass all permission prompts
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAllEvents(true)}
              style={{
                width: '100%',
                marginBottom: '12px',
                padding: '8px',
                background: 'rgba(255, 102, 0, 0.1)',
                border: '1px solid #FF6600',
                borderRadius: '4px',
                color: '#FF6600',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>◆ VIEW ALL EVENTS</span>
              <span style={{
                background: '#FF6600',
                color: '#000',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
              }}>{allEventsCount}</span>
            </button>

            <div>
              <div style={{
                fontSize: '11px',
                color: '#888',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>ACTIVE AGENTS</span>
                <span style={{ color: '#00FFFF' }}>{agents.length}</span>
              </div>

              {agents.length === 0 ? (
                <div style={{
                  fontSize: '11px',
                  color: '#444',
                  textAlign: 'center',
                  padding: '12px',
                }}>
                  No active agents
                </div>
              ) : (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {agents.map((agent) => (
                    <div
                      key={`${agent.sessionId}-${agent.agentType}`}
                      onClick={() => selectAgent(agent.sessionId)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        marginBottom: '4px',
                        background: selectedAgentId === agent.sessionId
                          ? 'rgba(0, 255, 255, 0.15)'
                          : 'rgba(0, 255, 255, 0.05)',
                        borderRadius: '4px',
                        borderLeft: `3px solid ${agent.color}`,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: agent.color, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {agent.agentType === 'main' ? '●' : '○'} {PROVIDER_DISPLAY[agent.provider || 'claude']?.icon || '●'} {getAgentName(agent.sessionId)}
                          {agent.status === 'completed' && (
                            <span style={{ fontSize: '9px', color: '#00FF00', padding: '1px 4px', background: 'rgba(0,255,0,0.1)', borderRadius: '3px' }}>DONE</span>
                          )}
                          {agent.status === 'error' && (
                            <span style={{ fontSize: '9px', color: '#FF0000', padding: '1px 4px', background: 'rgba(255,0,0,0.1)', borderRadius: '3px' }}>ERROR</span>
                          )}
                        </div>
                        <div style={{ fontSize: '9px', color: '#666' }}>
                          {agent.provider && PROVIDER_DISPLAY[agent.provider] ? PROVIDER_DISPLAY[agent.provider].label : ''}
                          {agent.provider ? ' · ' : ''}{agent.currentPath?.split('/').pop() || 'idle'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {agent.currentPath && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGoToAgent(agent.currentPath); }}
                            style={{
                              background: 'none',
                              border: '1px solid #FFFF00',
                              color: '#FFFF00',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              borderRadius: '3px',
                            }}
                            title={`Go to ${agent.currentPath}`}
                          >
                            GO TO
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); selectAgent(agent.sessionId); }}
                          style={{
                            background: 'none',
                            border: '1px solid #00FFFF',
                            color: '#00FFFF',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            borderRadius: '3px',
                          }}
                        >
                          LOGS
                        </button>
                        {agent.sessionId.startsWith('grid-') && agent.status === 'running' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleKill(agent.sessionId); }}
                            style={{
                              background: 'none',
                              border: '1px solid #FF0066',
                              color: '#FF0066',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              borderRadius: '3px',
                            }}
                          >
                            KILL
                          </button>
                        ) : agent.canResume && agent.status === 'completed' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setFollowUpAgentId(followUpAgentId === agent.sessionId ? null : agent.sessionId); }}
                            style={{
                              background: followUpAgentId === agent.sessionId ? '#00FF00' : 'none',
                              border: '1px solid #00FF00',
                              color: followUpAgentId === agent.sessionId ? '#000' : '#00FF00',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              borderRadius: '3px',
                            }}
                          >
                            CONTINUE
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(agent.sessionId); }}
                            style={{
                              background: 'none',
                              border: '1px solid #888',
                              color: '#888',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              borderRadius: '3px',
                            }}
                          >
                            REMOVE
                          </button>
                        )}
                      </div>
                      {/* Follow-up input for this agent */}
                      {followUpAgentId === agent.sessionId && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0, 255, 0, 0.2)' }}>
                          <textarea
                            value={followUpPrompt}
                            onChange={(e) => setFollowUpPrompt(e.target.value)}
                            placeholder="Enter follow-up message..."
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              height: '50px',
                              background: 'rgba(0, 40, 0, 0.5)',
                              border: '1px solid #00FF00',
                              borderRadius: '4px',
                              color: '#FFF',
                              padding: '8px',
                              fontSize: '11px',
                              resize: 'none',
                              fontFamily: 'monospace',
                              boxSizing: 'border-box',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.metaKey) {
                                handleResume(agent.sessionId);
                              }
                            }}
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResume(agent.sessionId); }}
                              disabled={isSpawning || !followUpPrompt.trim()}
                              style={{
                                flex: 1,
                                padding: '6px',
                                background: isSpawning || !followUpPrompt.trim() ? '#333' : '#00FF00',
                                border: 'none',
                                borderRadius: '3px',
                                color: '#000',
                                fontWeight: 'bold',
                                cursor: isSpawning || !followUpPrompt.trim() ? 'not-allowed' : 'pointer',
                                fontFamily: 'monospace',
                                fontSize: '10px',
                              }}
                            >
                              {isSpawning ? '◌ SENDING...' : '▶ SEND'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setFollowUpAgentId(null); setFollowUpPrompt(''); }}
                              style={{
                                padding: '6px 12px',
                                background: 'none',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                color: '#666',
                                cursor: 'pointer',
                                fontFamily: 'monospace',
                                fontSize: '10px',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedAgentId && !showAllEvents && (
        <LogPanel sessionId={selectedAgentId} onClose={() => selectAgent(null)} />
      )}

      {showAllEvents && (
        <AllEventsPanel onClose={() => setShowAllEvents(false)} />
      )}

      {showSearch && (
        <SearchPanel onClose={() => { setShowSearch(false); clearSearch(); }} />
      )}

      {showNavigator && (
        <FilesystemNavigator onClose={() => setShowNavigator(false)} />
      )}

      {isGitPanelOpen && (
        <GitControlPanel onClose={() => setGitPanelOpen(false)} />
      )}
    </div>
  );
}
