import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Terminal, Box, GitBranch, Cpu, Github, ExternalLink } from 'lucide-react';
import './index.css';

// ─── Content ──────────────────────────────────────────────────────────────────

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
          <a href="https://github.com/Kvadratni/thegrid" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            GitHub <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </nav>
  );
}

function LandingPage() {
  return (
    <div className="pt-nav">
      {/* Hero Section */}
      <section className="section hero container">
        <h1 className="text-gradient mono">AGENT ORCHESTRATION VISUALIZER</h1>
        <p>A 3D Tron-inspired visualization of AI agent activity. Watch agents navigate your codebase as light cycles on neon highways, with real-time visual effects.</p>

        <div className="hero-actions">
          <Link to="/docs" className="btn btn-primary">
            <Terminal size={18} /> Get Started
          </Link>
          <a href="https://github.com/Kvadratni/thegrid" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <Github size={18} /> View Source
          </a>
        </div>

        <div className="video-wrapper">
          <img
            src={`/thegrid/demo.webp`}
            alt="The Grid Agent Orchestration Demo"
            style={{ width: '100%', display: 'block' }}
          />
          <div className="video-overlay"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section container">
        <h2 className="text-gradient mono" style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '1rem' }}>SYSTEM_CAPABILITIES</h2>
        <div className="features-grid">

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Box size={24} /></div>
            <h3 className="mono">3D File System</h3>
            <p>Directories map to neon road networks while files rise as glowing buildings. Real-time file creation and deletion animations.</p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Cpu size={24} /></div>
            <h3 className="mono">ACP-First Protocol</h3>
            <p>Pre-configured to securely run 13+ <a href="#/docs" style={{ color: 'var(--neon-cyan)' }}>ACP-enabled agents</a> including Claude, Kilo, and Gemini. Auto-detection ensures optimal connection.</p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><Terminal size={24} /></div>
            <h3 className="mono">Running Processes</h3>
            <p>Floating indicators dynamically appear above directories to show active services (Node.js, Python, Vite, etc.) in real-time, visualizing what is actually running on your grid.</p>
            {/* PROCESS_SCREENSHOT_PLACEHOLDER */}
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon"><GitBranch size={24} /></div>
            <h3 className="mono">Git Crystal Engine</h3>
            <p>Per-repo floating crystals indicate cleanliness (cyan/yellow) with orbiting orbs for unpushed commits. Full source control HUD included.</p>
          </div>

          <div className="glass-panel feature-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="mono text-gradient">File Previews</h3>
            <p style={{ maxWidth: '800px', marginBottom: '1rem' }}>Click on any glowing file building to instantly access a rich, syntax-highlighted code preview without leaving the grid. See exactly what your agents are modifying in real-time.</p>
            {/* FILE_PREVIEW_SCREENSHOT_PLACEHOLDER */}
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--neon-cyan-dim)', padding: '2rem 0', textAlign: 'center', marginTop: '4rem' }}>
        <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>// INIT_SEQUENCE COMPLETED. THE GRID IS ONLINE.</p>
      </footer>
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

          <h3>Supported Agents & Setup</h3>
          <ul>
            <li><strong><a href="https://docs.anthropic.com/en/docs/agents-and-tools/claude-code" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>Claude Code</a></strong>: <code>npm i -g @zed-industries/claude-agent-acp</code></li>
            <li><strong><a href="https://github.com/Kvadratni/kilo-acp" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>Kilo Code</a></strong>: <code>npm i -g kilo-acp</code></li>
            <li><strong><a href="https://github.com/zed-industries/codex-acp" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>Codex CLI</a></strong>: <code>npm i -g @zed-industries/codex-acp</code></li>
            <li><strong>Gemini CLI</strong>: Supported natively via the <code>--experimental-acp</code> flag. Ensure the <code>gemini</code> command is available.</li>
            <li><strong><a href="https://block.github.io/goose/" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>Goose</a></strong>: Supported natively via the <code>goose acp</code> subcommand.</li>
            <li><strong>OpenCode</strong> & <strong>Kimi CLI</strong>: Supported natively.</li>
          </ul>

          <h2>Architecture</h2>
          <p>The Grid is composed of a Node.js/Express bridge server and a React Three.js frontend. The node server bridges the gap between ACP binary protocols over Stdin/Stdout directly to a WebSocket stream, propagating tool calls, diffs, and bash events to the 3D client.</p>

        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
