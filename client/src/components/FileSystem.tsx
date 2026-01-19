import { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useAgentStore, FileSystemNode } from '../stores/agentStore';
import { calculateLayout, LayoutNode } from '../utils/fileSystemLayout';

interface FileSystemProps {
  node: FileSystemNode;
  position: [number, number, number];
}

const FILE_COLORS: Record<string, string> = {
  ts: '#00FFFF',
  tsx: '#00FFFF',
  js: '#00FFFF',
  jsx: '#00FFFF',
  json: '#FFFF00',
  yaml: '#FFFF00',
  yml: '#FFFF00',
  md: '#FF6600',
  txt: '#FF6600',
  css: '#FF6600',
  scss: '#FF6600',
  html: '#FF6600',
  default: '#FFFFFF',
};

function getFileColor(extension?: string): string {
  if (!extension) return FILE_COLORS.default;
  return FILE_COLORS[extension.toLowerCase()] || FILE_COLORS.default;
}

function Building({ layout }: { layout: LayoutNode }) {
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);
  const isDirectory = layout.node.type === 'directory';
  const color = isDirectory ? '#00FFFF' : getFileColor(layout.node.extension);
  const height = isDirectory ? 0.3 : Math.max(1, Math.min(6, (layout.node.size || 1000) / 3000));

  const darkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#0a0a12',
      emissive: '#000000',
      transparent: true,
      opacity: 0.85,
    });
  }, []);

  const handleClick = () => {
    if (isDirectory) {
      setCurrentPath(layout.node.path);
    }
  };

  const geometry = useMemo(() => {
    if (isDirectory) {
      return new THREE.CylinderGeometry(1.2, 1.2, 0.3, 6);
    }
    return new THREE.BoxGeometry(0.8, height, 0.8);
  }, [isDirectory, height]);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry);
  }, [geometry]);

  return (
    <group position={[layout.x, 0, layout.z]}>
      <mesh
        geometry={geometry}
        position={[0, isDirectory ? 0.15 : height / 2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          if (isDirectory) {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <primitive object={darkMaterial} attach="material" />
      </mesh>

      <lineSegments
        geometry={edgesGeometry}
        position={[0, isDirectory ? 0.15 : height / 2, 0]}
      >
        <lineBasicMaterial color={color} transparent opacity={0.8} />
      </lineSegments>

      {!isDirectory && (
        <mesh position={[0, height + 0.05, 0]}>
          <boxGeometry args={[0.85, 0.1, 0.85]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
      )}

      <Billboard position={[0, isDirectory ? 0.8 : height + 0.5, 0]}>
        <Text
          fontSize={0.35}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {layout.node.name}
        </Text>
      </Billboard>

      {layout.children?.map((child) => (
        <Building key={child.node.path} layout={child} />
      ))}
    </group>
  );
}

const ROAD_WIDTH = 0.8;
const ROAD_HEIGHT = 0.02;

function RoadSegment({
  start,
  end,
  color = '#FF6600'
}: {
  start: [number, number];
  end: [number, number];
  color?: string;
}) {
  const [x1, z1] = start;
  const [x2, z2] = end;

  const isHorizontal = z1 === z2;
  const length = isHorizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const centerX = (x1 + x2) / 2;
  const centerZ = (z1 + z2) / 2;

  const roadMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    emissive: '#0a0a15',
    emissiveIntensity: 0.5,
  }), []);

  const edgeLines = useMemo(() => {
    const halfWidth = ROAD_WIDTH / 2;
    const points1: THREE.Vector3[] = [];
    const points2: THREE.Vector3[] = [];

    if (isHorizontal) {
      points1.push(new THREE.Vector3(x1, ROAD_HEIGHT + 0.01, z1 - halfWidth));
      points1.push(new THREE.Vector3(x2, ROAD_HEIGHT + 0.01, z2 - halfWidth));
      points2.push(new THREE.Vector3(x1, ROAD_HEIGHT + 0.01, z1 + halfWidth));
      points2.push(new THREE.Vector3(x2, ROAD_HEIGHT + 0.01, z2 + halfWidth));
    } else {
      points1.push(new THREE.Vector3(x1 - halfWidth, ROAD_HEIGHT + 0.01, z1));
      points1.push(new THREE.Vector3(x2 - halfWidth, ROAD_HEIGHT + 0.01, z2));
      points2.push(new THREE.Vector3(x1 + halfWidth, ROAD_HEIGHT + 0.01, z1));
      points2.push(new THREE.Vector3(x2 + halfWidth, ROAD_HEIGHT + 0.01, z2));
    }

    const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
    const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });

    return [new THREE.Line(geo1, mat), new THREE.Line(geo2, mat.clone())];
  }, [x1, z1, x2, z2, isHorizontal, color]);

  if (length === 0) return null;

  return (
    <group>
      <mesh
        position={[centerX, ROAD_HEIGHT / 2, centerZ]}
        rotation={[0, isHorizontal ? 0 : Math.PI / 2, 0]}
      >
        <boxGeometry args={[length, ROAD_HEIGHT, ROAD_WIDTH]} />
        <primitive object={roadMaterial} attach="material" />
      </mesh>
      <primitive object={edgeLines[0]} />
      <primitive object={edgeLines[1]} />
    </group>
  );
}

function Road({ from, to, color = '#FF6600' }: { from: [number, number]; to: [number, number]; color?: string }) {
  const [x1, z1] = from;
  const [x2, z2] = to;

  if (x1 === x2 || z1 === z2) {
    return <RoadSegment start={from} end={to} color={color} />;
  }

  return (
    <group>
      <RoadSegment start={[x1, z1]} end={[x2, z1]} color={color} />
      <RoadSegment start={[x2, z1]} end={[x2, z2]} color={color} />
    </group>
  );
}

function ParentPortal({ currentPath }: { currentPath: string }) {
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);

  const parentPath = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    return '/' + parts.slice(0, -1).join('/');
  }, [currentPath]);

  const PORTAL_HEIGHT = 50;
  const PORTAL_RADIUS = 0.15;

  const beamMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.6,
  }), []);

  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#AADDFF',
    transparent: true,
    opacity: 0.15,
  }), []);

  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    emissive: '#0a0a15',
    emissiveIntensity: 0.5,
  }), []);

  const baseEdgeMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: '#AADDFF',
    transparent: true,
    opacity: 0.8,
  }), []);

  const baseGeometry = useMemo(() => new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32), []);
  const baseEdges = useMemo(() => new THREE.EdgesGeometry(baseGeometry), [baseGeometry]);

  if (!parentPath) return null;

  const handleClick = () => {
    setCurrentPath(parentPath);
  };

  return (
    <group position={[0, 0, -8]}>
      <Road from={[0, 0]} to={[0, 8]} color="#FF6600" />

      <group
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <mesh geometry={baseGeometry} position={[0, 0.05, 0]}>
          <primitive object={baseMaterial} attach="material" />
        </mesh>
        <lineSegments geometry={baseEdges} position={[0, 0.05, 0]}>
          <primitive object={baseEdgeMaterial} attach="material" />
        </lineSegments>

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[PORTAL_RADIUS, PORTAL_RADIUS, PORTAL_HEIGHT, 16]} />
          <primitive object={beamMaterial} attach="material" />
        </mesh>

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[PORTAL_RADIUS * 3, PORTAL_RADIUS * 3, PORTAL_HEIGHT, 16]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[PORTAL_RADIUS * 6, PORTAL_RADIUS * 6, PORTAL_HEIGHT, 16]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>

        <pointLight position={[0, 2, 0]} intensity={0.5} color="#AADDFF" distance={8} />
      </group>

      <Billboard position={[0, 2.5, 0]}>
        <Text
          fontSize={0.4}
          color="#AADDFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {parentPath.split('/').pop()}
        </Text>
      </Billboard>
    </group>
  );
}

export default function FileSystem({ node, position }: FileSystemProps) {
  const currentPath = useAgentStore((state) => state.currentPath);
  const layout = useMemo(() => calculateLayout(node), [node]);

  const roads = useMemo(() => {
    const result: { from: [number, number]; to: [number, number] }[] = [];

    function collectRoads(layoutNode: LayoutNode) {
      if (layoutNode.children) {
        for (const child of layoutNode.children) {
          result.push({
            from: [layoutNode.x, layoutNode.z],
            to: [layoutNode.x + child.x, layoutNode.z + child.z],
          });
          collectRoads(child);
        }
      }
    }

    collectRoads(layout);
    return result;
  }, [layout]);

  return (
    <group position={position}>
      <ParentPortal currentPath={currentPath} />
      {roads.map((road, i) => (
        <Road key={i} from={road.from} to={road.to} />
      ))}
      <Building layout={layout} />
    </group>
  );
}
