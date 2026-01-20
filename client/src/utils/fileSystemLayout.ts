import { FileSystemNode } from '../stores/agentStore';

export interface LayoutNode {
  node: FileSystemNode;
  x: number;
  z: number;
  width: number;
  depth: number;
  children?: LayoutNode[];
}

// Grid configuration
const GRID_UNIT = 2;
const ITEM_SPACING = GRID_UNIT * 0.9;     // Space between items
const FILE_SIZE = GRID_UNIT;              // Size of a file building
const DIR_SIZE = GRID_UNIT;               // Size of a directory hub
const STREET_WIDTH = GRID_UNIT;           // Width of streets between rows
const DISTRICT_OFFSET_Z = GRID_UNIT * 1.5;  // How far the district starts from parent

interface SizedItem {
  node: FileSystemNode;
  layout?: LayoutNode;
  width: number;
  depth: number;
}

export function calculateLayout(root: FileSystemNode): LayoutNode {
  return layoutDistrict(root);
}

function layoutDistrict(node: FileSystemNode): LayoutNode {
  const children = node.children || [];

  const layout: LayoutNode = {
    node,
    x: 0,
    z: 0,
    width: DIR_SIZE,
    depth: DIR_SIZE,
    children: [],
  };

  if (children.length === 0) {
    return layout;
  }

  // Separate directories and files
  const directories = children.filter((c) => c.type === 'directory');
  const files = children.filter((c) => c.type === 'file');

  // Calculate sizes for all items
  const sizedItems: SizedItem[] = [];

  // Process directories first - they need recursive layout
  for (const dir of directories) {
    const childLayout = layoutDistrict(dir);
    sizedItems.push({
      node: dir,
      layout: childLayout,
      width: Math.max(DIR_SIZE, childLayout.width),
      depth: DIR_SIZE + DISTRICT_OFFSET_Z + childLayout.depth,
    });
  }

  // Files are simple fixed size
  for (const file of files) {
    sizedItems.push({
      node: file,
      width: FILE_SIZE,
      depth: FILE_SIZE,
    });
  }

  // Layout items in rows, packing by width
  const maxRowWidth = Math.max(30, Math.sqrt(sizedItems.length) * 8);
  const rows: SizedItem[][] = [];
  let currentRow: SizedItem[] = [];
  let currentRowWidth = 0;

  for (const item of sizedItems) {
    if (currentRow.length > 0 && currentRowWidth + item.width + ITEM_SPACING > maxRowWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentRowWidth = item.width;
    } else {
      currentRow.push(item);
      currentRowWidth += item.width + (currentRow.length > 1 ? ITEM_SPACING : 0);
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Calculate total dimensions and position items
  let totalWidth = 0;
  let totalDepth = DISTRICT_OFFSET_Z;
  let currentZ = DISTRICT_OFFSET_Z;

  for (const row of rows) {
    let rowWidth = 0;
    let rowDepth = 0;

    for (const item of row) {
      rowWidth += item.width + ITEM_SPACING;
      rowDepth = Math.max(rowDepth, item.depth);
    }
    rowWidth -= ITEM_SPACING; // Remove trailing spacing

    totalWidth = Math.max(totalWidth, rowWidth);

    // Position items in this row
    let currentX = -rowWidth / 2;

    for (const item of row) {
      const itemX = Math.round((currentX + item.width / 2) / GRID_UNIT) * GRID_UNIT;
      const itemZ = Math.round(currentZ / GRID_UNIT) * GRID_UNIT;

      if (item.layout) {
        // Directory with pre-calculated layout
        item.layout.x = itemX;
        item.layout.z = itemZ;
        layout.children!.push(item.layout);
      } else {
        // File
        layout.children!.push({
          node: item.node,
          x: itemX,
          z: itemZ,
          width: FILE_SIZE,
          depth: FILE_SIZE,
        });
      }

      currentX += item.width + ITEM_SPACING;
    }

    currentZ += rowDepth + STREET_WIDTH;
    totalDepth = currentZ;
  }

  layout.width = totalWidth;
  layout.depth = totalDepth;

  return layout;
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

  // If path starts with this node's path, return this position as fallback
  if (targetPath.startsWith(layout.node.path)) {
    return { x: absoluteX, z: absoluteZ };
  }

  return null;
}

export function getPathDepth(path: string, basePath: string): number {
  const relativePath = path.replace(basePath, '');
  return relativePath.split('/').filter(Boolean).length;
}

// Helper to get bounds of a layout
export function getLayoutBounds(layout: LayoutNode): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const children = layout.children || [];
  if (children.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const child of children) {
    minX = Math.min(minX, child.x - child.width / 2);
    maxX = Math.max(maxX, child.x + child.width / 2);
    minZ = Math.min(minZ, child.z);
    maxZ = Math.max(maxZ, child.z + child.depth);
  }

  return { minX, maxX, minZ, maxZ };
}
