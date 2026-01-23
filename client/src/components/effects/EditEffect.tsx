import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface EditEffectProps {
  position: [number, number, number];
  intensity?: number;
}

interface DiffSymbol {
  char: string;
  color: string;
  angle: number;
  radius: number;
  y: number;
  pulseOffset: number;
}

const SYMBOL_COUNT = 8;

export default function EditEffect({ position, intensity = 1 }: EditEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const symbols = useMemo<DiffSymbol[]>(() => {
    return Array.from({ length: SYMBOL_COUNT }, (_, i) => ({
      char: i % 2 === 0 ? '+' : '-',
      color: i % 2 === 0 ? '#00FF00' : '#FF4444',
      angle: (i / SYMBOL_COUNT) * Math.PI * 2,
      radius: 0.6 + (i % 3) * 0.2,
      y: 0.5 + (i % 2) * 0.4,
      pulseOffset: i * 0.5,
    }));
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // Slow rotation
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {symbols.map((symbol, i) => {
        const pulse = Math.sin(timeRef.current * 3 + symbol.pulseOffset) * 0.5 + 0.5;
        const x = Math.cos(symbol.angle) * symbol.radius;
        const z = Math.sin(symbol.angle) * symbol.radius;

        return (
          <Text
            key={i}
            position={[x, symbol.y + pulse * 0.2, z]}
            fontSize={0.2}
            color={symbol.color}
            anchorX="center"
            anchorY="middle"
            material-transparent={true}
            material-opacity={0.5 + pulse * 0.5 * intensity}
          >
            {symbol.char}
          </Text>
        );
      })}

      {/* Central edit indicator */}
      <mesh position={[0, 0.8, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial color="#FFFF00" transparent opacity={0.6 * intensity} />
      </mesh>
    </group>
  );
}
