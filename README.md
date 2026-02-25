# The Grid - Agent Orchestration Visualizer

A 3D Tron-inspired visualization of AI agent activity. Watch agents from **Claude Code, Gemini CLI, Codex, Goose, Kilocode, OpenCode, Aider**, and AI IDEs like **Cursor, Windsurf, Anti-gravity, and Copilot** navigate your codebase as light cycles on neon highways, with real-time visual effects for every action.

## Features

- **3D File System Visualization** - Directories as neon road networks, files as glowing buildings
- **Multi-Agent Support** - 13+ agents with auto-detection and provider-specific colors
- **ACP-First Protocol** - Prefers Agent Client Protocol when available, with automatic fallback to legacy parsing
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
- **Git Crystal Engine** - Per-repository floating crystals with real-time status:
  - Crystal glows **cyan** when clean, **yellow** when dirty (uncommitted changes)
  - **Orbiting green orbs** show unpushed commit count
  - **Floating billboard label** displays current branch name (always faces camera)
  - Animated effects on commit (swell), push/pull (beam + spin), and checkout (fast spin)
- **Source Control Panel** - Draggable HUD for full Git operations:
  - Branch dropdown with local + remote branches
  - Create new branches inline
  - Commit, push, and pull with one click
  - Changed files list with color-coded status indicators
  - Recent commit log
- **Multi-Repo Detection** - Auto-discovers all Git repositories under the workspace
- **Event Logging** - Full activity log with persistence across refreshes
- **Observer Mode** - Automatically detects *unbridged* native agents running on your machine (Cursor, Windsurf, Anti-gravity, Copilot, Aider, Goose, etc.), assigns them a physical form on The Grid, and uses heuristic scoring and OS-level file events to physically attribute their actions without requiring any hooks or adapters.
- **Dangerous Mode** - Toggle to allow agents to bypass permission prompts

## ACP Protocol Support

The Grid uses [Agent Client Protocol (ACP)](https://agentclientprotocol.com) as the **default** for spawning agents. If an ACP binary is detected on your system, it is used automatically. Otherwise, The Grid falls back to legacy stdout-based parsing.

### Installing ACP Adapters

```bash
# Claude Code (via Zed's adapter)
npm install -g @zed-industries/claude-agent-acp

# Codex CLI (via Zed's adapter)
npm install -g @zed-industries/codex-acp

# Kilo Code
npm install -g kilo-acp
```

**Native ACP** (no extra install needed): Gemini CLI (`--experimental-acp`), Goose (`goose acp`), OpenCode, Kimi CLI

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

## Troubleshooting

### ACP Agent Delay on macOS
If you experience a long delay (10+ seconds) between spawning an agent and seeing the first log output, it is likely due to **stdio buffering** in Node.js.

The Grid automatically attempts to fix this by wrapping the agent process with `stdbuf` (Linux) or `gstdbuf` (macOS).
**macOS Users:** To enable this fix, you must install the `coreutils` package:
```bash
brew install coreutils
```
If `gstdbuf` is not found, The Grid will fall back to the standard buffered mode, and you may continue to experience delays.

### Missing "Continue" Button for Gemini
The **Continue** button is intentionally disabled for Gemini agents. The current `gemini --experimental-acp` implementation does not support stateful session resumption. This feature will be re-enabled once the underlying protocol supports it.

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
| Open Source Control | Click on a Git crystal |

## HUD Features

- **Agent Panel** - Shows active agents with status indicators
- **Event Log** - Real-time feed of all agent activities
- **Spawn Agent** - Launch new Claude agents with custom prompts
- **Dangerous Mode Toggle** - Enable/disable permission bypass
- **Directory Navigation** - Change the visualized directory
- **Source Control Panel** - Draggable Git panel with branch switching, commit, push/pull, and new branch creation

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
| Git Crystal (clean) | Cyan (#00FFFF) | No uncommitted changes |
| Git Crystal (dirty) | Yellow (#FFFF00) | Uncommitted changes present |
| Git Orbs | Green (#00FF88) | Each orb = one unpushed commit |
| Branch Label | Cyan | Floating billboard text above crystal |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Node.js, Express, WebSocket (ws) |
| Agent Protocol | ACP SDK (`@agentclientprotocol/sdk`) |
| Frontend | React 18, TypeScript, Vite |
| 3D Engine | Three.js via @react-three/fiber |
| State | Zustand with persistence |

## Project Structure

```
thegrid/
├── server/                    # WebSocket bridge server
│   ├── index.ts              # Express + WebSocket + Git API server
│   ├── acp-client.ts         # ACP protocol client (bidirectional NDJSON)
│   ├── git.ts                # Git operations (status, branch, checkout, push/pull)
│   ├── providers.ts          # Agent provider configs & stream parsers
│   └── types.ts              # TypeScript interfaces
├── client/                    # React + Three.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TronScene.tsx      # Main 3D scene
│   │   │   ├── FileSystem.tsx     # Directory/file visualization
│   │   │   ├── LightCycle.tsx     # Agent representation (provider-branded)
│   │   │   ├── GitEngine.tsx      # 3D Git crystal per repository
│   │   │   ├── GitControlPanel.tsx # Draggable source control HUD
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
