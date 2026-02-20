import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Stage, OrbitControls } from '@react-three/drei';

interface FileViewerProps {
    filePath: string;
    onClose: () => void;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']);
const MODEL_EXTS = new Set(['glb', 'gltf']);

// Simple syntax highlight by line coloring based on content
function highlightLine(line: string, ext: string): React.ReactNode {
    if (/^\s*(\/\/|#|--|\/\*)/.test(line)) return <span style={{ color: '#666' }}>{line}</span>;
    if (ext === 'json' && /^\s*"[\w-]+"/.test(line)) return <span style={{ color: '#00CCFF' }}>{line}</span>;
    if (/^\s*(import|export|from|require)/.test(line)) return <span style={{ color: '#FF99CC' }}>{line}</span>;
    if (/^\s*(const|let|var|function|class|interface|type|enum|async|await|return)/.test(line)) return <span style={{ color: '#AADDFF' }}>{line}</span>;
    return <span style={{ color: '#CCC' }}>{line}</span>;
}

// 3D Model component
function ModelViewer({ url }: { url: string }) {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
}

export default function FileViewer({ filePath, onClose }: FileViewerProps) {
    const [content, setContent] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pos, setPos] = useState({ x: window.innerWidth / 2 - 300, y: 80 });
    const [size, setSize] = useState({ w: 600, h: 500 });
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const fileName = filePath.split('/').pop() || filePath;
    const isImage = IMAGE_EXTS.has(ext);
    const isAudio = AUDIO_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    const isModel = MODEL_EXTS.has(ext);
    const isMarkdown = ext === 'md';
    const isBinary = isImage || isAudio || isVideo || isModel;

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Always clean up URLs to avoid memory leaks
        return () => {
            if (mediaUrl && mediaUrl.startsWith('blob:')) URL.revokeObjectURL(mediaUrl);
        };
    }, [filePath]);

    useEffect(() => {
        const encoded = encodeURIComponent(filePath);

        if (isBinary) {
            setMediaUrl(`/api/file/${encoded}`);
            setLoading(false);
        } else {
            fetch(`/api/file/${encoded}`)
                .then(res => {
                    if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Failed to load'); });
                    return res.json();
                })
                .then(data => {
                    setContent(data.content);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        }
    }, [filePath, isBinary]);

    // Dragging events
    const onMouseDownHeader = useCallback((e: React.MouseEvent) => {
        dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
        e.preventDefault();
    }, [pos]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (dragRef.current) {
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                setPos({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy });
            }
            if (resizeRef.current) {
                const dx = e.clientX - resizeRef.current.startX;
                const dy = e.clientY - resizeRef.current.startY;
                setSize({ w: Math.max(300, resizeRef.current.startW + dx), h: Math.max(200, resizeRef.current.startH + dy) });
            }
        };
        const onMouseUp = () => { dragRef.current = null; resizeRef.current = null; };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
    }, []);

    const onMouseDownResize = useCallback((e: React.MouseEvent) => {
        resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
        e.preventDefault(); e.stopPropagation();
    }, [size]);

    const lines = content?.split('\n') || [];

    return (
        <div
            style={{
                position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h,
                background: 'rgba(0, 3, 15, 0.96)', border: '1px solid rgba(0, 255, 255, 0.4)',
                borderRadius: '8px', zIndex: 3000, display: 'flex', flexDirection: 'column',
                fontFamily: 'monospace', boxShadow: '0 0 40px rgba(0, 255, 255, 0.1), inset 0 0 40px rgba(0, 0, 20, 0.5)',
                overflow: 'hidden', userSelect: isMarkdown ? 'text' : 'none',
            }}
        >
            {/* Title bar */}
            <div
                onMouseDown={onMouseDownHeader}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(0, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(0, 255, 255, 0.2)', cursor: 'grab', flexShrink: 0,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>
                        {isImage ? '🖼️' : isVideo ? '🎞️' : isAudio ? '🎵' : isModel ? '🧊' : isMarkdown ? '📖' : '📄'}
                    </span>
                    <span style={{ color: '#00FFFF', fontSize: '12px', fontWeight: 'bold' }}>{fileName}</span>
                    <span style={{ color: '#444', fontSize: '10px' }}>{filePath}</span>
                </div>
                <button
                    onMouseDown={e => e.stopPropagation()} onClick={onClose}
                    style={{ background: 'none', border: '1px solid #444', color: '#888', cursor: 'pointer', borderRadius: '3px', padding: '2px 8px', fontSize: '11px' }}
                >✕</button>
            </div>

            {/* Content Container */}
            <div style={{ flex: 1, overflow: isModel ? 'hidden' : 'auto', position: 'relative' }}>
                {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: '12px' }}>Loading...</div>}
                {error && <div style={{ padding: '20px', color: '#FF4444', fontSize: '12px' }}>⚠️ {error}</div>}

                {/* Media Renderers */}
                {mediaUrl && !loading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: isModel ? 0 : '16px', boxSizing: 'border-box' }}>
                        {isImage && <img src={mediaUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />}

                        {isVideo && <video src={mediaUrl} controls autoPlay muted loop style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '4px', background: '#000' }} />}

                        {isAudio && (
                            <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                <div style={{ fontSize: '40px' }}>🎵</div>
                                <div style={{ color: '#00FFFF', fontSize: '14px' }}>{fileName}</div>
                                <audio src={mediaUrl} controls autoPlay style={{ width: '100%' }} />
                            </div>
                        )}

                        {isModel && (
                            <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
                                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                                    <color attach="background" args={['#0a0a0a']} />
                                    <Suspense fallback={null}>
                                        <Stage environment="city" intensity={0.5}>
                                            <ModelViewer url={mediaUrl} />
                                        </Stage>
                                    </Suspense>
                                    <OrbitControls autoRotate autoRotateSpeed={2} makeDefault />
                                </Canvas>
                            </div>
                        )}
                    </div>
                )}

                {/* Text Content */}
                {content !== null && !loading && (
                    <div style={{ padding: isMarkdown ? '20px 30px' : '0', color: isMarkdown ? '#E0E0E0' : 'inherit' }}>
                        {isMarkdown ? (
                            <div className="markdown-preview" style={{
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                lineHeight: '1.6', fontSize: '14px'
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px', lineHeight: '1.5' }}>
                                <tbody>
                                    {lines.map((line, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            <td style={{ padding: '0 8px', color: '#444', textAlign: 'right', userSelect: 'none', borderRight: '1px solid rgba(255,255,255,0.05)', minWidth: '40px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>
                                                {i + 1}
                                            </td>
                                            <td style={{ padding: '0 12px', whiteSpace: 'pre', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                                {highlightLine(line, ext)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Status bar */}
            {!loading && (
                <div style={{
                    padding: '3px 12px', borderTop: '1px solid rgba(0, 255, 255, 0.1)', fontSize: '10px',
                    color: '#444', display: 'flex', gap: '16px', flexShrink: 0, background: 'rgba(0, 0, 0, 0.3)',
                }}>
                    {isBinary ? (
                        <span>Binary Size: Unknown</span>
                    ) : (
                        <>
                            <span>{lines.length} lines</span>
                            <span>{content?.length.toLocaleString() || 0} chars</span>
                        </>
                    )}
                    <span style={{ color: '#00FFFF', opacity: 0.5 }}>.{ext}</span>
                </div>
            )}

            {/* Resize handle */}
            <div
                onMouseDown={onMouseDownResize}
                style={{
                    position: 'absolute', bottom: 0, right: 0, width: '14px', height: '14px',
                    cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, rgba(0,255,255,0.3) 50%)',
                    borderRadius: '0 0 8px 0',
                }}
            />

            {/* Markdown Styles */}
            {isMarkdown && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .markdown-preview h1 { color: #00FFFF; margin-bottom: 16px; border-bottom: 1px solid rgba(0,255,255,0.2); padding-bottom: 8px; }
                    .markdown-preview h2, .markdown-preview h3 { color: #AADDFF; margin-top: 24px; }
                    .markdown-preview a { color: #FF99CC; text-decoration: none; }
                    .markdown-preview code { font-family: monospace; background: rgba(0,255,255,0.1); padding: 2px 4px; border-radius: 3px; color: #00FFFF; }
                    .markdown-preview pre { background: rgba(0,0,0,0.5); padding: 12px; border-radius: 6px; border: 1px solid rgba(0,255,255,0.2); overflow-x: auto; }
                    .markdown-preview pre code { background: none; padding: 0; color: #E0E0E0; }
                    .markdown-preview ul, .markdown-preview ol { padding-left: 20px; }
                    .markdown-preview table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                    .markdown-preview th, .markdown-preview td { border: 1px solid rgba(255,255,255,0.1); padding: 8px; text-align: left; }
                    .markdown-preview th { background: rgba(0,255,255,0.05); color: #00FFFF; }
                `}} />
            )}
        </div>
    );
}
