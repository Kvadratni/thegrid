import { useState, useRef, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Terminal, Box, GitBranch, Cpu, Github, ExternalLink, Zap, Shield, Layers, Monitor, Keyboard, Palette, Eye } from 'lucide-react';
import './index.css';

// ─── Content ──────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { name: 'Claude Code', color: '#00FFFF', icon: '●', install: 'npm i -g @zed-industries/claude-agent-acp', native: false, link: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code' },
  { name: 'Gemini CLI', color: '#4285F4', icon: '◆', install: 'Built-in (--experimental-acp)', native: true, link: 'https://github.com/google-gemini/gemini-cli' },
  { name: 'Codex CLI', color: '#10A37F', icon: '■', install: 'npm i -g @zed-industries/codex-acp', native: false, link: 'https://github.com/openai/codex' },
  { name: 'Goose', color: '#FF6600', icon: '▲', install: 'Built-in (goose acp)', native: true, link: 'https://block.github.io/goose/' },
  { name: 'Kilocode', color: '#E91E63', icon: '◎', install: 'npm i -g kilo-acp', native: false, link: 'https://github.com/Kvadratni/kilo-acp' },
  { name: 'OpenCode', color: '#76FF03', icon: '⬡', install: 'Built-in', native: true, link: null },
  { name: 'Kimi CLI', color: '#FF4081', icon: '✦', install: 'Built-in', native: true, link: null },
  { name: 'Aider', color: '#FF5252', icon: '▼', install: 'pip install aider-chat', native: false, link: 'https://aider.chat' },
  { name: 'Cline', color: '#009688', icon: '◇', install: 'VS Code extension', native: false, link: null },
  { name: 'Augment', color: '#3F51B5', icon: '◈', install: 'CLI tool', native: false, link: null },
  { name: 'Qwen Code', color: '#FFC107', icon: '◉', install: 'CLI tool', native: false, link: null },
  { name: 'GitHub Copilot', color: '#56B6C2', icon: '◆', install: 'CLI tool', native: false, link: null },
];

const TOOL_EFFECTS = [
  { tool: 'Bash', color: '#00FF88', description: 'Green binary digits (0/1) floating upward' },
  { tool: 'Read', color: '#4285F4', description: 'Blue scanning lines sweeping down the file' },
  { tool: 'Write', color: '#FFFFFF', description: 'White pages floating outward from the building' },
  { tool: 'Edit', color: '#FFFF00', description: 'Yellow/red +/- diff symbols animating around the file' },
  { tool: 'Grep/Glob', color: '#00FFFF', description: 'Cyan radar pulse rings expanding from the search location' },
  { tool: 'Task', color: '#FF6600', description: 'Orange particle burst for spawning subagents' },
  { tool: 'Delete', color: '#FF0000', description: 'Red explosion with crumbling fragments and physics particles' },
  { tool: 'Create', color: '#00FF00', description: 'Green file rising from the ground with a glow effect' },
];

function Navbar() {
  const location = useLocation();
  return (
    <nav className="navbar">
      <div className="container nav-container">
        <Link to="/" className="nav-logo">
          <Box className="w-6 h-6" />
          <span>THE_GRID</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Home</Link>
          <Link to="/docs" className={`nav-link ${location.pathname === '/docs' ? 'active' : ''}`}>Docs</Link>
          <Link to="/providers" className={`nav-link ${location.pathname === '/providers' ? 'active' : ''}`}>Providers</Link>
          <a href="https://github.com/Kvadratni/thegrid" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            GitHub <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </nav>
  );
}

function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setProgress(video.duration ? video.currentTime / video.duration : 0);
      setCurrentTime(video.currentTime);
    };
    const onLoaded = () => setDuration(video.duration);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-wrapper">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        src={`${import.meta.env.BASE_URL}grid-demo.mp4`}
        style={{ width: '100%', display: 'block', cursor: 'pointer' }}
        onClick={togglePlay}
      />
      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="video-play-overlay" onClick={togglePlay}>
          <div className="video-play-btn">▶</div>
        </div>
      )}
      {/* Custom controls bar */}
      <div className="video-controls">
        <button className="video-ctrl-btn mono" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="video-time mono">{formatTime(currentTime)}</span>
        <div className="video-progress" ref={progressBarRef} onClick={handleSeek}>
          <div className="video-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="video-time mono">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function LandingPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="pt-nav">
      {/* Hero Section */}
      <section className="section hero container">
        <h1 className="text-gradient mono">THE GRID</h1>
        <p className="hero-subtitle">A 3D Tron-inspired visualization environment for AI agent orchestration. Watch agents navigate your codebase as light cycles on neon highways, with real-time visual effects for every action.</p>

        <div className="hero-actions">
          <Link to="/docs" className="btn btn-primary">
            <Terminal size={18} /> Get Started
          </Link>
          <a href="https://github.com/Kvadratni/thegrid" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <Github size={18} /> View Source
          </a>
        </div>

        <HeroVideo />
      </section>

      {/* Stats Bar */}
      <section className="container" style={{ padding: '2rem 2rem 0' }}>
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value mono text-gradient">13+</span>
            <span className="stat-label">Supported Agents</span>
          </div>
          <div className="stat-item">
            <span className="stat-value mono text-gradient">8</span>
            <span className="stat-label">Tool Animations</span>
          </div>
          <div className="stat-item">
            <span className="stat-value mono text-gradient">ACP</span>
            <span className="stat-label">Protocol Native</span>
          </div>
          <div className="stat-item">
            <span className="stat-value mono text-gradient">3D</span>
            <span className="stat-label">Real-Time Engine</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section container">
        <h2 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '1rem' }}>SYSTEM_CAPABILITIES</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
          Every feature is designed to give you deep visibility into what your AI agents are doing, in real-time, in 3D.
        </p>
        <div className="features-grid">

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Box size={24} /></div>
            <h3 className="mono">3D File System</h3>
            <p>Directories map to neon road networks. Files rise as glowing buildings, color-coded by type. Navigate your entire codebase spatially.</p>
            <div style={{ marginTop: 'auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--neon-cyan-dim)' }}>
              <img src={`${import.meta.env.BASE_URL}img/filesystem.png`} alt="3D File System" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/filesystem.png`)} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Cpu size={24} /></div>
            <h3 className="mono">ACP-First Protocol</h3>
            <p>Pre-configured to securely run 13+ <Link to="/providers" style={{ color: 'var(--neon-cyan)' }}>ACP-enabled agents</Link> including Claude, Gemini, Codex, Goose, Kilocode, and more. Auto-detection ensures optimal connection.</p>
            <div style={{ marginTop: 'auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--neon-cyan-dim)' }}>
              <img src={`${import.meta.env.BASE_URL}img/agent.png`} alt="ACP-First Protocol HUD" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/agent.png`)} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Terminal size={24} /></div>
            <h3 className="mono">Running Processes</h3>
            <p>Floating indicators dynamically appear above directories to show active services (Node.js, Python, Vite, etc.) in real-time — see what's running on your grid.</p>
            <div style={{ marginTop: 'auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--neon-cyan-dim)' }}>
              <img src={`${import.meta.env.BASE_URL}img/running-process.png`} alt="Running Process Indicator" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/running-process.png`)} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Eye size={24} /></div>
            <h3 className="mono">Observer Mode</h3>
            <p>Automatically detects native unbridged agents and AI IDEs (Cursor, Windsurf, Anti-gravity) via OS-level process sniffing. Maps their file edits to distinct Light Cycles dynamically.</p>
            <div style={{ marginTop: 'auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--neon-cyan-dim)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
              <span className="mono" style={{ color: 'var(--neon-magenta)', fontSize: '0.9rem' }}>OBSERVER MODE [ ON ]</span>
            </div>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><GitBranch size={24} /></div>
            <h3 className="mono">Git Crystal Engine</h3>
            <p>Per-repo floating crystals glow cyan when clean, yellow when dirty. Orbiting green orbs count unpushed commits. Full source control HUD with branch switching, commit, push/pull.</p>
            <div style={{ marginTop: 'auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--neon-cyan-dim)' }}>
              <img src={`${import.meta.env.BASE_URL}img/git.png`} alt="Git Crystal" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/git.png`)} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          <div className="glass-panel feature-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="mono text-gradient">File Previews</h3>
            <p style={{ maxWidth: '800px', marginBottom: '1rem' }}>Click on any glowing file building to instantly access a rich, syntax-highlighted code preview. Supports text files, images, and even 3D models — all without leaving the grid.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <img src={`${import.meta.env.BASE_URL}img/text-preview.png`} alt="Text Preview" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/text-preview.png`)} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--neon-cyan-dim)', display: 'block' }} />
              <img src={`${import.meta.env.BASE_URL}img/image-preview.png`} alt="Image Preview" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/image-preview.png`)} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--neon-cyan-dim)', display: 'block' }} />
              <img src={`${import.meta.env.BASE_URL}img/3dmodel-preview.png`} alt="3D Model Preview" className="clickable-image" onClick={() => setSelectedImage(`${import.meta.env.BASE_URL}img/3dmodel-preview.png`)} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--neon-cyan-dim)', display: 'block' }} />
            </div>
          </div>

        </div>
      </section>

      {/* Tool Effects Section */}
      <section className="section container">
        <h2 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '1rem' }}>TOOL_EFFECTS</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
          Every tool call triggers a unique 3D animation at the exact file location, so you can see what your agents are doing at a glance.
        </p>
        <div className="effects-grid">
          {TOOL_EFFECTS.map((effect) => (
            <div key={effect.tool} className="glass-panel effect-card">
              <div className="effect-indicator" style={{ background: effect.color, boxShadow: `0 0 12px ${effect.color}` }} />
              <div>
                <h4 className="mono" style={{ color: effect.color, marginBottom: '0.25rem' }}>{effect.tool}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{effect.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Providers Preview */}
      <section className="section container">
        <h2 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '1rem' }}>SUPPORTED_AGENTS</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          13+ AI coding agents with automatic detection and provider-specific light cycle branding.
        </p>
        <div className="provider-pills">
          {PROVIDERS.map((p) => (
            <div key={p.name} className="provider-pill" style={{ borderColor: p.color, color: p.color }}>
              <span className="mono" style={{ fontSize: '1.1rem' }}>{p.icon}</span>
              <span>{p.name}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/providers" className="btn btn-primary">
            <Layers size={18} /> View All Providers
          </Link>
        </div>
      </section>

      {/* Architecture */}
      <section className="section container">
        <h2 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '2rem' }}>ARCHITECTURE</h2>
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
          <pre style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: '1.8', overflowX: 'auto' }}>{`
┌─────────────────┐     Stdin/Stdout      ┌──────────────────┐    WebSocket     ┌─────────────────┐
│  Claude / Gemini │ ◄──────────────────► │  Bridge Server   │ ◄──────────────► │   React + R3F   │
│  Codex / Goose   │   ACP Binary Proto   │   (Node.js)      │    Real-time     │   3D Frontend   │
│  Kilocode / ...  │                      │  + Providers     │    Events        │  + Provider UI  │
└─────────────────┘                       └──────────────────┘                  └─────────────────┘
          `}</pre>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--neon-cyan-dim)', padding: '2rem 0', textAlign: 'center', marginTop: '4rem' }}>
        <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>// INIT_SEQUENCE COMPLETED. THE GRID IS ONLINE.</p>
      </footer>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="lightbox-overlay" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Enlarged view" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function ProvidersPage() {
  return (
    <div className="pt-nav container section">
      <h1 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '3rem', marginBottom: '0.5rem' }}>AGENT_REGISTRY</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
        The Grid supports all of these AI coding agents. Each one gets its own unique light cycle color and auto-detection on your system.
      </p>

      <div className="providers-grid">
        {PROVIDERS.map((p) => (
          <div key={p.name} className="glass-panel provider-card">
            <div className="provider-header">
              <span className="provider-icon mono" style={{ color: p.color, textShadow: `0 0 10px ${p.color}` }}>{p.icon}</span>
              <h3 style={{ color: p.color }}>{p.name}</h3>
            </div>
            <div className="provider-color-bar" style={{ background: p.color }} />
            <div className="provider-details">
              <div className="provider-detail-row">
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>INSTALL</span>
                <code style={{ fontSize: '0.8rem', color: p.native ? 'var(--neon-green)' : 'var(--neon-magenta)' }}>
                  {p.install}
                </code>
              </div>
              <div className="provider-detail-row">
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>TYPE</span>
                <span style={{ fontSize: '0.85rem', color: p.native ? 'var(--neon-green)' : 'var(--neon-cyan)' }}>
                  {p.native ? '✓ Native ACP' : 'ACP Adapter'}
                </span>
              </div>
            </div>
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer" className="provider-link">
                Documentation <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsPage() {
  return (
    <div className="pt-nav container section">
      <div className="glass-panel" style={{ padding: '3rem' }}>
        <div className="docs-content">
          <h1>Documentation</h1>

          <h2>Quick Start</h2>
          <p>Get your local grid runner active in three simple commands.</p>

          <pre><code>{`# 1. Clone the repository
git clone https://github.com/Kvadratni/thegrid.git
cd thegrid

# 2. Install Dependencies
cd server && npm install
cd ../client && npm install

# 3. Initialize The Grid
cd server && npm run dev`}</code></pre>

          <blockquote>
            <p><strong>Note:</strong> The dev script automatically concurrently launches both the WebSocket agent bridge on port 3001 and the React Three.js visualizer on port 3000.</p>
          </blockquote>

          <a id="agent-config"></a>
          <h2>Agent Configuration</h2>
          <p>The Grid supports multiple AI agents via the <strong>Agent Client Protocol (ACP)</strong>. It will automatically detect installed adapter binaries on your <code>PATH</code>. Once an adapter is installed, launch an agent directly from The Grid's Provider Dropdown inside the HUD.</p>

          <h3>Installing ACP Adapters</h3>
          <pre><code>{`# Claude Code (via Zed's adapter)
npm install -g @zed-industries/claude-agent-acp

# Codex CLI (via Zed's adapter)
npm install -g @zed-industries/codex-acp

# Kilo Code
npm install -g kilo-acp`}</code></pre>

          <blockquote>
            <p><strong>Native ACP</strong> (no extra install needed): Gemini CLI (<code>--experimental-acp</code>), Goose (<code>goose acp</code>), OpenCode, Kimi CLI</p>
          </blockquote>

          <h2><Keyboard size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Controls</h2>

          <div className="controls-table">
            <table>
              <thead>
                <tr><th>Action</th><th>Control</th></tr>
              </thead>
              <tbody>
                <tr><td>Orbit Camera</td><td>Left-click drag</td></tr>
                <tr><td>Pan Camera</td><td>Right-click drag</td></tr>
                <tr><td>Zoom</td><td>Scroll wheel</td></tr>
                <tr><td>Navigate Directories</td><td>Click on directory buildings</td></tr>
                <tr><td>Open File Preview</td><td>Click on a file building</td></tr>
                <tr><td>Teleport to Origin</td><td>Press <code>O</code></td></tr>
                <tr><td>Search Files</td><td><code>Ctrl+F</code></td></tr>
                <tr><td>Folder Navigator</td><td><code>Ctrl+O</code></td></tr>
                <tr><td>Open Source Control</td><td>Click on a Git crystal</td></tr>
                <tr><td>Spawn Agent</td><td><code>⌘+Enter</code></td></tr>
              </tbody>
            </table>
          </div>

          <h2><Palette size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Visual Legend</h2>

          <div className="controls-table">
            <table>
              <thead>
                <tr><th>Element</th><th>Color</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td>Directories</td><td><span style={{ color: '#00FFFF' }}>■</span> Cyan</td><td>Folder nodes with road networks connecting them</td></tr>
                <tr><td>Code Files</td><td><span style={{ color: '#00FFFF' }}>■</span> Cyan</td><td>.ts, .js, .py, .rs, etc.</td></tr>
                <tr><td>Config Files</td><td><span style={{ color: '#FFFF00' }}>■</span> Yellow</td><td>.json, .yaml, .toml, etc.</td></tr>
                <tr><td>Documentation</td><td><span style={{ color: '#FF6600' }}>■</span> Orange</td><td>.md, .txt, .css, .html, etc.</td></tr>
                <tr><td>Running Process</td><td>Varies</td><td>Floating cube above directory</td></tr>
                <tr><td>Git Crystal (clean)</td><td><span style={{ color: '#00FFFF' }}>■</span> Cyan</td><td>No uncommitted changes</td></tr>
                <tr><td>Git Crystal (dirty)</td><td><span style={{ color: '#FFFF00' }}>■</span> Yellow</td><td>Uncommitted changes present</td></tr>
                <tr><td>Git Orbs</td><td><span style={{ color: '#00FF88' }}>■</span> Green</td><td>Each orb = one unpushed commit</td></tr>
              </tbody>
            </table>
          </div>

          <h2><Monitor size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />HUD Features</h2>
          <ul>
            <li><strong>Agent Panel</strong> — Shows active agents with real-time status indicators and provider colors</li>
            <li><strong>Event Log</strong> — Full activity feed with persistence across page refreshes</li>
            <li><strong>Spawn Agent</strong> — Launch any detected agent with a custom prompt</li>
            <li><strong>Dangerous Mode</strong> — Toggle to allow agents to bypass all permission prompts (applies <code>--dangerously-skip-permissions</code> for Claude, <code>--yolo</code> for Gemini)</li>
            <li><strong>Provider Selector</strong> — Dropdown to pick which AI agent to spawn, with auto-detection</li>
            <li><strong>Directory Navigation</strong> — Change the visualized directory from the HUD</li>
            <li><strong>Source Control Panel</strong> — Draggable Git panel with branch switching, commit, push/pull, and new branch creation</li>
          </ul>

          <h2><Zap size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />File System Watching</h2>
          <p>The Grid uses <strong>native OS filesystem watching</strong> (<code>fs.watch</code>) to detect file changes in real-time. When an agent creates, modifies, or deletes a file, the 3D visualization updates instantly — no polling or delays.</p>
          <ul>
            <li><strong>File Creation</strong> — New buildings rise from the ground with a green glow effect</li>
            <li><strong>File Deletion</strong> — Buildings explode into physics-based particles with red crumbling fragments</li>
            <li><strong>File Modification</strong> — The grid layout instantly recalculates to reflect new state</li>
          </ul>

          <h2><Shield size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Architecture</h2>
          <p>The Grid is composed of a <strong>Node.js/Express bridge server</strong> and a <strong>React Three.js frontend</strong>. The server bridges ACP binary protocols over stdin/stdout directly to a WebSocket stream, propagating tool calls, diffs, and bash events to the 3D client.</p>

          <h3>Tech Stack</h3>
          <div className="controls-table">
            <table>
              <thead>
                <tr><th>Component</th><th>Technology</th></tr>
              </thead>
              <tbody>
                <tr><td>Server</td><td>Node.js, Express, WebSocket (ws)</td></tr>
                <tr><td>Agent Protocol</td><td>ACP SDK (<code>@agentclientprotocol/sdk</code>)</td></tr>
                <tr><td>Frontend</td><td>React 18, TypeScript, Vite</td></tr>
                <tr><td>3D Engine</td><td>Three.js via @react-three/fiber</td></tr>
                <tr><td>State</td><td>Zustand with localStorage persistence</td></tr>
                <tr><td>File Watching</td><td>Native <code>fs.watch</code> (recursive)</td></tr>
              </tbody>
            </table>
          </div>

          <h2>Troubleshooting</h2>

          <h3>ACP Agent Delay on macOS</h3>
          <p>If you experience a long delay (10+ seconds) between spawning an agent and seeing the first log output, it is likely due to <strong>stdio buffering</strong> in Node.js.</p>
          <p>The Grid automatically attempts to fix this by wrapping the agent process with <code>stdbuf</code> (Linux) or <code>gstdbuf</code> (macOS). <strong>macOS Users:</strong> To enable this fix, you must install the <code>coreutils</code> package:</p>
          <pre><code>brew install coreutils</code></pre>
          <p>If <code>gstdbuf</code> is not found, The Grid will fall back to the standard buffered mode, and you may continue to experience delays.</p>

          <h3>Missing "Continue" Button for Gemini</h3>
          <p>The <strong>Continue</strong> button is intentionally disabled for Gemini agents. The current <code>gemini --experimental-acp</code> implementation does not support stateful session resumption. This feature will be re-enabled once the underlying protocol supports it.</p>

        </div>
      </div>
    </div>
  );
}

function AudioPlayer() {
  const [collapsed, setCollapsed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Set initial volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
  }, []);

  // Listen for the splash screen dismissal to start playback
  useEffect(() => {
    const handler = () => {
      const audio = audioRef.current;
      if (audio && audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => { });
      }
    };
    window.addEventListener('splash-dismissed', handler, { once: true });
    return () => window.removeEventListener('splash-dismissed', handler);
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}grid-theme.mp3`} loop preload="auto" />
      <div className="audio-player" style={{ opacity: collapsed ? 0.6 : 1 }}>
        <button
          className="suno-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand player' : 'Collapse player'}
        >
          {collapsed ? '♫' : '✕'}
        </button>
        {!collapsed && (
          <div className="audio-panel glass-panel">
            <div className="audio-title mono">♫ Chromed Ghosts</div>
            <div className="audio-controls">
              <button className="audio-play-btn mono" onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolume}
                className="audio-volume"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SplashScreen({ onDismiss }: { onDismiss: () => void }) {
  const [isFading, setIsFading] = useState(false);

  const handleClick = () => {
    if (isFading) return;
    setIsFading(true);
    // Dispatch event so audio player knows user gesture happened
    window.dispatchEvent(new Event('splash-dismissed'));

    // Wait for fade animation to finish before unmounting
    setTimeout(() => {
      onDismiss();
    }, 1000);
  };

  return (
    <div className={`splash-screen ${isFading ? 'fade-out' : ''}`} onClick={handleClick}>
      <div className="splash-content">
        <div className="splash-logo mono text-gradient">THE GRID</div>
        <h1 className="splash-title">Are you ready to experience the grid?</h1>
        <p className="splash-subtitle mono">[ CLICK ANYWHERE TO INITIALIZE ]</p>
      </div>
      <div className="splash-grid-bg"></div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}

      <div className={`app-wrapper ${!showSplash ? 'visible' : ''}`}>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
          </Routes>
          <AudioPlayer />
        </Router>
      </div>
    </>
  );
}

export default App;
