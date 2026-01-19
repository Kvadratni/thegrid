import { useMemo } from 'react';
import * as THREE from 'three';

interface ActivityTrailProps {
  points: THREE.Vector3[];
  color: string;
}

export default function ActivityTrail({ points, color }: ActivityTrailProps) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, 0.05, 8, false);
    return tubeGeometry;
  }, [points]);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
  }, [color]);

  if (!geometry) return null;

  return <mesh geometry={geometry} material={material} />;
}
