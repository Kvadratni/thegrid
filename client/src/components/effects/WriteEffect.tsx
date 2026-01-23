import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WriteEffectProps {
  position: [number, number, number];
  intensity?: number;
}

interface FloatingPage {
  angle: number;
  speed: number;
  rotSpeed: number;
  startRadius: number;
  yOffset: number;
  scale: number;
}

const PAGE_COUNT = 6;

export default function WriteEffect({ position, intensity = 1 }: WriteEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pagesRef = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);

  const pages = useMemo<FloatingPage[]>(() => {
    return Array.from({ length: PAGE_COUNT }, (_, i) => ({
      angle: (i / PAGE_COUNT) * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      rotSpeed: 1 + Math.random() * 2,
      startRadius: 0.2,
      yOffset: 0.8 + Math.random() * 0.5,
      scale: 0.1 + Math.random() * 0.05,
    }));
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    pagesRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const page = pages[i];

      // Expand outward in spiral
      const t = (timeRef.current * page.speed) % 2;
      const radius = page.startRadius + t * 0.8;
      const angle = page.angle + t * 1.5;

      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      mesh.position.y = page.yOffset + t * 0.3;

      // Rotate the page
      mesh.rotation.x = timeRef.current * page.rotSpeed;
      mesh.rotation.z = timeRef.current * page.rotSpeed * 0.5;

      // Fade out as it expands
      const opacity = t < 0.2 ? t * 5 : (1 - t / 2) * 0.8;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * intensity;
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {pages.map((page, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) pagesRef.current[i] = el; }}
          position={[0, page.yOffset, 0]}
        >
          <planeGeometry args={[page.scale, page.scale * 1.4]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Central glow */}
      <pointLight color="#FFFFFF" intensity={1 * intensity} distance={3} />
    </group>
  );
}
