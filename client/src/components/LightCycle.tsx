import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { AgentState, useAgentStore, AgentProvider } from '../stores/agentStore';
import ActivityTrail from './ActivityTrail';
import AgentActivity from './effects/AgentActivity';
import { getPositionForPath } from '../utils/fileSystemLayout';

interface LightCycleProps {
  agent: AgentState;
}

const AGENT_OFFSET = 2;
const MOVE_SPEED = 8;
const TURN_SPEED = 12;

const PROVIDER_ICONS: Record<AgentProvider, string> = {
  claude: '●', gemini: '◆', codex: '■', goose: '▲',
  kilocode: '◎', opencode: '⬡', kimi: '✦', cline: '◇',
  augment: '⬢', qwen: '★', aider: '▼', copilot: '◈', generic: '○',
};

function getAgentLabel(agent: AgentState): string {
  const name = agent.sessionId.startsWith('grid-')
    ? agent.sessionId.replace('grid-', '').toUpperCase()
    : agent.sessionId.slice(-6).toUpperCase();
  const icon = PROVIDER_ICONS[agent.provider || 'claude'] || '●';
  return `${icon} ${name}`;
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
  const currentPosition = useRef<THREE.Vector3 | null>(null);
  const currentRotation = useRef(0);
  const waypoints = useRef<THREE.Vector3[]>([]);
  const waypointIndex = useRef(0);
  const isMoving = useRef(false);
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);
  const fileSystem = useAgentStore((state) => state.fileSystem);
  const lastEvent = useAgentStore((state) => state.lastEvent);

  const color = agent.color || (agent.agentType === 'main' ? '#00FFFF' : '#FF6600');

  const calculateWaypoints = useCallback((from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];

    if (from.distanceTo(to) < 0.1) return [];

    const midX = to.x;
    const midZ = from.z;

    if (Math.abs(from.x - to.x) > 0.1) {
      points.push(new THREE.Vector3(midX, 0, midZ));
    }

    if (Math.abs(midZ - to.z) > 0.1) {
      points.push(new THREE.Vector3(to.x, 0, to.z));
    }

    if (points.length === 0 && from.distanceTo(to) > 0.1) {
      points.push(to.clone());
    }

    return points;
  }, []);

  useEffect(() => {
    if (agent.currentPath && fileSystem) {
      const pos = getPositionForPath(agent.currentPath, fileSystem);
      if (pos) {
        const agentIndex = parseInt(agent.sessionId.replace(/\D/g, '').slice(-2) || '0', 10) % 4;
        const offsetAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        const offsetAngle = offsetAngles[agentIndex];

        const offsetX = Math.sin(offsetAngle) * AGENT_OFFSET;
        const offsetZ = Math.cos(offsetAngle) * AGENT_OFFSET;

        const targetPos = new THREE.Vector3(pos.x + offsetX, 0, pos.z + offsetZ);

        if (!currentPosition.current) {
          currentPosition.current = targetPos.clone();
          return;
        }

        const newWaypoints = calculateWaypoints(currentPosition.current, targetPos);
        if (newWaypoints.length > 0) {
          waypoints.current = newWaypoints;
          waypointIndex.current = 0;
          isMoving.current = true;
        }
      }
    }
  }, [agent.currentPath, agent.sessionId, fileSystem, calculateWaypoints]);

  useFrame((_, delta) => {
    if (!meshRef.current || !currentPosition.current) return;

    if (isMoving.current && waypoints.current.length > 0) {
      const targetWaypoint = waypoints.current[waypointIndex.current];
      const direction = targetWaypoint.clone().sub(currentPosition.current);
      const distance = direction.length();

      if (distance > 0.05) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        const rotDiff = targetRotation - currentRotation.current;
        const normalizedDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
        currentRotation.current += normalizedDiff * delta * TURN_SPEED;

        const moveDistance = Math.min(delta * MOVE_SPEED, distance);
        direction.normalize().multiplyScalar(moveDistance);
        currentPosition.current.add(direction);

        setTrail((prev) => {
          const newTrail = [...prev, currentPosition.current!.clone()];
          return newTrail.slice(-50);
        });
      } else {
        currentPosition.current.copy(targetWaypoint);
        waypointIndex.current++;

        if (waypointIndex.current >= waypoints.current.length) {
          isMoving.current = false;
          waypoints.current = [];
          waypointIndex.current = 0;
        }
      }
    }

    meshRef.current.position.copy(currentPosition.current);
    meshRef.current.rotation.y = currentRotation.current;
  });

  const toolName = lastEvent?.sessionId === agent.sessionId ? lastEvent.toolName : undefined;
  const targetFile = agent.currentPath?.split('/').pop();

  // Check if agent is actively running (has recent activity)
  const isActive = agent.status === 'running' && !!toolName;

  return (
    <>
      <group ref={meshRef}>
        <CycleBody color={color} />

        {/* Activity effect when running */}
        <AgentActivity
          position={[0, 0, 0]}
          color={color}
          isActive={isActive}
          toolName={toolName}
        />

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
            {agent.agentType === 'main' ? '●' : '○'} {getAgentLabel(agent)}
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
      </group>

      <ActivityTrail points={trail} color={color} />
    </>
  );
}
