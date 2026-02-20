import { useState, useEffect } from 'react';
import { useAgentStore } from '../stores/agentStore';

interface Props { onClose: () => void }

export default function GitControlPanel({ onClose }: Props) {
    const activeGitRepoPath = useAgentStore(state => state.activeGitRepoPath);
    const setActiveGitRepoPath = useAgentStore(state => state.setActiveGitRepoPath);
    const triggerGitAnimation = useAgentStore(state => state.triggerGitAnimation);

    const [gitBranch, setGitBranch] = useState('');
    const [gitStatus, setGitStatus] = useState<Array<{ path: string; status: string }>>([]);
    const [gitLog, setGitLog] = useState<Array<{ hash: string; message: string; author: string; date: string }>>([]);
    const [commitMsg, setCommitMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const pathParam = activeGitRepoPath ? `?path=${encodeURIComponent(activeGitRepoPath)}` : '';
    const repoLabel = activeGitRepoPath ? activeGitRepoPath.split('/').pop() : 'workspace';

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/git/status${pathParam}`);
            if (res.ok) {
                const data = await res.json();
                setGitBranch(data.branch || '');
                setGitStatus(data.files || []);
            }
        } catch { }
    };

    const fetchLog = async () => {
        try {
            const res = await fetch(`/api/git/log${pathParam}`);
            if (res.ok) setGitLog(await res.json());
        } catch { }
    };

    useEffect(() => {
        fetchStatus();
        fetchLog();
    }, [activeGitRepoPath]);

    const run = async (action: string, body?: object) => {
        setLoading(true); setError(null); setSuccess(null);
        try {
            const res = await fetch(`/api/git/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, path: activeGitRepoPath }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Operation failed');
            setSuccess(data.message || data.result || 'Done');
            if (activeGitRepoPath) triggerGitAnimation(activeGitRepoPath, action as 'commit' | 'push' | 'pull');
            fetchStatus();
            fetchLog();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const statusColor = (s: string) => {
        if (s === 'modified') return '#FFFF00';
        if (s === 'untracked' || s === 'added') return '#00FF00';
        if (s === 'deleted') return '#FF4444';
        return '#AAAAAA';
    };

    const handleClose = () => {
        setActiveGitRepoPath(null);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px', maxHeight: '80vh',
            background: 'rgba(0, 5, 20, 0.97)',
            border: '1px solid #00FFFF', borderRadius: '8px',
            zIndex: 2000, fontFamily: 'monospace', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 0 40px rgba(0, 255, 255, 0.25), inset 0 0 60px rgba(0, 0, 30, 0.5)',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px', borderBottom: '1px solid rgba(0,255,255,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(0,255,255,0.05)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 6px #00FF88' }} />
                    <span style={{ color: '#00FFFF', fontWeight: 'bold', letterSpacing: '0.15em', fontSize: '12px' }}>SOURCE CONTROL</span>
                    <span style={{ fontSize: '11px', color: '#446', padding: '1px 6px', background: 'rgba(0,255,255,0.06)', borderRadius: '3px' }}>{repoLabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid rgba(0,255,255,0.3)', borderRadius: '4px', color: '#88DDFF' }}>⎇ {gitBranch || '…'}</span>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#00FFFF', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {error && <div style={{ padding: '10px 12px', background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '4px', color: '#FF8888', fontSize: '12px' }}>{error}</div>}
                {success && <div style={{ padding: '10px 12px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', color: '#00FF88', fontSize: '12px' }}>{success}</div>}

                {/* Changed Files */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,255,255,0.6)', textTransform: 'uppercase' }}>Changes</span>
                        <span style={{ fontSize: '10px', color: '#555' }}>{gitStatus.length} files</span>
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(0,255,255,0.1)', borderRadius: '4px', background: 'rgba(0,0,0,0.3)' }}>
                        {gitStatus.length === 0
                            ? <div style={{ padding: '12px', color: '#555', fontSize: '12px', textAlign: 'center' }}>Working tree clean</div>
                            : gitStatus.map(f => (
                                <div key={f.path} style={{ padding: '6px 12px', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ fontSize: '10px', color: statusColor(f.status), minWidth: '16px' }}>{f.status[0].toUpperCase()}</span>
                                    <span style={{ fontSize: '11px', color: '#AAA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Commit / Push / Pull */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,255,255,0.6)', textTransform: 'uppercase' }}>Commit</span>
                    <input
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                        placeholder="Commit message..."
                        onKeyDown={e => e.key === 'Enter' && commitMsg && run('commit', { message: commitMsg })}
                        style={{
                            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,255,0.3)', borderRadius: '4px',
                            color: '#FFF', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace',
                            outline: 'none', width: '100%', boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['Pull', 'Commit', 'Push'].map(label => (
                            <button
                                key={label}
                                onClick={() => {
                                    if (label === 'Commit') { if (commitMsg) run('commit', { message: commitMsg }); }
                                    else run(label.toLowerCase());
                                }}
                                disabled={loading || (label === 'Commit' && !commitMsg)}
                                style={{
                                    flex: 1, padding: '8px',
                                    background: 'rgba(0,255,255,0.08)', border: '1px solid rgba(0,255,255,0.3)',
                                    borderRadius: '4px', color: '#00FFFF', cursor: 'pointer',
                                    fontSize: '12px', fontFamily: 'monospace',
                                    opacity: (label === 'Commit' && !commitMsg) ? 0.4 : 1,
                                }}
                            >{label}</button>
                        ))}
                    </div>
                </div>

                {/* History */}
                <div>
                    <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(0,255,255,0.6)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>History Log</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '200px', overflowY: 'auto' }}>
                        {gitLog.map(e => (
                            <div key={e.hash} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ fontSize: '10px', color: '#00FFFF', opacity: 0.7, flexShrink: 0 }}>{e.hash.slice(0, 7)}</span>
                                    <span style={{ fontSize: '11px', color: '#DDD' }}>{e.message}</span>
                                </div>
                                <span style={{ fontSize: '10px', color: '#555', paddingLeft: '42px', display: 'block' }}>{e.author} · {e.date?.slice(0, 10)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {loading && (
                <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,255,255,0.1)', background: 'rgba(0,255,255,0.05)', fontSize: '11px', color: '#00FFFF', textAlign: 'center' }}>
                    ⟳ Running…
                </div>
            )}
        </div>
    );
}
