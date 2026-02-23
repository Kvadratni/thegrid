import { useMemo, useState, createContext, useContext, useRef } from 'react';
import { Text, Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAgentStore, FileSystemNode, ProcessInfo } from '../stores/agentStore';
import { calculateLayout, LayoutNode, getCachedPosition } from '../utils/fileSystemLayout';
import FileEffect from './effects/FileEffect';
import FileCrumble from './effects/FileCrumble';
import FileRise from './effects/FileRise';
import ProcessIndicator from './effects/ProcessIndicator';
import HologramViewer from './HologramViewer';
import GitEngine from './GitEngine';

interface FileSystemProps {
  node: FileSystemNode;
  position: [number, number, number];
}

// Render distance configuration
const RENDER_DISTANCE = 60;
const RENDER_DISTANCE_SQ = RENDER_DISTANCE * RENDER_DISTANCE;

// Camera position context for efficient culling
const CameraPositionContext = createContext<THREE.Vector3>(new THREE.Vector3());

function CameraPositionProvider({ children }: { children: React.ReactNode }) {
  const { camera } = useThree();
  const [camPos, setCamPos] = useState(() => new THREE.Vector3());
  const frameCount = useRef(0);

  useFrame(() => {
    // Update every 5 frames to reduce overhead
    frameCount.current++;
    if (frameCount.current % 5 === 0) {
      setCamPos(camera.position.clone());
    }
  });

  return (
    <CameraPositionContext.Provider value={camPos}>
      {children}
    </CameraPositionContext.Provider>
  );
}

function useCameraPosition() {
  return useContext(CameraPositionContext);
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

function Building({ layout, parentX = 0, parentZ = 0, isRoot = false }: { layout: LayoutNode; parentX?: number; parentZ?: number; isRoot?: boolean }) {
  const setCurrentPath = useAgentStore((state) => state.setCurrentPath);
  const setViewingFile = useAgentStore((state) => state.setViewingFile);
  const viewingFile = useAgentStore((state) => state.viewingFile);
  const gitStatus = useAgentStore((state) => state.gitStatus);
  const gitRepos = useAgentStore((state) => state.gitRepos);
  const setActiveGitRepoPath = useAgentStore((state) => state.setActiveGitRepoPath);
  const setGitPanelOpen = useAgentStore((state) => state.setGitPanelOpen);
  const camPos = useCameraPosition();

  const worldX = parentX + layout.x;
  const worldZ = parentZ + layout.z;

  const isDirectory = layout.node.type === 'directory';
  // Root is white/light blue to match portal, other directories are cyan
  let color = isRoot ? '#AADDFF' : isDirectory ? '#00FFFF' : getFileColor(layout.node.extension);
  const height = isDirectory ? 0.3 : Math.max(1, Math.min(6, (layout.node.size || 1000) / 3000));

  // Determine Git status color
  const gitFileParams = gitStatus.find(s => layout.node.path.endsWith(s.path));
  if (gitFileParams && !isDirectory) {
    if (gitFileParams.status === 'modified') color = '#FFFF00';
    if (gitFileParams.status === 'untracked' || gitFileParams.status === 'added') color = '#00FF00';
  }

  const darkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: gitFileParams && !isDirectory ? color : '#0a0a12',
      emissive: gitFileParams && !isDirectory ? color : '#000000',
      emissiveIntensity: gitFileParams && !isDirectory ? 0.4 : 0,
      transparent: true,
      opacity: gitFileParams && !isDirectory ? 0.95 : 0.85,
    });
  }, [gitFileParams, isDirectory, color]);

  const geometry = useMemo(() => {
    if (isDirectory) {
      return new THREE.CylinderGeometry(1.2, 1.2, 0.3, 6);
    }
    return new THREE.BoxGeometry(0.8, height, 0.8);
  }, [isDirectory, height]);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry);
  }, [geometry]);

  // Distance culling - check if this building is within render distance
  const dx = worldX - camPos.x;
  const dz = worldZ - camPos.z;
  const distanceSq = dx * dx + dz * dz;
  const isCulled = distanceSq > RENDER_DISTANCE_SQ;

  const handleClick = () => {
    if (isDirectory) {
      setCurrentPath(layout.node.path);
    } else {
      setViewingFile(layout.node.path);
    }
  };

  // If culled, only render children (they might be closer)
  if (isCulled) {
    return (
      <group position={[layout.x, 0, layout.z]}>
        {layout.children?.map((child) => (
          <Building key={child.node.path} layout={child} parentX={worldX} parentZ={worldZ} />
        ))}
      </group>
    );
  }

  return (
    <group position={[layout.x, 0, layout.z]}>
      <mesh
        geometry={geometry}
        position={[0, isDirectory ? 0.15 : height / 2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
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

      {/* Git Repo Crystal — only for directories that are known git repos */}
      {isDirectory && gitRepos.includes(layout.node.path) && (
        <GitEngine
          position={[0, 5, 0]}
          scale={0.8}
          repoPath={layout.node.path}
          onOpen={() => {
            setActiveGitRepoPath(layout.node.path);
            setGitPanelOpen(true);
          }}
        />
      )}

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
        <Building key={child.node.path} layout={child} parentX={worldX} parentZ={worldZ} />
      ))}

      {viewingFile === layout.node.path && !isDirectory && (
        <HologramViewer filePath={layout.node.path} height={height} />
      )}
    </group>
  );
}

const ROAD_WIDTH = 0.8;
const ROAD_HEIGHT = 0.02;
const NODE_SIZE = ROAD_WIDTH * 1.4;

function RoadNode({ x, z, color = '#FF6600' }: { x: number; z: number; color?: string }) {
  const camPos = useCameraPosition();

  const dx = x - camPos.x;
  const dz = z - camPos.z;
  const distanceSq = dx * dx + dz * dz;

  const nodeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    emissive: '#0a0a15',
    emissiveIntensity: 0.5,
  }), []);

  const edgeLine = useMemo(() => {
    const size = NODE_SIZE;
    const points = [
      new THREE.Vector3(-size / 2, ROAD_HEIGHT + 0.01, -size / 2),
      new THREE.Vector3(size / 2, ROAD_HEIGHT + 0.01, -size / 2),
      new THREE.Vector3(size / 2, ROAD_HEIGHT + 0.01, size / 2),
      new THREE.Vector3(-size / 2, ROAD_HEIGHT + 0.01, size / 2),
      new THREE.Vector3(-size / 2, ROAD_HEIGHT + 0.01, -size / 2),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    return new THREE.Line(geometry, material);
  }, [color]);

  if (distanceSq > RENDER_DISTANCE_SQ) {
    return null;
  }

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, ROAD_HEIGHT / 2, 0]}>
        <boxGeometry args={[NODE_SIZE, ROAD_HEIGHT, NODE_SIZE]} />
        <primitive object={nodeMaterial} attach="material" />
      </mesh>
      <primitive object={edgeLine} />
    </group>
  );
}

function RoadSegment({
  start,
  end,
  color = '#FF6600',
  shortenStart = false,
  shortenEnd = false,
}: {
  start: [number, number];
  end: [number, number];
  color?: string;
  shortenStart?: boolean;
  shortenEnd?: boolean;
}) {
  const camPos = useCameraPosition();
  const [x1, z1] = start;
  const [x2, z2] = end;

  const isHorizontal = z1 === z2;
  const nodeOffset = NODE_SIZE / 2;

  // Shorten the segment to stop at node edges
  let adjustedX1 = x1;
  let adjustedZ1 = z1;
  let adjustedX2 = x2;
  let adjustedZ2 = z2;

  if (shortenStart) {
    if (isHorizontal) {
      adjustedX1 = x1 < x2 ? x1 + nodeOffset : x1 - nodeOffset;
    } else {
      adjustedZ1 = z1 < z2 ? z1 + nodeOffset : z1 - nodeOffset;
    }
  }

  if (shortenEnd) {
    if (isHorizontal) {
      adjustedX2 = x2 > x1 ? x2 - nodeOffset : x2 + nodeOffset;
    } else {
      adjustedZ2 = z2 > z1 ? z2 - nodeOffset : z2 + nodeOffset;
    }
  }

  const length = isHorizontal ? Math.abs(adjustedX2 - adjustedX1) : Math.abs(adjustedZ2 - adjustedZ1);
  const centerX = (adjustedX1 + adjustedX2) / 2;
  const centerZ = (adjustedZ1 + adjustedZ2) / 2;

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
      points1.push(new THREE.Vector3(adjustedX1, ROAD_HEIGHT + 0.01, adjustedZ1 - halfWidth));
      points1.push(new THREE.Vector3(adjustedX2, ROAD_HEIGHT + 0.01, adjustedZ2 - halfWidth));
      points2.push(new THREE.Vector3(adjustedX1, ROAD_HEIGHT + 0.01, adjustedZ1 + halfWidth));
      points2.push(new THREE.Vector3(adjustedX2, ROAD_HEIGHT + 0.01, adjustedZ2 + halfWidth));
    } else {
      points1.push(new THREE.Vector3(adjustedX1 - halfWidth, ROAD_HEIGHT + 0.01, adjustedZ1));
      points1.push(new THREE.Vector3(adjustedX2 - halfWidth, ROAD_HEIGHT + 0.01, adjustedZ2));
      points2.push(new THREE.Vector3(adjustedX1 + halfWidth, ROAD_HEIGHT + 0.01, adjustedZ1));
      points2.push(new THREE.Vector3(adjustedX2 + halfWidth, ROAD_HEIGHT + 0.01, adjustedZ2));
    }

    const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
    const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });

    return [new THREE.Line(geo1, mat), new THREE.Line(geo2, mat.clone())];
  }, [adjustedX1, adjustedZ1, adjustedX2, adjustedZ2, isHorizontal, color]);

  // Distance culling for roads
  const dx = centerX - camPos.x;
  const dz = centerZ - camPos.z;
  const distanceSq = dx * dx + dz * dz;

  if (length === 0 || distanceSq > RENDER_DISTANCE_SQ) {
    return null;
  }

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

  // Straight road
  if (x1 === x2 || z1 === z2) {
    return <RoadSegment start={from} end={to} color={color} shortenStart shortenEnd />;
  }

  // L-shaped road: shorten at all connection points (start, corner, end)
  return (
    <group>
      <RoadSegment start={[x1, z1]} end={[x2, z1]} color={color} shortenStart shortenEnd />
      <RoadSegment start={[x2, z1]} end={[x2, z2]} color={color} shortenStart shortenEnd />
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
      <Road from={[0, 0]} to={[0, 8]} color="#AADDFF" />

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

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]} frustumCulled={false}>
          <cylinderGeometry args={[PORTAL_RADIUS, PORTAL_RADIUS, PORTAL_HEIGHT, 16]} />
          <primitive object={beamMaterial} attach="material" />
        </mesh>

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]} frustumCulled={false}>
          <cylinderGeometry args={[PORTAL_RADIUS * 3, PORTAL_RADIUS * 3, PORTAL_HEIGHT, 16]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>

        <mesh position={[0, PORTAL_HEIGHT / 2, 0]} frustumCulled={false}>
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
  const fileEffects = useAgentStore((state) => state.fileEffects);
  const fileAnimations = useAgentStore((state) => state.fileAnimations);
  const processes = useAgentStore((state) => state.processes);
  const layout = useMemo(() => calculateLayout(node), [node]);

  const { roads, nodes } = useMemo(() => {
    const roadList: { from: [number, number]; to: [number, number] }[] = [];
    const nodeSet = new Set<string>();

    function addNode(x: number, z: number) {
      nodeSet.add(`${x},${z}`);
    }

    function collectRoads(layoutNode: LayoutNode, parentX: number, parentZ: number) {
      const children = layoutNode.children || [];
      if (children.length === 0) return;

      // Add node at parent position
      addNode(parentX, parentZ);

      // Connect parent to each direct child
      children.forEach(child => {
        const childX = parentX + child.x;
        const childZ = parentZ + child.z;

        // L-shaped road from parent to child
        roadList.push({
          from: [parentX, parentZ],
          to: [childX, childZ],
        });

        // Add node at child position
        addNode(childX, childZ);

        // Add node at corner of L-shape (if it's an L-shape)
        if (parentX !== childX && parentZ !== childZ) {
          addNode(childX, parentZ);
        }

        // Recurse into directory children
        if (child.node.type === 'directory' && child.children && child.children.length > 0) {
          collectRoads(child, childX, childZ);
        }
      });
    }

    collectRoads(layout, 0, 0);

    const nodeList = Array.from(nodeSet).map(key => {
      const [x, z] = key.split(',').map(Number);
      return { x, z };
    });

    return { roads: roadList, nodes: nodeList };
  }, [layout]);

  // Helper to match paths
  const pathMatches = (nodePath: string, effectPath: string): boolean => {
    if (nodePath === effectPath) return true;
    if (nodePath.endsWith('/' + effectPath)) return true;
    if (nodePath.endsWith(effectPath)) return true;
    const effectFileName = effectPath.split('/').pop();
    const nodeFileName = nodePath.split('/').pop();
    if (effectFileName && effectFileName === nodeFileName) {
      const effectParts = effectPath.split('/');
      const nodeParts = nodePath.split('/');
      if (effectParts.length <= nodeParts.length) {
        const nodeEnd = nodeParts.slice(-effectParts.length);
        return effectParts.every((p, i) => p === nodeEnd[i]);
      }
    }
    return false;
  };

  const findNodeInfo = (path: string, layoutNode: LayoutNode, parentX: number, parentZ: number): { x: number; z: number; height: number } | null => {
    const absoluteX = parentX + layoutNode.x;
    const absoluteZ = parentZ + layoutNode.z;

    if (pathMatches(layoutNode.node.path, path)) {
      const isDir = layoutNode.node.type === 'directory';
      const height = isDir ? 0.3 : Math.max(1, Math.min(6, (layoutNode.node.size || 1000) / 3000));
      return { x: absoluteX, z: absoluteZ, height };
    }

    if (layoutNode.children) {
      for (const child of layoutNode.children) {
        const result = findNodeInfo(path, child, absoluteX, absoluteZ);
        if (result) return result;
      }
    }

    return null;
  };

  const effectPositions = useMemo(() => {
    return fileEffects.map(effect => {
      const info = findNodeInfo(effect.path, layout, 0, 0);
      return { effect, info };
    }).filter(item => item.info !== null);
  }, [fileEffects, layout]);

  const animationPositions = useMemo(() => {
    return fileAnimations.map(anim => {
      let info = findNodeInfo(anim.path, layout, 0, 0);

      // For delete animations, the file node is gone from the layout.
      // Recover its last known world position from the layout position cache.
      if (!info) {
        const cached = getCachedPosition(anim.path);
        if (cached) {
          info = { x: cached.x, z: cached.z, height: 2 };
        }
      }

      const estimatedInfo = info || { x: 0, z: 0, height: 2 };
      return { animation: anim, info: estimatedInfo };
    });
  }, [fileAnimations, layout]);

  // Group processes by their cwd and find positions
  const processPositions = useMemo(() => {
    const grouped = new Map<string, ProcessInfo[]>();

    // Group processes by their working directory
    processes.forEach(proc => {
      const existing = grouped.get(proc.cwd) || [];
      existing.push(proc);
      grouped.set(proc.cwd, existing);
    });

    // Find positions for each group
    const result: { process: ProcessInfo; position: { x: number; z: number }; index: number }[] = [];

    grouped.forEach((procs, cwd) => {
      const info = findNodeInfo(cwd, layout, 0, 0);
      if (info) {
        procs.forEach((proc, index) => {
          result.push({
            process: proc,
            position: { x: info.x, z: info.z },
            index,
          });
        });
      }
    });

    return result;
  }, [processes, layout]);

  return (
    <CameraPositionProvider>
      <group position={position}>
        <ParentPortal currentPath={currentPath} />
        {roads.map((road, i) => (
          <Road key={i} from={road.from} to={road.to} />
        ))}
        {nodes.map((node, i) => (
          <RoadNode key={`node-${i}`} x={node.x} z={node.z} />
        ))}
        <RoadNode x={0} z={0} color="#AADDFF" />
        <Building layout={layout} isRoot />

        {effectPositions.map(({ effect, info }) => (
          <FileEffect
            key={`${effect.path}-${effect.timestamp}`}
            effect={effect}
            position={[info!.x, info!.height, info!.z]}
          />
        ))}

        {animationPositions.map(({ animation, info }) => (
          animation.type === 'delete' ? (
            <FileCrumble
              key={`crumble-${animation.path}-${animation.startTime}`}
              position={[info.x, 0, info.z]}
              height={info.height}
              startTime={animation.startTime}
              color="#FF0000"
            />
          ) : (
            <FileRise
              key={`rise-${animation.path}-${animation.startTime}`}
              position={[info.x, 0, info.z]}
              height={info.height}
              startTime={animation.startTime}
              color="#00FF00"
              fileName={animation.path.split('/').pop()}
            />
          )
        ))}

        {processPositions.map(({ process, position, index }) => (
          <ProcessIndicator
            key={`process-${process.pid}`}
            process={process}
            position={[position.x, 0, position.z]}
            index={index}
          />
        ))}
      </group>
    </CameraPositionProvider>
  );
}
