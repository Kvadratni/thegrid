import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TaskSpawnEffectProps {
  position: [number, number, number];
  intensity?: number;
}

interface SpawnParticle {
  angle: number;
  speed: number;
  ySpeed: number;
  delay: number;
}

const PARTICLE_COUNT = 12;

export default function TaskSpawnEffect({ position, intensity = 1 }: TaskSpawnEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);

  const particles = useMemo<SpawnParticle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.6,
      ySpeed: 0.3 + Math.random() * 0.4,
      delay: Math.random() * 0.5,
    }));
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    particlesRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const particle = particles[i];

      // Burst outward
      const t = ((timeRef.current - particle.delay + 2) % 2);
      if (t < 0) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      const radius = t * particle.speed;
      mesh.position.x = Math.cos(particle.angle) * radius;
      mesh.position.z = Math.sin(particle.angle) * radius;
      mesh.position.y = 0.5 + t * particle.ySpeed;

      // Trail effect - stretch in direction of movement
      mesh.scale.z = 1 + t * 2;

      // Fade out
      const opacity = t < 0.2 ? t * 5 : Math.max(0, 1 - t / 1.5);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = opacity * 0.8 * intensity;
    });

    // Rotate spawn center
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 2;
    }
  });

  return (
    <group position={position}>
      <group ref={groupRef}>
        {particles.map((particle, i) => (
          <mesh
            key={i}
            ref={(el) => { if (el) particlesRef.current[i] = el; }}
            position={[0, 0.5, 0]}
            rotation={[0, particle.angle, 0]}
          >
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshBasicMaterial color="#FF6600" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Central spawn orb */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={0.5 * intensity} />
      </mesh>

      {/* Spawn ring */}
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 6]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={0.4 * intensity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
