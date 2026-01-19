import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Grid() {
  const gridRef = useRef<THREE.LineSegments>(null);

  const gridGeometry = useMemo(() => {
    const size = 100;
    const divisions = 50;
    const step = size / divisions;
    const halfSize = size / 2;

    const vertices: number[] = [];

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfSize + i * step;
      vertices.push(-halfSize, 0, pos, halfSize, 0, pos);
      vertices.push(pos, 0, -halfSize, pos, 0, halfSize);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, []);

  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#00FFFF',
      transparent: true,
      opacity: 0.3,
    });
  }, []);

  useFrame(({ clock }) => {
    if (gridRef.current) {
      const time = clock.getElapsedTime();
      const opacity = 0.2 + Math.sin(time * 0.5) * 0.1;
      (gridRef.current.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  });

  return (
    <group>
      <lineSegments ref={gridRef} geometry={gridGeometry} material={gridMaterial} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
