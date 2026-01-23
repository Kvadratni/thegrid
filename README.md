# The Grid - Agent Orchestration Visualizer

A 3D Tron-inspired visualization of Claude Code agent activity. Watch AI agents navigate your codebase as light cycles on neon highways, with real-time visual effects for every action.

## Features

- **3D File System Visualization** - Directories as neon road networks, files as glowing buildings
- **Agent Light Cycles** - Watch Claude agents move through your codebase in real-time
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
│   Claude Code   │ ─────────────────► │  Bridge Server   │ ◄─────────────► │   React + R3F   │
│     + Hooks     │                    │   (Node.js)      │                 │   3D Frontend   │
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
| Main Agent | Cyan (#00FFFF) | Primary Claude Code agent |
| Subagent | Orange (#FF6600) | Spawned sub-agents (Task tool) |
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
│   └── types.ts              # TypeScript interfaces
├── client/                    # React + Three.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TronScene.tsx      # Main 3D scene
│   │   │   ├── FileSystem.tsx     # Directory/file visualization
│   │   │   ├── LightCycle.tsx     # Agent representation
│   │   │   ├── HUD.tsx            # 2D overlay interface
│   │   │   └── effects/           # Visual effect components
│   │   ├── hooks/
│   │   │   └── useAgentEvents.ts  # WebSocket connection
│   │   ├── stores/
│   │   │   └── agentStore.ts      # Zustand state management
│   │   └── utils/
│   │       └── fileSystemLayout.ts
├── hooks/
│   └── activity-reporter.sh  # Claude Code hook script
└── claude-settings.json      # Hook configuration template
```

## License

MIT
