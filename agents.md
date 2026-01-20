# Agents

## Agent Types

| Type | Color | Indicator |
|------|-------|-----------|
| main | Cyan (#00FFFF) | ● |
| subagent | Orange (#FF6600) | ○ |

## Agent State

```typescript
interface AgentState {
  sessionId: string;
  agentType: 'main' | 'subagent';
  currentPath?: string;
  lastActivity: string;
  color: string;
}
```

## Agent Events

Events are received via Claude Code hooks and contain:

```typescript
interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'SessionEnd' | 'SubagentStart' | 'SubagentStop';
  toolName?: string;
  filePath?: string;
  agentType: 'main' | 'subagent';
  details?: Record<string, unknown>;
}
```

## Supported Tools

- Read
- Write
- Edit
- Bash
- Glob
- Grep
- Task
- WebFetch
- WebSearch
- TodoWrite
- AskUserQuestion

## Spawning Agents

Agents can be spawned from The Grid UI:

```
POST /api/agents/spawn
{
  "workingDirectory": "/path/to/project",
  "prompt": "Task description"
}
```

Spawned agents have session IDs prefixed with `grid-`.

## Terminating Agents

```
DELETE /api/agents/:sessionId
```

## Future Agents

<!-- Add planned agent types and capabilities here -->
