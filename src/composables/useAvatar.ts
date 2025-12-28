import * as THREE from 'three';
import * as C from '../constants';
import type { ArmCell, BodyCell } from '../types';

// Row fill edges information (first/last non-space columns and row width)
type RowEdge = { firstCol: number; lastCol: number; width: number };

function computeRowEdges(pattern: string[]): Array<RowEdge | null> {
  const edges: Array<RowEdge | null> = [];
  for (let r = 0; r < pattern.length; r++) {
    const row = pattern[r] ?? '';
    let first = -1;
    let last = -1;
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== ' ') {
        if (first === -1) first = c;
        last = c;
      }
    }
    if (first === -1 || last === -1) edges.push(null);
    else edges.push({ firstCol: first, lastCol: last, width: last - first + 1 });
  }
  return edges;
}

function buildBodyMesh(
  player: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  cells: BodyCell[],
  depth: number,
  spacing: number
) {
  const dummy = new THREE.Object3D();
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length * depth);
  // Prevent incorrect culling for widely spread instances (helps mirrors)
  mesh.frustumCulled = false;
  let idx = 0;
  for (const cell of cells) {
    for (let k = 0; k < depth; k += 1) {
      const z = (k - (depth - 1) / 2) * spacing;
      dummy.position.set(cell.x, cell.y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  player.clear();
  player.add(mesh);
  return mesh;
}

function buildLimbGroup(
  player: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  cells: ArmCell[],
  depth: number,
  spacing: number,
  cellSize: number,
  sideSign: -1 | 1
) {
  if (cells.length === 0) return null;
  let pivotX = 0;
  let pivotY = 0;
  for (const p of cells) {
    pivotX += p.x;
    pivotY += p.y;
  }
  pivotX /= cells.length;
  pivotY /= cells.length;
  // Move pivot slightly outward to look like a shoulder joint
  pivotX -= sideSign * cellSize * 1.0;

  const group = new THREE.Group();
  group.position.set(pivotX, pivotY, 0);
  const dummy = new THREE.Object3D();
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length * depth);
  // Prevent incorrect culling for widely spread instances (helps mirrors)
  mesh.frustumCulled = false;
  let idx = 0;
  for (const cell of cells) {
    for (let k = 0; k < depth; k += 1) {
      const z = (k - (depth - 1) / 2) * spacing;
      dummy.position.set(cell.x - pivotX, cell.y - pivotY, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  player.add(group);
  group.add(mesh);
  return group;
}

// (removed) selectHandOnly helper was unused under strict noUnusedLocals

export function useAvatar(
  player: THREE.Group,
  addToDispose: (
    res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
  ) => void
) {
  const CELL = C.AVATAR_CELL;
  const DEPTH = C.AVATAR_DEPTH;
  const SPACING = C.AVATAR_SPACING;

  const rows = C.LOGO_PATTERN.length;
  const cols = C.LOGO_PATTERN[0]?.length ?? 0;
  const halfWidthX = ((cols - 1) * CELL) / 2;
  const halfHeightY = ((rows - 1) * CELL) / 2;
  const baseY = halfHeightY + 0.02;

  const voxelGeometry = new THREE.BoxGeometry(CELL, CELL, CELL);
  const voxelMaterial = new THREE.MeshStandardMaterial({
    color: C.AVATAR_COLOR,
    roughness: C.AVATAR_MAT_ROUGHNESS,
    metalness: C.AVATAR_MAT_METALNESS,
  });

  const bodyCells: BodyCell[] = [];
  const leftArmCells: ArmCell[] = [];
  const rightArmCells: ArmCell[] = [];
  // Collect explicit hands marked by 'X' characters in the pattern
  const leftHandXCells: ArmCell[] = [];
  const rightHandXCells: ArmCell[] = [];
  const leftFootCells: Array<{
    x: number;
    y: number;
    row: number;
    col: number;
  }> = [];
  const rightFootCells: Array<{
    x: number;
    y: number;
    row: number;
    col: number;
  }> = [];

  const centerCol = (cols - 1) / 2;
  const armBandTop = Math.floor(rows * C.ARM_BAND_TOP_RATIO);
  const armBandBottom = Math.floor(rows * C.ARM_BAND_BOTTOM_RATIO);
  // Use per-row edge distance (based on row width) as threshold in X direction
  const edgeMinRatio = C.ARM_THRESHOLD_MIN_RATIO;
  const edgeMaxRatio = C.ARM_THRESHOLD_MAX_RATIO;

  // Precompute row edges and hand markers
  const rowEdges = computeRowEdges(C.LOGO_PATTERN);
  const hasHandX = C.LOGO_PATTERN.some((r) => r?.includes('X'));

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const rowString = C.LOGO_PATTERN[rowIndex] ?? '';
    for (let colIndex = 0; colIndex < rowString.length; colIndex++) {
      const ch = rowString[colIndex] ?? ' ';
      if (ch === ' ') continue;
      const posX = colIndex * CELL - halfWidthX;
      const posY = (rows - 1 - rowIndex) * CELL - halfHeightY + baseY;
      // Use each row's outer-edge distances (better X-direction precision)
      const edges = rowEdges[rowIndex];
      const legBandTop = Math.floor(rows * C.LEG_BAND_TOP_RATIO);
      const inLegBand = rowIndex >= legBandTop;
      const legCenterThreshold = Math.floor(
        cols * C.LEG_THRESHOLD_CENTER_RATIO
      );
      const colDistanceCenter = Math.abs(colIndex - centerCol);
      const inLegCols = colDistanceCenter <= legCenterThreshold;
      if (ch === 'X') {
        // Treat 'X' in pattern as hands; exclude from body
        if (colIndex < centerCol)
          leftHandXCells.push({
            x: posX,
            y: posY,
            col: colIndex,
            colDelta: 0,
            colDeltaInt: 0,
            row: rowIndex,
          });
        else
          rightHandXCells.push({
            x: posX,
            y: posY,
            col: colIndex,
            colDelta: 0,
            colDeltaInt: 0,
            row: rowIndex,
          });
      } else if (C.ENABLE_LEG_SWING && inLegBand && inLegCols) {
        if (colIndex < centerCol)
          leftFootCells.push({
            x: posX,
            y: posY,
            row: rowIndex,
            col: colIndex,
          });
        else
          rightFootCells.push({
            x: posX,
            y: posY,
            row: rowIndex,
            col: colIndex,
          });
      } else if (
        !hasHandX &&
        rowIndex >= armBandTop &&
        rowIndex <= armBandBottom &&
        edges
      ) {
        // Extract arms using an outer-edge band per-row (distance from edges)
        const { firstCol, lastCol, width } = edges;
        const minFromEdge = Math.floor(width * edgeMinRatio);
        const maxFromEdge = Math.floor(width * edgeMaxRatio);
        const leftDist = colIndex - firstCol; // distance from left edge
        const rightDist = lastCol - colIndex; // distance from right edge
        if (leftDist >= minFromEdge && leftDist <= maxFromEdge) {
          leftArmCells.push({
            x: posX,
            y: posY,
            col: colIndex,
            colDelta: leftDist,
            colDeltaInt: Math.floor(leftDist + 1e-6),
            row: rowIndex,
          });
        } else if (rightDist >= minFromEdge && rightDist <= maxFromEdge) {
          rightArmCells.push({
            x: posX,
            y: posY,
            col: colIndex,
            colDelta: rightDist,
            colDeltaInt: Math.floor(rightDist + 1e-6),
            row: rowIndex,
          });
        } else {
          bodyCells.push({ x: posX, y: posY, row: rowIndex, col: colIndex });
        }
      } else {
        bodyCells.push({ x: posX, y: posY, row: rowIndex, col: colIndex });
      }
    }
  }

  // symmetry by row
  const byRowLeft: Record<number, ArmCell[]> = {};
  const byRowRight: Record<number, ArmCell[]> = {};
  for (const p of leftArmCells) (byRowLeft[p.row] ??= []).push(p);
  for (const p of rightArmCells) (byRowRight[p.row] ??= []).push(p);
  const leftArmTrimmed: ArmCell[] = [];
  const rightArmTrimmed: ArmCell[] = [];
  for (let rowIndex = armBandTop; rowIndex <= armBandBottom; rowIndex += 1) {
    const L = byRowLeft[rowIndex] ?? [];
    const R = byRowRight[rowIndex] ?? [];
    if (L.length === 0 && R.length === 0) continue;
    const lMax = L.reduce((m, p) => Math.max(m, p.colDeltaInt), 0);
    const rMax = R.reduce((m, p) => Math.max(m, p.colDeltaInt), 0);
    const lim = Math.min(lMax, rMax);
    for (const p of L) if (p.colDeltaInt <= lim) leftArmTrimmed.push(p);
    for (const p of R) if (p.colDeltaInt <= lim) rightArmTrimmed.push(p);
  }

  // fallback outer columns
  let finalLeft = leftArmTrimmed;
  let finalRight = rightArmTrimmed;
  const needFallback =
    finalLeft.length < C.ARM_MIN_CELLS_FOR_SWING ||
    finalRight.length < C.ARM_MIN_CELLS_FOR_SWING;
  if (!hasHandX && needFallback) {
    finalLeft = [];
    finalRight = [];
    for (let rowIndex = armBandTop; rowIndex <= armBandBottom; rowIndex += 1) {
      const rowString = C.LOGO_PATTERN[rowIndex] ?? '';
      if (!rowString) continue;
      let firstCol = -1;
      let lastCol = -1;
      for (let colIndex = 0; colIndex < cols; colIndex += 1) {
        if (rowString[colIndex] !== ' ') {
          if (firstCol === -1) firstCol = colIndex;
          lastCol = colIndex;
        }
      }
      if (firstCol === -1 || lastCol === -1) continue;
      for (let width = 0; width < C.ARM_FALLBACK_WIDTH_COLS; width += 1) {
        const leftCol = firstCol + width;
        const rightCol = lastCol - width;
        let posX = leftCol * CELL - halfWidthX;
        let posY = (rows - 1 - rowIndex) * CELL - halfHeightY + baseY;
        let colDistance = Math.abs(leftCol - centerCol);
        finalLeft.push({
          x: posX,
          y: posY,
          col: leftCol,
          colDelta: colDistance,
          colDeltaInt: Math.floor(colDistance + 1e-6),
          row: rowIndex,
        });
        posX = rightCol * CELL - halfWidthX;
        posY = (rows - 1 - rowIndex) * CELL - halfHeightY + baseY;
        colDistance = Math.abs(rightCol - centerCol);
        finalRight.push({
          x: posX,
          y: posY,
          col: rightCol,
          colDelta: colDistance,
          colDeltaInt: Math.floor(colDistance + 1e-6),
          row: rowIndex,
        });
      }
    }
  }

  // Restrict to hands only (prefer outer + lower-band rows, up to N cells)
  if (!hasHandX && C.ARM_SELECT_HAND_ONLY) {
    const pickHandCells = (cells: ArmCell[]) => {
      if (cells.length <= C.ARM_HAND_CELLS_PER_SIDE) return cells;
      // Prefer lower rows (larger row index), then closer to edge (smaller colDelta)
      const sorted = [...cells].sort((a, b) => {
        if (a.row !== b.row) return b.row - a.row;
        return a.colDelta - b.colDelta;
      });
      return sorted.slice(0, C.ARM_HAND_CELLS_PER_SIDE);
    };
    finalLeft = pickHandCells(finalLeft);
    finalRight = pickHandCells(finalRight);
  }

  // If hands are marked with 'X', prefer those
  if (hasHandX) {
    finalLeft = leftHandXCells;
    finalRight = rightHandXCells;
  }

  // Body mesh excluding arm/foot cells (hands marked with 'X' were never in body)
  const key = (r: number, c: number) => `${r}:${c}`;
  const armCellsSet = new Set<string>();
  for (const p of finalLeft) armCellsSet.add(key(p.row, p.col));
  for (const p of finalRight) armCellsSet.add(key(p.row, p.col));
  const footCellsSet = new Set<string>();
  for (const p of leftFootCells) footCellsSet.add(key(p.row, p.col));
  for (const p of rightFootCells) footCellsSet.add(key(p.row, p.col));
  const bodyFiltered = bodyCells.filter(
    (b) => !armCellsSet.has(key(b.row, b.col)) && !footCellsSet.has(key(b.row, b.col))
  );
  buildBodyMesh(player, voxelGeometry, voxelMaterial, bodyFiltered, DEPTH, SPACING);

  const armLeft = buildLimbGroup(
    player,
    voxelGeometry,
    voxelMaterial,
    finalLeft,
    DEPTH,
    SPACING,
    CELL,
    -1
  );
  const armRight = buildLimbGroup(
    player,
    voxelGeometry,
    voxelMaterial,
    finalRight,
    DEPTH,
    SPACING,
    CELL,
    1
  );

  function buildFootGroupMesh(cells: Array<{ x: number; y: number }>) {
    if (cells.length === 0) return null;
    let pivotX = 0;
    let pivotY = 0;
    for (const f of cells) {
      pivotX += f.x;
      pivotY += f.y;
    }
    pivotX /= cells.length;
    pivotY = Math.max(pivotY / cells.length, baseY + CELL * 1.2);
    const group = new THREE.Group();
    group.position.set(pivotX, pivotY, 0);
    const dummy = new THREE.Object3D();
    const mesh = new THREE.InstancedMesh(
      voxelGeometry,
      voxelMaterial,
      cells.length * DEPTH
    );
    // Prevent incorrect culling for widely spread instances (helps mirrors)
    mesh.frustumCulled = false;
    let idx = 0;
    for (const cell of cells) {
      for (let k = 0; k < DEPTH; k += 1) {
        const z = (k - (DEPTH - 1) / 2) * SPACING;
        dummy.position.set(cell.x - pivotX, cell.y - pivotY, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    player.add(group);
    group.add(mesh);
    return group;
  }
  const leftFoot = buildFootGroupMesh(leftFootCells);
  const rightFoot = buildFootGroupMesh(rightFootCells);

  // lookAt offset roughly torso height
  const box = new THREE.Box3().setFromObject(player);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  const targetY = min.y + size.y * C.TARGET_HEIGHT_RATIO;
  const lookAt = new THREE.Vector3(0, targetY - player.position.y, 0);

  addToDispose(voxelGeometry);
  addToDispose(voxelMaterial);

  return { armLeft, armRight, leftFoot, rightFoot, lookAt };
}
