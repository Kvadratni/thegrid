import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FileCrumbleProps {
  position: [number, number, number];
  height: number;
  startTime: number;
  color?: string;
}

const PARTICLE_COUNT = 80;
const ANIMATION_DURATION = 2.5;

export default function FileCrumble({ position, height, startTime, color = '#FF0000' }: FileCrumbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const buildingRef = useRef<THREE.Group>(null);

  const { geometry, velocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const vels: THREE.Vector3[] = [];
    const rots: THREE.Vector3[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start positions within the building volume
      positions[i * 3] = (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      sizes[i] = 0.05 + Math.random() * 0.15;

      // Explosion velocities - outward and up initially, then down
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      vels.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        1 + Math.random() * 2,
        Math.sin(angle) * speed
      ));

      rots.push(new THREE.Vector3(
        Math.random() * 0.2,
        Math.random() * 0.2,
        Math.random() * 0.2
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return { geometry: geo, velocities: vels, rotations: rots };
  }, [height]);

  const fragmentGeometries = useMemo(() => {
    const frags: { geo: THREE.BufferGeometry; pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Vector3 }[] = [];
    const fragCount = 12;

    for (let i = 0; i < fragCount; i++) {
      const geo = new THREE.BoxGeometry(
        0.1 + Math.random() * 0.2,
        0.1 + Math.random() * 0.3,
        0.1 + Math.random() * 0.2
      );

      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.random() * height,
        (Math.random() - 0.5) * 0.6
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.5 + Math.random() * 1.5,
        Math.sin(angle) * speed
      );

      const rot = new THREE.Vector3(
        Math.random() * 0.3,
        Math.random() * 0.3,
        Math.random() * 0.3
      );

      frags.push({ geo, pos, vel, rot });
    }

    return frags;
  }, [height]);

  useFrame(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

    if (!groupRef.current) return;

    // Fade out the whole group
    groupRef.current.visible = progress < 1;

    // Animate building collapse
    if (buildingRef.current) {
      const collapseProgress = Math.min(elapsed / 0.5, 1);
      const scale = 1 - collapseProgress;
      buildingRef.current.scale.set(1, scale, 1);
      buildingRef.current.position.y = (height / 2) * scale;
    }

    // Animate particles
    if (particlesRef.current && elapsed > 0.2) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const particleProgress = Math.min((elapsed - 0.2) / (ANIMATION_DURATION - 0.2), 1);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const vel = velocities[i];
        const t = particleProgress;

        // Apply velocity with gravity
        positions[i * 3] += vel.x * 0.02;
        positions[i * 3 + 1] += (vel.y - t * 4) * 0.02; // Gravity effect
        positions[i * 3 + 2] += vel.z * 0.02;
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;

      // Fade particles
      const material = particlesRef.current.material as THREE.PointsMaterial;
      material.opacity = 1 - particleProgress;
    }
  });

  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed > ANIMATION_DURATION) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Collapsing building silhouette */}
      <group ref={buildingRef}>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[0.8, height, 0.8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} wireframe />
        </mesh>
      </group>

      {/* Flying fragments */}
      {fragmentGeometries.map((frag, i) => (
        <mesh
          key={i}
          position={[frag.pos.x, frag.pos.y, frag.pos.z]}
          rotation={[frag.rot.x * elapsed * 5, frag.rot.y * elapsed * 5, frag.rot.z * elapsed * 5]}
        >
          <primitive object={frag.geo} attach="geometry" />
          <meshBasicMaterial color={color} transparent opacity={Math.max(0, 1 - elapsed / ANIMATION_DURATION)} />
        </mesh>
      ))}

      {/* Particle explosion */}
      <points ref={particlesRef} geometry={geometry}>
        <pointsMaterial
          color={color}
          size={0.1}
          transparent
          opacity={1}
          sizeAttenuation
        />
      </points>

      {/* Flash effect at start */}
      {elapsed < 0.3 && (
        <mesh position={[0, height / 2, 0]}>
          <sphereGeometry args={[1 + elapsed * 3, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.5 - elapsed * 1.5} />
        </mesh>
      )}

      <pointLight color={color} intensity={Math.max(0, 5 - elapsed * 3)} distance={8} />
    </group>
  );
}
