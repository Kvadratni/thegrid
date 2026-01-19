import { useState, useEffect, useRef } from 'react';
import { useAgentStore, AgentEvent } from '../stores/agentStore';

function SearchPanel({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useAgentStore((state) => state.searchQuery);
  const searchResults = useAgentStore((state) => state.searchResults);
  const highlightedPath = useAgentStore((state) => state.highlightedPath);
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
      const parentPath = highlightedPath.split('/').slice(0, -1).join('/');
      setCurrentPath(parentPath);
      onClose();
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
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #666',
            color: '#666',
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          ESC
        </button>
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
                const parentPath = path.split('/').slice(0, -1).join('/');
                setCurrentPath(parentPath);
                onClose();
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
          [...logs].reverse().map((event: AgentEvent, i: number) => (
            <div
              key={i}
              style={{
                padding: '8px',
                marginBottom: '4px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                borderLeft: `2px solid ${event.toolName ? '#FFFF00' : '#666'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#FFFF00', fontSize: '11px' }}>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function HUD() {
  const [prompt, setPrompt] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const currentPath = useAgentStore((state) => state.currentPath);
  const agents = useAgentStore((state) => state.agents);
  const connected = useAgentStore((state) => state.connected);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const selectAgent = useAgentStore((state) => state.selectAgent);
  const clearSearch = useAgentStore((state) => state.clearSearch);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
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
                  background: isSpawning || !prompt.trim() ? '#333' : '#00FFFF',
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
                {isSpawning ? '◌ SPAWNING...' : '▶ SPAWN AGENT'}
              </button>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                ⌘+Enter to launch
              </div>
            </div>

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
                        <div style={{ fontSize: '11px', color: agent.color, fontWeight: 'bold' }}>
                          {agent.agentType === 'main' ? '●' : '○'} {getAgentName(agent.sessionId)}
                        </div>
                        <div style={{ fontSize: '9px', color: '#666' }}>
                          {agent.currentPath?.split('/').pop() || 'idle'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
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
                        {agent.sessionId.startsWith('grid-') && (
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedAgentId && (
        <LogPanel sessionId={selectedAgentId} onClose={() => selectAgent(null)} />
      )}

      {showSearch && (
        <SearchPanel onClose={() => { setShowSearch(false); clearSearch(); }} />
      )}
    </div>
  );
}
