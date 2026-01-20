import { useRef } from 'react';
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

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / 2, 1);

    switch (effect.type) {
      case 'create': {
        const scale = Math.min(progress * 2, 1);
        groupRef.current.scale.setScalar(scale);
        groupRef.current.position.y = position[1] + Math.sin(elapsed * 4) * 0.1;
        break;
      }
      case 'edit': {
        const pulse = 1 + Math.sin(elapsed * 10) * 0.15;
        groupRef.current.scale.setScalar(pulse);
        break;
      }
      case 'read': {
        const scan = (elapsed * 2) % 1;
        groupRef.current.position.y = position[1] + scan * 3;
        groupRef.current.scale.y = 0.1;
        break;
      }
      case 'delete': {
        const dissolve = 1 - progress;
        groupRef.current.scale.setScalar(dissolve);
        groupRef.current.rotation.y += 0.1;
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
          <mesh>
            <ringGeometry args={[0.8, 1.2, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} />
          </mesh>
        </>
      )}

      {effect.type === 'edit' && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.05, 8, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]}>
            <torusGeometry args={[1.3, 0.03, 8, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
          </mesh>
        </>
      )}

      {effect.type === 'read' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {effect.type === 'delete' && (
        <>
          <mesh>
            <octahedronGeometry args={[0.8, 0]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} wireframe />
          </mesh>
          <pointLight color={color} intensity={2} distance={5} />
        </>
      )}

      <pointLight color={color} intensity={1} distance={4} />
    </group>
  );
}
