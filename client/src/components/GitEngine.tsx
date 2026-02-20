import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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
    const gitStatus = useAgentStore(state => state.gitStatus);

    const groupRef = useRef<THREE.Group>(null);
    const crystalRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        if (crystalRef.current) {
            crystalRef.current.rotation.y += delta * 0.5;
            crystalRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
        }
        if (ringRef.current) {
            ringRef.current.rotation.x += delta * 0.8;
            ringRef.current.rotation.y -= delta * 0.6;
        }
    });

    // If repoPath given, check it's in the repo list (it should be, but guard)
    // If no repoPath given, show if any repo is known (legacy single-repo mode)
    if (repoPath && !gitRepos.includes(repoPath)) return null;

    const isDirty = gitStatus.length > 0;
    const emissionColor = isDirty ? '#FFFF00' : '#00FFFF';

    const handleClick = (e: any) => {
        e.stopPropagation();
        if (onOpen) {
            onOpen();
        } else {
            // Legacy: open panel for default repo
            setActiveGitRepoPath(repoPath || null);
            setGitPanelOpen(true);
        }
    };

    return (
        <group position={position} scale={scale} ref={groupRef}>
            {/* Base Pedestal */}
            <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.8, 1.0, 0.3, 8]} />
                <meshStandardMaterial color="#0a0a12" metalness={0.9} roughness={0.15} />
            </mesh>

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

            {/* Glow light */}
            <pointLight position={[0, 0.8, 0]} intensity={isDirty ? 2.5 : 1.2} color={emissionColor} distance={6} />
        </group>
    );
}
