import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AgentActivityProps {
  position: [number, number, number];
  color: string;
  isActive: boolean;
  toolName?: string;
}

export default function AgentActivity({ position, color, isActive, toolName }: AgentActivityProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 50;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1 + Math.random() * 2;
      const height = Math.random() * 3;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = 0.02 + Math.random() * 0.03;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.userData.velocities = velocities;
    return geometry;
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !isActive) return;

    // Rotate rings
    if (ringsRef.current) {
      ringsRef.current.rotation.y += delta * 2;
      ringsRef.current.children.forEach((ring, i) => {
        ring.rotation.x += delta * (0.5 + i * 0.3);
      });
    }

    // Animate particles
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = particlesRef.current.geometry.userData.velocities as Float32Array;

      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Reset particle if too high
        if (positions[i * 3 + 1] > 4) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 1 + Math.random() * 1;
          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = Math.sin(angle) * radius;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Pulse effect
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    groupRef.current.scale.setScalar(pulse);
  });

  if (!isActive) return null;

  // Tool-specific colors
  const activityColor = useMemo(() => {
    switch (toolName) {
      case 'Write': return '#00FF00';
      case 'Edit': return '#FFFF00';
      case 'Read': return '#00FFFF';
      case 'Bash': return '#FF6600';
      case 'Grep': return '#FF00FF';
      case 'Glob': return '#FF00FF';
      default: return color;
    }
  }, [toolName, color]);

  return (
    <group ref={groupRef} position={position}>
      {/* Rotating rings around the agent */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.03, 8, 32]} />
          <meshBasicMaterial color={activityColor} transparent opacity={0.6} />
        </mesh>
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[1.8, 0.02, 8, 32]} />
          <meshBasicMaterial color={activityColor} transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <torusGeometry args={[2.0, 0.02, 8, 32]} />
          <meshBasicMaterial color={activityColor} transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Base glow */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[0.5, 2.5, 32]} />
        <meshBasicMaterial color={activityColor} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Rising particles */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color={activityColor}
          size={0.06}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Central glow */}
      <pointLight color={activityColor} intensity={2} distance={8} />
    </group>
  );
}
