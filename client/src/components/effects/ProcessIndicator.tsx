import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { ProcessInfo } from '../../stores/agentStore';

interface ProcessIndicatorProps {
  process: ProcessInfo;
  position: [number, number, number];
  index: number;
}

export default function ProcessIndicator({ process, position, index }: ProcessIndicatorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cubeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Stack multiple processes vertically
  const yOffset = 3 + index * 1.2;

  useFrame((_, delta) => {
    if (cubeRef.current) {
      cubeRef.current.rotation.y += delta * 1.5;
      cubeRef.current.rotation.x += delta * 0.5;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 2;
    }
  });

  // Color based on process type
  const getProcessColor = () => {
    const name = process.name.toLowerCase();
    if (name.includes('vite') || name.includes('webpack')) return '#646CFF';
    if (name.includes('node')) return '#68A063';
    if (name.includes('python') || name.includes('flask') || name.includes('django')) return '#3776AB';
    if (name.includes('next')) return '#000000';
    if (name.includes('cargo') || name.includes('rust')) return '#DEA584';
    if (name.includes('go')) return '#00ADD8';
    return '#FF6600';
  };

  const color = getProcessColor();

  return (
    <group ref={groupRef} position={[position[0], position[1] + yOffset, position[2]]}>
      {/* Rotating cube core */}
      <mesh ref={cubeRef}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Orbiting ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.03, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Vertical beam down to folder */}
      <mesh position={[0, -yOffset / 2 + 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, yOffset - 1, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Process name label */}
      <Billboard position={[0, 0.6, 0]}>
        <Text
          fontSize={0.18}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {process.name}
        </Text>
      </Billboard>

      {/* Port label if available */}
      {process.port && (
        <Billboard position={[0, 0.35, 0]}>
          <Text
            fontSize={0.12}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            :{process.port}
          </Text>
        </Billboard>
      )}

      {/* Glow light */}
      <pointLight color={color} intensity={1} distance={5} />
    </group>
  );
}
