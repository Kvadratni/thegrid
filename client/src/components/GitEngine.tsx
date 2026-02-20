import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import { useAgentStore } from '../stores/agentStore';

interface GitEngineProps {
    position?: [number, number, number];
    scale?: number;
    repoPath?: string;
    onOpen?: () => void;
}

export default function GitEngine({ position = [0, 0, 0], scale = 1, repoPath, onOpen }: GitEngineProps) {
    const gitRepos = useAgentStore(state => state.gitRepos);
    const setGitPanelOpen = useAgentStore(state => state.setGitPanelOpen);
    const setActiveGitRepoPath = useAgentStore(state => state.setActiveGitRepoPath);

    // We listen to gitAnimations to trigger local effects & refetch
    const gitAnimations = useAgentStore(state => state.gitAnimations);

    const [isDirty, setIsDirty] = useState(false);
    const [aheadCount, setAheadCount] = useState(0);
    const [branch, setBranch] = useState('');

    const groupRef = useRef<THREE.Group>(null);
    const crystalRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    // Animation states
    const effectState = useRef<{ type: 'commit' | 'push' | 'pull' | 'checkout' | null; start: number }>({ type: null, start: 0 });
    const beamRef = useRef<THREE.Mesh>(null);
    const beamMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const textRef = useRef<any>(null);

    const fetchLocalStatus = async () => {
        if (!repoPath) return;
        try {
            const res = await fetch(`/api/git/status?path=${encodeURIComponent(repoPath)}`);
            if (res.ok) {
                const data = await res.json();
                setIsDirty(data.files && data.files.length > 0);
                setAheadCount(data.aheadCount || 0);
                setBranch(data.branch || '');
            }
        } catch { }
    };

    // Refetch on mount
    useEffect(() => {
        fetchLocalStatus();
    }, [repoPath]);

    // Handle incoming animations
    useEffect(() => {
        if (!repoPath) return;
        const latest = gitAnimations[gitAnimations.length - 1];
        if (latest && latest.repoPath === repoPath) {
            effectState.current = { type: latest.type, start: Date.now() };
            // A git action occurred, refetch status
            fetchLocalStatus();
        }
    }, [gitAnimations]);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;

        if (crystalRef.current) {
            crystalRef.current.rotation.y += delta * 0.5;
            crystalRef.current.position.y = Math.sin(time * 1.5) * 0.15 + 0.4;

            // Commit pulse effect: scale swells up and down
            let currentScale = 1;
            if (effectState.current.type === 'commit') {
                const elapsed = (Date.now() - effectState.current.start) / 1000;
                if (elapsed < 1.0) {
                    currentScale = 1 + Math.sin(elapsed * Math.PI) * 0.4; // Swell to 1.4x
                } else {
                    effectState.current.type = null;
                }
            }
            crystalRef.current.scale.set(currentScale, currentScale, currentScale);
        }

        if (ringRef.current) {
            ringRef.current.rotation.x += delta * 0.8;
            ringRef.current.rotation.y -= delta * 0.6;

            // Push/Pull spin faster
            if (effectState.current.type === 'push' || effectState.current.type === 'pull') {
                const elapsed = (Date.now() - effectState.current.start) / 1000;
                if (elapsed < 2.0) {
                    ringRef.current.rotation.x += delta * 5;
                    ringRef.current.rotation.y -= delta * 5;
                }
            }
        }

        // Fast spin for checkout
        if (ringRef.current && effectState.current.type === 'checkout') {
            const elapsed = (Date.now() - effectState.current.start) / 1000;
            if (elapsed < 1.0) {
                ringRef.current.rotation.y += delta * 15; // very fast spin
            }
        }

        // Beam effect for Push / Pull
        if (beamRef.current && beamMatRef.current) {
            const elapsed = (Date.now() - effectState.current.start) / 1000;
            if ((effectState.current.type === 'push' || effectState.current.type === 'pull') && elapsed < 2.0) {
                beamRef.current.visible = true;
                // Fade in then out
                const alpha = Math.sin((elapsed / 2.0) * Math.PI);
                beamMatRef.current.opacity = alpha * 0.8;

                // Animate position: up for push, down for pull
                const offset = effectState.current.type === 'push' ? (elapsed * 5) : (10 - elapsed * 5);
                beamRef.current.position.y = offset;
            } else if (effectState.current.type && elapsed >= 2.0) {
                beamRef.current.visible = false;
                if (effectState.current.type !== 'checkout') effectState.current.type = null;
            }
        }

        if (textRef.current) {
            textRef.current.position.y = Math.sin(time * 2.0) * 0.05;
        }
    });

    if (repoPath && !gitRepos.includes(repoPath)) return null;

    const emissionColor = isDirty ? '#FFFF00' : '#00FFFF';

    const handleClick = (e: any) => {
        e.stopPropagation();
        if (onOpen) {
            onOpen();
        } else {
            setActiveGitRepoPath(repoPath || null);
            setGitPanelOpen(true);
        }
    };

    return (
        <group position={position} scale={scale} ref={groupRef}>
            {/* Action Beam */}
            <mesh ref={beamRef} visible={false}>
                <cylinderGeometry args={[0.2, 0.2, 5, 8]} />
                <meshStandardMaterial ref={beamMatRef} color="#00FF00" emissive="#00FF00" emissiveIntensity={2} transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Floating Branch Label */}
            {branch && (
                <Billboard position={[0, 1.6, 0]}>
                    <Text
                        ref={textRef}
                        position={[0, 0, 0]}
                        fontSize={0.25}
                        color="#00FFFF"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                    >
                        ⎇ {branch}
                    </Text>
                </Billboard>
            )}

            {/* Main Crystal */}
            <mesh
                ref={crystalRef}
                position={[0, 0.4, 0]}
                onClick={handleClick}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'default'; }}
            >
                <octahedronGeometry args={[0.6, 0]} />
                <meshStandardMaterial
                    color={emissionColor}
                    emissive={emissionColor}
                    emissiveIntensity={0.7}
                    wireframe
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Orbiting Ring */}
            <mesh ref={ringRef} position={[0, 0.4, 0]}>
                <torusGeometry args={[0.9, 0.04, 16, 80]} />
                <meshStandardMaterial color={emissionColor} emissive={emissionColor} emissiveIntensity={1.2} />
            </mesh>

            {/* Ahead Orbs */}
            {aheadCount > 0 && Array.from({ length: Math.min(aheadCount, 12) }).map((_, i) => (
                <OrbitingOrb key={i} index={i} total={Math.min(aheadCount, 12)} />
            ))}

            {/* Glow light */}
            <pointLight position={[0, 0.8, 0]} intensity={isDirty ? 2.5 : 1.2} color={emissionColor} distance={6} />
        </group>
    );
}

// Separate component for orb so it can animate its own orbit
function OrbitingOrb({ index, total }: { index: number, total: number }) {
    const orbRef = useRef<THREE.Mesh>(null);
    const offsetAngle = (index / total) * Math.PI * 2;
    const radius = 1.3;

    useFrame((state) => {
        if (orbRef.current) {
            const angle = state.clock.elapsedTime * 2 + offsetAngle;
            orbRef.current.position.x = Math.cos(angle) * radius;
            orbRef.current.position.z = Math.sin(angle) * radius;
            orbRef.current.position.y = Math.sin(state.clock.elapsedTime * 3 + offsetAngle) * 0.3 + 0.4;
        }
    });

    return (
        <mesh ref={orbRef}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={2} />
        </mesh>
    );
}
