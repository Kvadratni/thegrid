import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface FileRiseProps {
  position: [number, number, number];
  height: number;
  startTime: number;
  color?: string;
  fileName?: string;
}

const ANIMATION_DURATION = 2.0;
const PARTICLE_COUNT = 40;

export default function FileRise({ position, height, startTime, color = '#00FF00', fileName }: FileRiseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const buildingRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const ringsRef = useRef<THREE.Group>(null);

  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.4;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -2 + Math.random() * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

    if (!groupRef.current) return;
    groupRef.current.visible = progress < 1;

    // Easing function for smooth rise
    const easeOutBack = (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    const riseProgress = easeOutBack(Math.min(progress * 1.2, 1));

    // Animate building rising from below
    if (buildingRef.current) {
      const startY = -height - 1;
      const endY = height / 2;
      buildingRef.current.position.y = startY + (endY - startY) * riseProgress;

      // Scale pulse at the end
      const scaleProgress = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;
      const scale = 1 + Math.sin(scaleProgress * Math.PI) * 0.1;
      buildingRef.current.scale.set(scale, 1, scale);
    }

    // Animate particles rising
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3 + 1] += 0.08; // Rise speed
        if (positions[i * 3 + 1] > height + 2) {
          positions[i * 3 + 1] = -1;
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
      particlesRef.current.rotation.y += 0.02;

      const material = particlesRef.current.material as THREE.PointsMaterial;
      material.opacity = progress < 0.8 ? 0.8 : (1 - progress) * 4;
    }

    // Animate rings
    if (ringsRef.current) {
      ringsRef.current.rotation.y += 0.03;
      const ringScale = 1 + progress * 0.5;
      ringsRef.current.scale.set(ringScale, 1, ringScale);

      ringsRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.opacity = Math.max(0, 0.6 - progress * 0.8);
        }
      });
    }
  });

  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed > ANIMATION_DURATION) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Rising building */}
      <mesh ref={buildingRef} position={[0, -height, 0]}>
        <boxGeometry args={[0.8, height, 0.8]} />
        <meshStandardMaterial
          color="#0a0a12"
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Building edge glow */}
      <mesh position={[0, buildingRef.current?.position.y || 0, 0]}>
        <boxGeometry args={[0.85, height * 1.02, 0.85]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} wireframe />
      </mesh>

      {/* Rising particles */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color={color}
          size={0.1}
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>

      {/* Expanding rings at base */}
      <group ref={ringsRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[1.6, 1.7, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Ground emergence effect */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* File name floating up */}
      {fileName && (
        <Billboard position={[0, Math.min(elapsed * 2, height + 1), 0]}>
          <Text
            fontSize={0.3}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {fileName}
          </Text>
        </Billboard>
      )}

      {/* Beam of light from below */}
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[0.1, 0.5, 4, 8]} />
        <meshBasicMaterial color={color} transparent opacity={Math.max(0, 0.5 - elapsed * 0.3)} />
      </mesh>

      <pointLight color={color} intensity={3} distance={10} position={[0, height / 2, 0]} />
    </group>
  );
}
