import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { AgentState, useAgentStore } from '../stores/agentStore';
import ActivityTrail from './ActivityTrail';
import { getPositionForPath } from '../utils/fileSystemLayout';

interface LightCycleProps {
  agent: AgentState;
}

const AGENT_OFFSET = 2;

function getAgentName(sessionId: string): string {
  if (sessionId.startsWith('grid-')) {
    return sessionId.replace('grid-', '').toUpperCase();
  }
  return sessionId.slice(-6).toUpperCase();
}

function CycleBody({ color }: { color: string }) {
  const darkMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0a0a0a',
    roughness: 0.2,
    metalness: 0.9,
  }), []);

  const neonMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2,
  }), [color]);

  return (
    <group scale={[0.5, 0.5, 0.5]}>
      {/* Main body - solid base */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.35, 0.2, 1.5]} />
        <primitive object={darkMaterial} attach="material" />
      </mesh>

      {/* Curved canopy top */}
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
        <primitive object={darkMaterial} attach="material" />
      </mesh>

      {/* Front nose */}
      <mesh position={[0, 0.38, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.35, 4]} />
        <primitive object={darkMaterial} attach="material" />
      </mesh>

      {/* Rear tail */}
      <mesh position={[0, 0.38, -0.88]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.15, 0.3, 4]} />
        <primitive object={darkMaterial} attach="material" />
      </mesh>

      {/* Front wheel - neon */}
      <group position={[0, 0.3, 0.6]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.28, 0.05, 16, 32]} />
          <primitive object={neonMaterial} attach="material" />
        </mesh>
      </group>

      {/* Rear wheel - neon */}
      <group position={[0, 0.3, -0.6]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.28, 0.05, 16, 32]} />
          <primitive object={neonMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export default function LightCycle({ agent }: LightCycleProps) {
  const meshRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(new THREE.Vector3(0, 0, AGENT_OFFSET));
  const currentPosition = useRef(new THREE.Vector3(0, 0, AGENT_OFFSET));
  const targetRotation = useRef(0);
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);
  const fileSystem = useAgentStore((state) => state.fileSystem);
  const lastEvent = useAgentStore((state) => state.lastEvent);

  const color = agent.color || (agent.agentType === 'main' ? '#00FFFF' : '#FF6600');

  useEffect(() => {
    if (agent.currentPath && fileSystem) {
      const pos = getPositionForPath(agent.currentPath, fileSystem);
      if (pos) {
        const agentIndex = parseInt(agent.sessionId.replace(/\D/g, '').slice(-2) || '0', 10) % 4;
        const offsetAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        const offsetAngle = offsetAngles[agentIndex];

        const offsetX = Math.sin(offsetAngle) * AGENT_OFFSET;
        const offsetZ = Math.cos(offsetAngle) * AGENT_OFFSET;

        targetPosition.current.set(pos.x + offsetX, 0, pos.z + offsetZ);
        targetRotation.current = Math.atan2(-offsetX, -offsetZ);
      }
    }
  }, [agent.currentPath, agent.sessionId, fileSystem]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      currentPosition.current.lerp(targetPosition.current, delta * 3);
      meshRef.current.position.copy(currentPosition.current);

      const currentRotY = meshRef.current.rotation.y;
      const rotDiff = targetRotation.current - currentRotY;
      const normalizedDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
      meshRef.current.rotation.y += normalizedDiff * delta * 5;

      if (currentPosition.current.distanceTo(targetPosition.current) > 0.1) {
        setTrail((prev) => {
          const newTrail = [...prev, currentPosition.current.clone()];
          return newTrail.slice(-50);
        });
      }
    }
  });

  const toolName = lastEvent?.sessionId === agent.sessionId ? lastEvent.toolName : undefined;
  const targetFile = agent.currentPath?.split('/').pop();

  return (
    <group ref={meshRef}>
      <CycleBody color={color} />

      <pointLight color={color} intensity={3} distance={10} position={[0, 0.5, 0]} />

      <Billboard position={[0, 1.2, 0]}>
        <Text
          fontSize={0.22}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {agent.agentType === 'main' ? '●' : '○'} {getAgentName(agent.sessionId)}
        </Text>
      </Billboard>

      {toolName && (
        <Billboard position={[0, 0.9, 0]}>
          <Text
            fontSize={0.16}
            color="#FFFF00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {toolName}
          </Text>
        </Billboard>
      )}

      {targetFile && (
        <Billboard position={[0, 0.65, 0]}>
          <Text
            fontSize={0.12}
            color="#888888"
            anchorX="center"
            anchorY="middle"
          >
            → {targetFile}
          </Text>
        </Billboard>
      )}

      <ActivityTrail points={trail} color={color} />
    </group>
  );
}
