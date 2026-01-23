import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface BashEffectProps {
  position: [number, number, number];
  intensity?: number;
}

interface FloatingDigit {
  char: string;
  x: number;
  z: number;
  speed: number;
  startY: number;
  maxY: number;
  opacity: number;
  scale: number;
}

const DIGIT_COUNT = 12;

export default function BashEffect({ position, intensity = 1 }: BashEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const digitsRef = useRef<FloatingDigit[]>([]);
  const timeRef = useRef(0);

  // Initialize digits
  useMemo(() => {
    digitsRef.current = [];
    for (let i = 0; i < DIGIT_COUNT; i++) {
      digitsRef.current.push({
        char: Math.random() > 0.5 ? '1' : '0',
        x: (Math.random() - 0.5) * 1.2,
        z: (Math.random() - 0.5) * 1.2,
        speed: 0.8 + Math.random() * 1.2,
        startY: Math.random() * 0.5,
        maxY: 2 + Math.random() * 1.5,
        opacity: 0.7 + Math.random() * 0.3,
        scale: 0.15 + Math.random() * 0.1,
      });
    }
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (!groupRef.current) return;

    // Update each digit's position
    groupRef.current.children.forEach((child, i) => {
      if (i >= digitsRef.current.length) return;
      const digit = digitsRef.current[i];

      // Move up
      child.position.y += digit.speed * delta;

      // Reset when reaching max height
      if (child.position.y > digit.maxY) {
        child.position.y = digit.startY;
        child.position.x = (Math.random() - 0.5) * 1.2;
        child.position.z = (Math.random() - 0.5) * 1.2;
        digit.char = Math.random() > 0.5 ? '1' : '0';
      }

      // Fade based on height
      const progress = (child.position.y - digit.startY) / (digit.maxY - digit.startY);
      const fadeOpacity = progress < 0.2
        ? progress * 5
        : progress > 0.7
          ? (1 - progress) * 3.33
          : 1;

      if (child instanceof THREE.Mesh && child.material) {
        (child.material as THREE.MeshBasicMaterial).opacity = fadeOpacity * digit.opacity * intensity;
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {digitsRef.current.map((digit, i) => (
        <Text
          key={i}
          position={[digit.x, digit.startY, digit.z]}
          fontSize={digit.scale}
          color="#00FF00"
          anchorX="center"
          anchorY="middle"
          material-transparent={true}
          material-opacity={0}
        >
          {digit.char}
        </Text>
      ))}
    </group>
  );
}
