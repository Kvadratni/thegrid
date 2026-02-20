import { useState, useEffect, Suspense, useRef } from 'react';
import { Html, useGLTF, Stage, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentStore } from '../stores/agentStore';

interface HologramViewerProps {
    filePath: string;
    height: number;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']);
const MODEL_EXTS = new Set(['glb', 'gltf']);

function highlightLine(line: string, ext: string): React.ReactNode {
    if (/^\s*(\/\/|#|--|\/\*)/.test(line)) return <span style={{ color: '#666' }}>{line}</span>;
    if (ext === 'json' && /^\s*"[\w-]+"/.test(line)) return <span style={{ color: '#00CCFF' }}>{line}</span>;
    if (/^\s*(import|export|from|require)/.test(line)) return <span style={{ color: '#FF99CC' }}>{line}</span>;
    if (/^\s*(const|let|var|function|class|interface|type|enum|async|await|return)/.test(line)) return <span style={{ color: '#AADDFF' }}>{line}</span>;
    return <span style={{ color: '#CCC' }}>{line}</span>;
}

function ModelHologram({ url }: { url: string }) {
    const { scene } = useGLTF(url);
    const ref = useRef<THREE.Group>(null);

    // Slowly rotate the model like a hologram
    useFrame((_, delta) => {
        if (ref.current) {
            ref.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={ref}>
            <primitive object={scene} />
        </group>
    );
}

export default function HologramViewer({ filePath, height }: HologramViewerProps) {
    const [content, setContent] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const setViewingFile = useAgentStore(state => state.setViewingFile);

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

        return () => {
            // Basic cleanup
        };
    }, [filePath, isBinary]);

    // 3D Model Hologram renders directly in the scene as meshes
    if (isModel && mediaUrl && !loading) {
        return (
            <Billboard position={[0, height + 4, 0]}>
                <group scale={[1.5, 1.5, 1.5]}>
                    <pointLight intensity={2} color="#00ffff" distance={5} />
                    {/* Hologram scanline box effect */}
                    <mesh>
                        <boxGeometry args={[4, 4, 4]} />
                        <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.1} />
                    </mesh>
                    <Suspense fallback={null}>
                        <Stage environment="city" intensity={0.5} adjustCamera={false}>
                            <ModelHologram url={mediaUrl} />
                        </Stage>
                    </Suspense>
                    {/* Close button for 3D model */}
                    <Html position={[2.5, 2.5, 0]} center>
                        <button
                            onClick={(e) => { e.stopPropagation(); setViewingFile(null); }}
                            style={{
                                background: 'rgba(0,0,0,0.8)', border: '1px solid #00ffff',
                                color: '#00ffff', padding: '4px 8px', borderRadius: '4px',
                                fontFamily: 'monospace', cursor: 'pointer', pointerEvents: 'auto'
                            }}>
                            CLOSE
                        </button>
                    </Html>
                </group>
            </Billboard>
        );
    }

    // Other types use Html overlay floating above the building
    return (
        <Billboard position={[0, height + 3, 0]}>
            <Html
                center
                distanceFactor={5} // Changed from 15 to 5. Lower distanceFactor makes the unscaled HTML appear smaller in world-space without CSS blur
                zIndexRange={[100, 0]}
                transform
                style={{
                    pointerEvents: 'none',
                    // Removed the CSS scale transform that was destroying text antialiasing
                }}
            >
                <div style={{
                    width: isAudio ? '400px' : isVideo || isImage ? '800px' : '700px', // Wider native resolutions for crisper text rendering
                    maxHeight: '800px',
                    background: isImage || isVideo || isAudio ? 'transparent' : 'rgba(0, 5, 10, 0.90)', // Darker background for illegibility
                    border: isImage || isVideo || isAudio ? 'none' : '2px solid rgba(0, 255, 255, 0.5)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: 'monospace',
                    boxShadow: isImage || isVideo || isAudio ? 'none' : '0 0 40px rgba(0, 255, 255, 0.2)',
                    backdropFilter: isImage || isVideo || isAudio ? 'none' : 'blur(8px)',
                    overflow: 'hidden',
                    pointerEvents: 'auto', // Re-enable pointer events for the UI panel itself
                }}>
                    {/* Close Button / Title Area */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px', background: 'rgba(0, 0, 0, 0.5)',
                        borderBottom: isImage || isVideo || isAudio ? 'none' : '1px solid rgba(0,255,255,0.2)',
                        borderRadius: isImage || isVideo || isAudio ? '8px 8px 0 0' : '0',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <div style={{ color: '#00ffff', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 5px #00ffff' }}>
                            {fileName}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setViewingFile(null); }}
                            style={{
                                background: 'none', border: '1px solid rgba(0,255,255,0.5)',
                                color: '#00ffff', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px'
                            }}
                        >✕</button>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                        {loading && <div style={{ padding: '20px', color: '#00ffff', textAlign: 'center' }}>Initializing Array...</div>}
                        {error && <div style={{ padding: '20px', color: '#ff0055' }}>Error: {error}</div>}

                        {mediaUrl && !loading && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {isImage && <img src={mediaUrl} alt={fileName} style={{ maxWidth: '100%', borderRadius: '0 0 8px 8px', boxShadow: '0 0 50px rgba(0,255,255,0.2)' }} />}
                                {isVideo && <video src={mediaUrl} controls autoPlay muted loop style={{ maxWidth: '100%', borderRadius: '0 0 8px 8px', boxShadow: '0 0 50px rgba(0,255,255,0.2)' }} />}
                                {isAudio && (
                                    <div style={{ padding: '20px', background: 'rgba(0,20,40,0.6)', borderRadius: '0 0 8px 8px', width: '100%', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,255,0.2)', borderTop: 'none' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                                            <div style={{
                                                width: '30px', height: '30px', border: '2px solid #00ffff',
                                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#00ffff', boxShadow: '0 0 10px #00ffff'
                                            }}>♪</div>
                                            <div style={{ height: '2px', background: '#00ffff', flex: 1, boxShadow: '0 0 5px #00ffff' }} />
                                        </div>
                                        <audio src={mediaUrl} controls autoPlay style={{ width: '100%', filter: 'hue-rotate(180deg) saturate(2)' }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Text Content */}
                        {content !== null && !loading && (
                            <div style={{ padding: isMarkdown ? '20px' : '0', color: isMarkdown ? '#E0E0E0' : '#fff' }}>
                                {isMarkdown ? (
                                    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px', lineHeight: '1.5' }}>
                                        <tbody>
                                            {content.split('\n').map((line, i) => (
                                                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,255,255,0.02)' }}>
                                                    <td style={{ padding: '0 8px', color: '#00ffff', opacity: 0.5, textAlign: 'right', userSelect: 'none', borderRight: '1px solid rgba(0,255,255,0.1)', minWidth: '40px' }}>
                                                        {i + 1}
                                                    </td>
                                                    <td style={{ padding: '0 12px', whiteSpace: 'pre', fontFamily: 'monospace' }}>
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
                </div>
            </Html>
        </Billboard>
    );
}
