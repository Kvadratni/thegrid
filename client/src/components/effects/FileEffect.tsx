import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FileEffect as FileEffectType } from '../../stores/agentStore';

interface FileEffectProps {
  effect: FileEffectType;
  position: [number, number, number];
}

export default function FileEffect({ effect, position }: FileEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(effect.timestamp);
  const particlesRef = useRef<THREE.Points>(null);

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 30;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.4;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 2;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / 2, 1);
    const baseY = position[1]; // File's top height

    switch (effect.type) {
      case 'create': {
        // Beam rising from file
        const scale = Math.min(progress * 1.5, 1);
        const rise = Math.min(elapsed * 2, 3);
        groupRef.current.scale.set(scale, scale, scale);
        groupRef.current.position.y = baseY + 0.5 + rise * 0.5;

        // Rotate particles
        if (particlesRef.current) {
          particlesRef.current.rotation.y += 0.03;
          const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 1] = (positions[i * 3 + 1] + 0.05) % 3;
          }
          particlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
        break;
      }
      case 'edit': {
        // Pulsing rings around file
        const pulse = 1 + Math.sin(elapsed * 8) * 0.2;
        groupRef.current.scale.setScalar(pulse);
        groupRef.current.rotation.y += 0.02;
        groupRef.current.position.y = baseY * 0.5 + Math.sin(elapsed * 4) * 0.2;
        break;
      }
      case 'read': {
        // Scanning beam moving up through file
        const fileHeight = baseY || 1;
        const scan = (elapsed * 1.5) % 1;
        groupRef.current.position.y = scan * (fileHeight + 2);
        groupRef.current.rotation.y += 0.05;
        const opacity = 0.8 - scan * 0.4;
        groupRef.current.scale.set(1 + scan * 0.3, 0.1, 1 + scan * 0.3);
        if (groupRef.current.children[0]) {
          const mesh = groupRef.current.children[0] as THREE.Mesh;
          if (mesh.material instanceof THREE.MeshBasicMaterial) {
            mesh.material.opacity = opacity;
          }
        }
        break;
      }
      case 'delete': {
        // Fragmenting/dissolving at file position
        const dissolve = 1 - progress;
        groupRef.current.scale.setScalar(dissolve * 1.5);
        groupRef.current.rotation.y += 0.15;
        groupRef.current.rotation.x += 0.1;
        groupRef.current.position.y = baseY * 0.5 + (1 - dissolve) * 2;
        break;
      }
    }
  });

  const getEffectColor = () => {
    switch (effect.type) {
      case 'create': return '#00FF00';
      case 'edit': return '#FFFF00';
      case 'read': return '#00FFFF';
      case 'delete': return '#FF0000';
      default: return effect.color;
    }
  };

  const color = getEffectColor();

  return (
    <group ref={groupRef} position={position}>
      {effect.type === 'create' && (
        <>
          {/* Rising beam */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.08, 0.15, 6, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
          {/* Base glow ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 1.0, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          {/* Inner ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Rising particles */}
          <points ref={particlesRef} geometry={particleGeometry}>
            <pointsMaterial color={color} size={0.08} transparent opacity={0.8} />
          </points>
          <pointLight color={color} intensity={3} distance={8} />
        </>
      )}

      {effect.type === 'edit' && (
        <>
          {/* Multiple rotating rings */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.06, 8, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} />
          </mesh>
          <mesh rotation={[Math.PI / 2.5, 0, 0]}>
            <torusGeometry args={[1.3, 0.04, 8, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
            <torusGeometry args={[0.7, 0.03, 8, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
          {/* Center glow */}
          <mesh>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
          <pointLight color={color} intensity={2} distance={6} />
        </>
      )}

      {effect.type === 'read' && (
        <>
          {/* Scanning plane */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 1.5, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          {/* Scan lines */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
            <ringGeometry args={[0.8, 0.85, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={color} intensity={1.5} distance={5} />
        </>
      )}

      {effect.type === 'delete' && (
        <>
          {/* Fragmenting shape */}
          <mesh>
            <octahedronGeometry args={[1.0, 1]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} wireframe />
          </mesh>
          <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.7, 0]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} wireframe />
          </mesh>
          {/* Glowing core */}
          <mesh>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
          <pointLight color={color} intensity={4} distance={6} />
        </>
      )}
    </group>
  );
}
