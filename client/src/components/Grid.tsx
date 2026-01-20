import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const GRID_SIZE = 200;
const GRID_DIVISIONS = 100;
const GRID_STEP = GRID_SIZE / GRID_DIVISIONS;

export default function Grid() {
  const gridRef = useRef<THREE.LineSegments>(null);
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const gridGeometry = useMemo(() => {
    const halfSize = GRID_SIZE / 2;
    const vertices: number[] = [];

    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const pos = -halfSize + i * GRID_STEP;
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
    if (gridRef.current && planeRef.current) {
      const time = clock.getElapsedTime();
      const opacity = 0.2 + Math.sin(time * 0.5) * 0.1;
      (gridRef.current.material as THREE.LineBasicMaterial).opacity = opacity;

      // Snap grid position to grid units so it tiles seamlessly
      const snapX = Math.floor(camera.position.x / GRID_STEP) * GRID_STEP;
      const snapZ = Math.floor(camera.position.z / GRID_STEP) * GRID_STEP;

      gridRef.current.position.x = snapX;
      gridRef.current.position.z = snapZ;
      planeRef.current.position.x = snapX;
      planeRef.current.position.z = snapZ;
    }
  });

  return (
    <group>
      <lineSegments ref={gridRef} geometry={gridGeometry} material={gridMaterial} />
      <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
