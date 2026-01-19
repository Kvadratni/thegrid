import { FileSystemNode } from '../stores/agentStore';

export interface LayoutNode {
  node: FileSystemNode;
  x: number;
  z: number;
  children?: LayoutNode[];
}

const GRID_UNIT = 2;
const HORIZONTAL_SPACING = GRID_UNIT * 2;
const VERTICAL_SPACING = GRID_UNIT * 3;
const FILE_SPACING = GRID_UNIT;

interface TreeMetrics {
  width: number;
  layout: LayoutNode;
}

export function calculateLayout(root: FileSystemNode): LayoutNode {
  const metrics = layoutTree(root, 0);
  return metrics.layout;
}

function layoutTree(node: FileSystemNode, depth: number): TreeMetrics {
  const directories = (node.children || []).filter((c) => c.type === 'directory');
  const files = (node.children || []).filter((c) => c.type === 'file');

  const layout: LayoutNode = {
    node,
    x: 0,
    z: 0,
    children: [],
  };

  if (directories.length === 0 && files.length === 0) {
    return { width: HORIZONTAL_SPACING, layout };
  }

  const childMetrics = directories.map((dir) => layoutTree(dir, depth + 1));
  const totalDirWidth = childMetrics.reduce((sum, m) => sum + m.width, 0);

  let currentX = -totalDirWidth / 2;
  childMetrics.forEach((metrics) => {
    const childLayout = metrics.layout;
    childLayout.x = Math.round((currentX + metrics.width / 2) / GRID_UNIT) * GRID_UNIT;
    childLayout.z = VERTICAL_SPACING;
    currentX += metrics.width;
    layout.children!.push(childLayout);
  });

  const filesPerRow = Math.min(files.length, Math.max(3, Math.ceil(Math.sqrt(files.length))));
  const fileBlockWidth = filesPerRow * FILE_SPACING;

  files.forEach((file, i) => {
    const row = Math.floor(i / filesPerRow);
    const col = i % filesPerRow;
    const fileX = Math.round((col - (filesPerRow - 1) / 2) * FILE_SPACING / GRID_UNIT) * GRID_UNIT;
    const fileZ = Math.round((VERTICAL_SPACING * 0.5 + row * FILE_SPACING) / GRID_UNIT) * GRID_UNIT;

    layout.children!.push({
      node: file,
      x: fileX,
      z: fileZ,
    });
  });

  const filesWidth = files.length > 0 ? fileBlockWidth : 0;
  const myWidth = Math.max(totalDirWidth, filesWidth, HORIZONTAL_SPACING);

  return { width: myWidth + HORIZONTAL_SPACING, layout };
}

export function getPositionForPath(
  targetPath: string,
  fileSystem: FileSystemNode
): { x: number; z: number } | null {
  const layout = calculateLayout(fileSystem);
  return findPathInLayout(targetPath, layout, 0, 0);
}

function findPathInLayout(
  targetPath: string,
  layout: LayoutNode,
  parentX: number,
  parentZ: number
): { x: number; z: number } | null {
  const absoluteX = parentX + layout.x;
  const absoluteZ = parentZ + layout.z;

  if (layout.node.path === targetPath) {
    return { x: absoluteX, z: absoluteZ };
  }

  if (layout.children) {
    for (const child of layout.children) {
      const result = findPathInLayout(targetPath, child, absoluteX, absoluteZ);
      if (result) return result;
    }
  }

  if (targetPath.startsWith(layout.node.path)) {
    return { x: absoluteX, z: absoluteZ };
  }

  return null;
}

export function getPathDepth(path: string, basePath: string): number {
  const relativePath = path.replace(basePath, '');
  return relativePath.split('/').filter(Boolean).length;
}
