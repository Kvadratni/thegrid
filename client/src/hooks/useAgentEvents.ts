import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore, AgentEvent, AgentState, FileSystemNode, ProcessInfo } from '../stores/agentStore';

interface ServerMessage {
  type: 'event' | 'agents' | 'filesystem' | 'error' | 'filesystemChange' | 'processes';
  payload: AgentEvent | AgentState[] | FileSystemNode | { message: string } | { action: string; path?: string } | ProcessInfo[];
}

const WS_URL = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_DELAY = 3000;
const FILESYSTEM_REFRESH_DELAY = 1000;

export function useAgentEvents() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const filesystemRefreshTimeoutRef = useRef<number | null>(null);
  const currentPathRef = useRef<string>('');

  const { setAgents, setFileSystem, addEvent, setConnected, setProcesses, currentPath, filesystemDirty } = useAgentStore();

  // Keep ref in sync with state
  currentPathRef.current = currentPath;

  const connect = useCallback(() => {
    // Check for both OPEN and CONNECTING states to prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔷 Connected to The Grid');
      setConnected(true);

      ws.send(JSON.stringify({ type: 'getFilesystem', path: currentPathRef.current }));
    };

    ws.onmessage = (event) => {
      // Ignore messages from stale connections
      if (ws !== wsRef.current) return;

      try {
        const message = JSON.parse(event.data) as ServerMessage;

        switch (message.type) {
          case 'event':
            addEvent(message.payload as AgentEvent);
            break;
          case 'agents':
            setAgents(message.payload as AgentState[]);
            break;
          case 'filesystem':
            setFileSystem(message.payload as FileSystemNode);
            break;
          case 'filesystemChange': {
            const change = message.payload as { action: string; path?: string };
            console.log('📂 Filesystem change:', change.action, change.path);
            requestFilesystem(currentPathRef.current);
            break;
          }
          case 'processes':
            setProcesses(message.payload as ProcessInfo[]);
            break;
          case 'error':
            console.error('Server error:', (message.payload as { message: string }).message);
            break;
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔷 Disconnected from The Grid');
      setConnected(false);

      // Only clear ref and reconnect if this is still the current connection
      if (ws === wsRef.current) {
        wsRef.current = null;

        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('🔷 Attempting to reconnect...');
          connect();
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [setAgents, setFileSystem, addEvent, setConnected, setProcesses]);

  const requestFilesystem = useCallback((path: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getFilesystem', path }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Clear the ref first to prevent onclose from triggering reconnect
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);

  useEffect(() => {
    requestFilesystem(currentPath);
  }, [currentPath, requestFilesystem]);

  useEffect(() => {
    if (filesystemDirty === 0) return;

    if (filesystemRefreshTimeoutRef.current) {
      clearTimeout(filesystemRefreshTimeoutRef.current);
    }

    filesystemRefreshTimeoutRef.current = window.setTimeout(() => {
      console.log('🔷 Refreshing filesystem after file change');
      requestFilesystem(currentPath);
    }, FILESYSTEM_REFRESH_DELAY);

    return () => {
      if (filesystemRefreshTimeoutRef.current) {
        clearTimeout(filesystemRefreshTimeoutRef.current);
      }
    };
  }, [filesystemDirty, currentPath, requestFilesystem]);

  return { requestFilesystem };
}
