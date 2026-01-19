# The Grid - Agent Orchestration Visualizer

A 3D Tron-inspired visualization of Claude Code agent activity.

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

Copy the hook configuration to your Claude settings:

```bash
# Option A: Global hooks (all projects)
cp claude-settings.json ~/.claude/settings.json

# Option B: Project-specific hooks
cp claude-settings.json /path/to/your/project/.claude/settings.json
```

Or manually add the hooks from `claude-settings.json` to your existing settings.

## Architecture

```
Claude Code + Hooks  -->  Bridge Server (Node.js)  <-->  React + Three.js Frontend
     POST /api/events          WebSocket /ws
```

## Controls

- **Orbit**: Left-click drag
- **Pan**: Right-click drag
- **Zoom**: Scroll wheel
- **Navigate**: Click directories to expand

## Color Legend

| Element | Color |
|---------|-------|
| Main Agent | Cyan (#00FFFF) |
| Subagent | Orange (#FF6600) |
| Directories | Cyan |
| Code Files | Cyan |
| Config Files | Yellow |
| Docs/Text | Magenta |
