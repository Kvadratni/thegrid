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
const ITEM_CELLS = 2;  // Each item occupies 2x2 cells (includes spacing)

// Cell types: 0 = empty, 1 = file, 2 = directory
type CellType = 0 | 1 | 2;

// Occupancy grid to prevent overlaps
class OccupancyGrid {
  private cells: Map<string, CellType> = new Map();
  private minX = 0;
  private maxX = 0;
  private minZ = 0;
  private maxZ = 0;

  private key(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  isOccupied(gx: number, gz: number): boolean {
    return this.cells.has(this.key(gx, gz));
  }

  // Check if a rectangular area is free
  isAreaFree(gx: number, gz: number, width: number, depth: number): boolean {
    for (let x = gx; x < gx + width; x++) {
      for (let z = gz; z < gz + depth; z++) {
        if (this.isOccupied(x, z)) return false;
      }
    }
    return true;
  }

  // Mark a rectangular area as occupied
  occupy(gx: number, gz: number, width: number, depth: number, type: CellType): void {
    for (let x = gx; x < gx + width; x++) {
      for (let z = gz; z < gz + depth; z++) {
        this.cells.set(this.key(x, z), type);
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x + 1);
        this.minZ = Math.min(this.minZ, z);
        this.maxZ = Math.max(this.maxZ, z + 1);
      }
    }
  }

  // Find nearest free position using spiral search
  findFreePosition(startGx: number, startGz: number, width: number, depth: number): { gx: number; gz: number } {
    // Check starting position first
    if (this.isAreaFree(startGx, startGz, width, depth)) {
      return { gx: startGx, gz: startGz };
    }

    // Spiral outward to find free space
    for (let radius = 1; radius < 50; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue; // Only check perimeter
          const gx = startGx + dx;
          const gz = startGz + dz;
          if (this.isAreaFree(gx, gz, width, depth)) {
            return { gx, gz };
          }
        }
      }
    }

    // Fallback: just return original position
    return { gx: startGx, gz: startGz };
  }

  getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return {
      minX: this.minX * GRID_UNIT,
      maxX: this.maxX * GRID_UNIT,
      minZ: this.minZ * GRID_UNIT,
      maxZ: this.maxZ * GRID_UNIT,
    };
  }
}

// Calculate the size a subtree needs (in grid cells)
function calculateSubtreeSize(node: FileSystemNode): { width: number; depth: number } {
  const children = node.children || [];
  if (children.length === 0) {
    return { width: ITEM_CELLS, depth: ITEM_CELLS };
  }

  // Get sizes of all child subtrees
  const childSizes = children.map(child => calculateSubtreeSize(child));

  // Arrange children in a roughly square grid
  const cols = Math.ceil(Math.sqrt(children.length));
  const rows = Math.ceil(children.length / cols);

  // Calculate total width (max width per column) and depth (sum of row depths)
  let totalWidth = 0;
  let totalDepth = 0;

  for (let row = 0; row < rows; row++) {
    let rowWidth = 0;
    let rowDepth = 0;
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx < childSizes.length) {
        rowWidth += childSizes[idx].width;
        rowDepth = Math.max(rowDepth, childSizes[idx].depth);
      }
    }
    totalWidth = Math.max(totalWidth, rowWidth);
    totalDepth += rowDepth;
  }

  // Add space for the node itself
  return {
    width: Math.max(ITEM_CELLS, totalWidth),
    depth: ITEM_CELLS + totalDepth
  };
}

// Direction vectors for 4-way spread
const DIRECTIONS = [
  { dx: 0, dz: 1 },   // North (+Z)
  { dx: 1, dz: 0 },   // East (+X)
  { dx: 0, dz: -1 },  // South (-Z)
  { dx: -1, dz: 0 },  // West (-X)
];

export function calculateLayout(root: FileSystemNode): LayoutNode {
  const grid = new OccupancyGrid();
  // Reserve center for root
  grid.occupy(0, 0, ITEM_CELLS, ITEM_CELLS, 2);

  const layout = layoutWithGrid(root, grid, 0, 0, true);

  const bounds = grid.getBounds();
  layout.width = bounds.maxX - bounds.minX || GRID_UNIT;
  layout.depth = bounds.maxZ - bounds.minZ || GRID_UNIT;

  return layout;
}

function layoutWithGrid(
  node: FileSystemNode,
  grid: OccupancyGrid,
  parentGx: number,
  parentGz: number,
  isRoot: boolean
): LayoutNode {
  const children = node.children || [];

  const layout: LayoutNode = {
    node,
    x: parentGx * GRID_UNIT,
    z: parentGz * GRID_UNIT,
    width: GRID_UNIT,
    depth: GRID_UNIT,
    children: [],
  };

  if (children.length === 0) {
    return layout;
  }

  // Separate directories and files
  const directories = children.filter((c) => c.type === 'directory');
  const files = children.filter((c) => c.type === 'file');

  if (isRoot) {
    // Calculate subtree sizes for directories to pack them tightly
    const dirSizes = directories.map(dir => ({
      dir,
      size: calculateSubtreeSize(dir)
    }));

    // Group directories by direction (4 quadrants)
    const quadrants: typeof dirSizes[] = [[], [], [], []];
    dirSizes.forEach((item, i) => {
      quadrants[i % 4].push(item);
    });

    // Place each quadrant's directories
    quadrants.forEach((quadrant, dirIndex) => {
      const direction = DIRECTIONS[dirIndex];
      let offset = ITEM_CELLS + 1; // Start just outside center

      quadrant.forEach((item) => {
        const startGx = parentGx + direction.dx * offset;
        const startGz = parentGz + direction.dz * offset;

        const { gx, gz } = grid.findFreePosition(startGx, startGz, ITEM_CELLS, ITEM_CELLS);
        grid.occupy(gx, gz, ITEM_CELLS, ITEM_CELLS, 2);

        const childLayout = layoutWithGrid(item.dir, grid, gx, gz, false);
        childLayout.x = gx * GRID_UNIT;
        childLayout.z = gz * GRID_UNIT;
        layout.children!.push(childLayout);

        // Move offset by the size needed for this subtree
        const sizeInDirection = direction.dx !== 0 ? item.size.width : item.size.depth;
        offset += Math.max(ITEM_CELLS, Math.ceil(sizeInDirection / 2));
      });
    });

    // Place files around center in a tight ring
    files.forEach((file, i) => {
      const angle = (i / Math.max(files.length, 1)) * Math.PI * 2;
      const radius = ITEM_CELLS + 1 + Math.floor(i / 8);
      const startGx = parentGx + Math.round(Math.cos(angle) * radius);
      const startGz = parentGz + Math.round(Math.sin(angle) * radius);

      const { gx, gz } = grid.findFreePosition(startGx, startGz, ITEM_CELLS, ITEM_CELLS);
      grid.occupy(gx, gz, ITEM_CELLS, ITEM_CELLS, 1);

      layout.children!.push({
        node: file,
        x: gx * GRID_UNIT,
        z: gz * GRID_UNIT,
        width: GRID_UNIT,
        depth: GRID_UNIT,
      });
    });
  } else {
    // Non-root: place children in a compact grid pattern
    const allItems = [...directories, ...files];
    const cols = Math.ceil(Math.sqrt(allItems.length));

    allItems.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const startGx = parentGx + (col - Math.floor(cols / 2)) * ITEM_CELLS;
      const startGz = parentGz + (row + 1) * ITEM_CELLS;

      const { gx, gz } = grid.findFreePosition(startGx, startGz, ITEM_CELLS, ITEM_CELLS);

      if (item.type === 'directory') {
        grid.occupy(gx, gz, ITEM_CELLS, ITEM_CELLS, 2);
        const childLayout = layoutWithGrid(item, grid, gx, gz, false);
        childLayout.x = gx * GRID_UNIT;
        childLayout.z = gz * GRID_UNIT;
        layout.children!.push(childLayout);
      } else {
        grid.occupy(gx, gz, ITEM_CELLS, ITEM_CELLS, 1);
        layout.children!.push({
          node: item,
          x: gx * GRID_UNIT,
          z: gz * GRID_UNIT,
          width: GRID_UNIT,
          depth: GRID_UNIT,
        });
      }
    });
  }

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
