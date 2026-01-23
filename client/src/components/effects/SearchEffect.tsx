import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SearchEffectProps {
  position: [number, number, number];
  intensity?: number;
}

export default function SearchEffect({ position, intensity = 1 }: SearchEffectProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    const rings = [ring1Ref, ring2Ref, ring3Ref];
    rings.forEach((ref, i) => {
      if (!ref.current) return;

      // Staggered pulse timing
      const t = (timeRef.current + i * 0.4) % 1.5;
      const scale = 0.3 + t * 1.5;
      ref.current.scale.set(scale, scale, 1);

      // Fade out as it expands
      const opacity = t < 0.1 ? t * 10 : Math.max(0, 1 - t / 1.2);
      const material = ref.current.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * 0.6 * intensity;
    });
  });

  return (
    <group position={position}>
      {/* Radar pulse rings */}
      <mesh ref={ring1Ref} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 32]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={ring2Ref} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 32]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={ring3Ref} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 32]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Center dot */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.8 * intensity} />
      </mesh>

      {/* Vertical scan beam */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.3 * intensity} />
      </mesh>
    </group>
  );
}
