# The Grid - Agent Orchestration Visualizer

A 3D Tron-inspired visualization of AI agent activity. Watch agents from **Claude Code, Gemini CLI, Codex, Goose, Kilocode, OpenCode, Aider**, and more navigate your codebase as light cycles on neon highways, with real-time visual effects for every action.

## Features

- **3D File System Visualization** - Directories as neon road networks, files as glowing buildings
- **Multi-Agent Support** - 13+ ACP-enabled agents with auto-detection and provider-specific colors
- **Agent Light Cycles** - Watch agents move through your codebase in real-time, each provider with unique branding
- **Tool-Specific Effects** - Distinct animations for each tool type:
  - Bash: Green binary digits (0/1) floating upward
  - Read: Blue scanning lines sweeping down
  - Write: White pages floating outward
  - Edit: Yellow/red +/- diff symbols
  - Grep/Glob: Cyan radar pulse rings
  - Task: Orange particle burst for spawning
- **File Animations** - Files rise from the ground when created, crumble when deleted
- **Process Visualization** - Floating indicators show running services (Node.js, Python, Vite, etc.)
- **Event Logging** - Full activity log with persistence across refreshes
- **Dangerous Mode** - Toggle to allow agents to bypass permission prompts

## Quick Start

### 1. Install Dependencies

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Start the Bridge Server

```bash
cd server && npm run dev
```

Server runs on http://localhost:3001

### 3. Start the Frontend

```bash
cd client && npm run dev
```

Frontend runs on http://localhost:3000

### 4. Configure Claude Code Hooks

Make the hook executable and add to your Claude settings:

```bash
chmod +x hooks/activity-reporter.sh
```

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": {},
        "hooks": ["bash /path/to/thegrid/hooks/activity-reporter.sh"]
      }
    ],
    "PostToolUse": [
      {
        "matcher": {},
        "hooks": ["bash /path/to/thegrid/hooks/activity-reporter.sh"]
      }
    ]
  }
}
```

## Architecture

```
┌─────────────────┐     HTTP POST      ┌──────────────────┐    WebSocket    ┌─────────────────┐
│ Claude / Gemini  │ ─────────────────► │  Bridge Server   │ ◄─────────────► │   React + R3F   │
│ Codex / Goose   │  (hooks or spawn)  │   (Node.js)      │                 │   3D Frontend   │
│ Kilocode / ...  │                    │  + Providers     │                 │  + Provider UI  │
└─────────────────┘                    └──────────────────┘                 └─────────────────┘
```

## Controls

| Action | Control |
|--------|---------|
| Orbit Camera | Left-click drag |
| Pan Camera | Right-click drag |
| Zoom | Scroll wheel |
| Navigate Directories | Click on directory buildings |
| Teleport to Origin | Press `O` or click origin button |
| Search Files | Use search bar in HUD |

## HUD Features

- **Agent Panel** - Shows active agents with status indicators
- **Event Log** - Real-time feed of all agent activities
- **Spawn Agent** - Launch new Claude agents with custom prompts
- **Dangerous Mode Toggle** - Enable/disable permission bypass
- **Directory Navigation** - Change the visualized directory

## Visual Legend

| Element | Color | Description |
|---------|-------|-------------|
| Claude Agent | Cyan (#00FFFF) | Claude Code CLI |
| Gemini Agent | Blue (#4285F4) | Google Gemini CLI |
| Codex Agent | Green (#10A37F) | OpenAI Codex CLI |
| Goose Agent | Orange (#FF6600) | Block's Goose |
| Kilocode Agent | Magenta (#E91E63) | Kilocode CLI |
| OpenCode Agent | Lime (#76FF03) | OpenCode CLI |
| Other Agents | Various | Each provider has a unique color |
| Directories | Cyan | Folder nodes with roads connecting |
| Code Files | Cyan | .ts, .js, .py, .rs, etc. |
| Config Files | Yellow | .json, .yaml, .toml, etc. |
| Documentation | Magenta | .md, .txt, .rst, etc. |
| Running Process | Varies by type | Floating cube above directory |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Node.js, Express, WebSocket (ws) |
| Frontend | React 18, TypeScript, Vite |
| 3D Engine | Three.js via @react-three/fiber |
| State | Zustand with persistence |

## Project Structure

```
thegrid/
├── server/                    # WebSocket bridge server
│   ├── index.ts              # Express + WebSocket server
│   ├── providers.ts          # Agent provider configs & stream parsers
│   └── types.ts              # TypeScript interfaces
├── client/                    # React + Three.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TronScene.tsx      # Main 3D scene
│   │   │   ├── FileSystem.tsx     # Directory/file visualization
│   │   │   ├── LightCycle.tsx     # Agent representation (provider-branded)
│   │   │   ├── HUD.tsx            # 2D overlay w/ provider selector
│   │   │   └── effects/           # Visual effect components
│   │   ├── hooks/
│   │   │   └── useAgentEvents.ts  # WebSocket connection
│   │   ├── stores/
│   │   │   └── agentStore.ts      # Zustand state (multi-provider)
│   │   └── utils/
│   │       └── fileSystemLayout.ts
├── hooks/
│   ├── activity-reporter.sh  # Claude Code hook script
│   └── universal-hook.sh     # Universal hook for any agent
└── claude-settings.json      # Hook configuration template
```

## License

MIT
