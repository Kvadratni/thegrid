import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ReadEffectProps {
  position: [number, number, number];
  intensity?: number;
}

export default function ReadEffect({ position, intensity = 1 }: ReadEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (scanLineRef.current) {
      // Scan line moves down and resets
      const scanY = 2 - (timeRef.current * 2 % 3);
      scanLineRef.current.position.y = scanY;

      // Fade at edges
      const normalizedY = (scanY + 1) / 3;
      const opacity = normalizedY > 0.1 && normalizedY < 0.9
        ? 0.8
        : Math.min(normalizedY * 8, (1 - normalizedY) * 8);

      const material = scanLineRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * intensity;
    }

    // Rotate data streams
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Scanning line */}
      <mesh ref={scanLineRef} position={[0, 1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 0.05]} />
        <meshBasicMaterial color="#00AAFF" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical data streams */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 0.5;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, 1, Math.sin(angle) * radius]}
          >
            <boxGeometry args={[0.02, 2, 0.02]} />
            <meshBasicMaterial color="#00AAFF" transparent opacity={0.3 * intensity} />
          </mesh>
        );
      })}

      {/* Base glow ring */}
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.6, 32]} />
        <meshBasicMaterial color="#00AAFF" transparent opacity={0.4 * intensity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
