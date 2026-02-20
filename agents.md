# Agents

## Agent Providers

| Provider | CLI Command | Color | Icon |
|----------|-------------|-------|------|
| Claude Code | `claude` | Cyan (#00FFFF) | ● |
| Gemini CLI | `gemini` | Blue (#4285F4) | ◆ |
| Codex CLI | `codex` | Green (#10A37F) | ■ |
| Goose | `goose` | Orange (#FF6600) | ▲ |
| Kilocode | `kilocode` | Magenta (#E91E63) | ◎ |
| OpenCode | `opencode` | Lime (#76FF03) | ⬡ |
| Kimi CLI | `kimi` | Pink (#FF4081) | ✦ |
| Cline | `cline` | Teal (#009688) | ◇ |
| Augment | `augment` | Indigo (#3F51B5) | ⬢ |
| Qwen Code | `qwen` | Amber (#FFC107) | ★ |
| Aider | `aider` | Red (#FF5252) | ▼ |
| GitHub Copilot | `github-copilot` | Sky Blue (#56B6C2) | ◈ |
| Generic | — | Purple (#AA00FF) | ○ |

## Agent Types

| Type | Indicator |
|------|-----------|
| main | ● |
| subagent | ○ |

## Provider Auto-Detection

The Grid server auto-detects installed CLI tools:

```
GET /api/providers
```

Returns JSON with each provider's `id`, `name`, `color`, `available`, and `spawnable` status.

## Tool Name Normalization

Different agents use different names for the same operations. The Grid normalizes them:

| Operation | Claude | Gemini | Codex | Goose | Grid Normal |
|-----------|--------|--------|-------|-------|-------------|
| Read file | Read | ReadFile | read_file | read | Read |
| Write file | Write | WriteFile | write_file | write | Write |
| Edit file | Edit | EditFile | patch | edit | Edit |
| Run command | Bash | ExecuteCommand | shell | bash | Bash |
| Search | Grep | Search | grep | grep | Grep |
| List files | Glob | ListFiles | ls | list | Glob |

## Agent Events

Events are received via hooks or spawned process stdout:

```typescript
interface AgentEvent {
  timestamp: string;
  sessionId: string;
  hookEvent: 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'SessionEnd' | ...;
  toolName?: string;
  filePath?: string;
  agentType: 'main' | 'subagent';
  provider?: AgentProvider;
  details?: Record<string, unknown>;
}
```

## Spawning Agents

Agents can be spawned from The Grid UI with a provider selector:

```
POST /api/agents/spawn
{
  "workingDirectory": "/path/to/project",
  "prompt": "Task description",
  "provider": "claude",
  "dangerousMode": false
}
```

Spawned agents have session IDs prefixed with `grid-`.

## Universal Hook

For agents not natively supported, use the universal hook:

```bash
chmod +x hooks/universal-hook.sh
GRID_PROVIDER=gemini bash hooks/universal-hook.sh
```

Or POST events directly to `/api/events`.

## Terminating Agents

```
DELETE /api/agents/:sessionId
```
