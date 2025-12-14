import * as THREE from 'three'
import * as C from '../constants'
import type { ArmCell, BodyCell } from '../types'

export function useAvatar(
  player: THREE.Group,
  addToDispose: (res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture) => void
) {
  const CELL = C.AVATAR_CELL
  const DEPTH = C.AVATAR_DEPTH
  const SPACING = C.AVATAR_SPACING

  const rows = C.LOGO_PATTERN.length
  const cols = C.LOGO_PATTERN[0].length
  const xOffset = ((cols - 1) * CELL) / 2
  const yOffset = ((rows - 1) * CELL) / 2
  const baseY = yOffset + 0.02

  const boxGeo = new THREE.BoxGeometry(CELL, CELL, CELL)
  const boxMat = new THREE.MeshStandardMaterial({ color: C.AVATAR_COLOR, roughness: C.AVATAR_MAT_ROUGHNESS, metalness: C.AVATAR_MAT_METALNESS })

  const bodyCells: BodyCell[] = []
  const leftArmCells: ArmCell[] = []
  const rightArmCells: ArmCell[] = []
  const leftFootCells: Array<{ x: number; y: number; row: number; col: number }> = []
  const rightFootCells: Array<{ x: number; y: number; row: number; col: number }> = []

  const centerCol = (cols - 1) / 2
  const armBandTop = Math.floor(rows * C.ARM_BAND_TOP_RATIO)
  const armBandBottom = Math.floor(rows * C.ARM_BAND_BOTTOM_RATIO)
  const armThresholdMin = Math.floor(cols * C.ARM_THRESHOLD_MIN_RATIO)
  const armThresholdMax = Math.floor(cols * C.ARM_THRESHOLD_MAX_RATIO)

  for (let r = 0; r < rows; r++) {
    const row = C.LOGO_PATTERN[r]
    for (let c = 0; c < row.length; c++) {
      if (row[c] === ' ') continue
      const x = c * CELL - xOffset
      const y = (rows - 1 - r) * CELL - yOffset + baseY
      const colDelta = Math.abs(c - centerCol)
      const colDeltaInt = Math.floor(colDelta + 1e-6)
      const legBandTop = Math.floor(rows * C.LEG_BAND_TOP_RATIO)
      const inLegBand = r >= legBandTop
      const legCenterThreshold = Math.floor(cols * C.LEG_THRESHOLD_CENTER_RATIO)
      const inLegCols = Math.abs(c - centerCol) <= legCenterThreshold
      if (C.ENABLE_LEG_SWING && inLegBand && inLegCols) {
        if (c < centerCol) leftFootCells.push({ x, y, row: r, col: c })
        else rightFootCells.push({ x, y, row: r, col: c })
      } else if (
        r >= armBandTop &&
        r <= armBandBottom &&
        colDelta >= armThresholdMin &&
        colDelta <= armThresholdMax
      ) {
        if (c < centerCol) leftArmCells.push({ x, y, col: c, colDelta, colDeltaInt, row: r })
        else rightArmCells.push({ x, y, col: c, colDelta, colDeltaInt, row: r })
      } else {
        bodyCells.push({ x, y, row: r, col: c })
      }
    }
  }

  // symmetry by row
  const byRowLeft: Record<number, ArmCell[]> = {}
  const byRowRight: Record<number, ArmCell[]> = {}
  for (const p of leftArmCells) (byRowLeft[p.row] ??= []).push(p)
  for (const p of rightArmCells) (byRowRight[p.row] ??= []).push(p)
  const leftArmTrimmed: ArmCell[] = []
  const rightArmTrimmed: ArmCell[] = []
  for (let rr = armBandTop; rr <= armBandBottom; rr += 1) {
    const L = byRowLeft[rr] ?? []
    const R = byRowRight[rr] ?? []
    if (L.length === 0 && R.length === 0) continue
    const lMax = L.reduce((m, p) => Math.max(m, p.colDeltaInt), 0)
    const rMax = R.reduce((m, p) => Math.max(m, p.colDeltaInt), 0)
    const lim = Math.min(lMax, rMax)
    for (const p of L) if (p.colDeltaInt <= lim) leftArmTrimmed.push(p)
    for (const p of R) if (p.colDeltaInt <= lim) rightArmTrimmed.push(p)
  }

  // fallback outer columns
  let finalLeft = leftArmTrimmed
  let finalRight = rightArmTrimmed
  const leftEdge = leftArmTrimmed.reduce((m, p) => Math.max(m, p.colDelta), 0)
  const rightEdge = rightArmTrimmed.reduce((m, p) => Math.max(m, p.colDelta), 0)
  const needFallback =
    finalLeft.length < C.ARM_MIN_CELLS_FOR_SWING ||
    finalRight.length < C.ARM_MIN_CELLS_FOR_SWING ||
    leftEdge < armThresholdMin + C.ARM_MIN_EDGE_DELTA_MARGIN ||
    rightEdge < armThresholdMin + C.ARM_MIN_EDGE_DELTA_MARGIN
  if (needFallback) {
    finalLeft = []
    finalRight = []
    for (let rr = armBandTop; rr <= armBandBottom; rr += 1) {
      const row = C.LOGO_PATTERN[rr]
      if (!row) continue
      let first = -1
      let last = -1
      for (let c = 0; c < cols; c += 1) {
        if (row[c] !== ' ') {
          if (first === -1) first = c
          last = c
        }
      }
      if (first === -1 || last === -1) continue
      for (let w = 0; w < C.ARM_FALLBACK_WIDTH_COLS; w += 1) {
        const cL = first + w
        const cR = last - w
        let x = cL * CELL - xOffset
        let y = (rows - 1 - rr) * CELL - yOffset + baseY
        let cd = Math.abs(cL - centerCol)
        finalLeft.push({ x, y, col: cL, colDelta: cd, colDeltaInt: Math.floor(cd + 1e-6), row: rr })
        x = cR * CELL - xOffset
        y = (rows - 1 - rr) * CELL - yOffset + baseY
        cd = Math.abs(cR - centerCol)
        finalRight.push({ x, y, col: cR, colDelta: cd, colDeltaInt: Math.floor(cd + 1e-6), row: rr })
      }
    }
  }

  // body mesh excluding arms/feet if enabled
  const key = (r: number, c: number) => `${r}:${c}`
  const armCellsSet = new Set<string>()
  if (C.ENABLE_ARM_SWING) {
    for (const p of finalLeft) armCellsSet.add(key(p.row, p.col))
    for (const p of finalRight) armCellsSet.add(key(p.row, p.col))
  }
  const footCellsSet = new Set<string>()
  if (C.ENABLE_LEG_SWING) {
    for (const p of leftFootCells) footCellsSet.add(key(p.row, p.col))
    for (const p of rightFootCells) footCellsSet.add(key(p.row, p.col))
  }
  const bodyFiltered = bodyCells.filter(
    (b) => !armCellsSet.has(key(b.row, b.col)) && !footCellsSet.has(key(b.row, b.col))
  )
  const dummy = new THREE.Object3D()
  const bodyMesh = new THREE.InstancedMesh(boxGeo, boxMat, bodyFiltered.length * DEPTH)
  let idxBody = 0
  for (const cell of bodyFiltered) {
    for (let k = 0; k < DEPTH; k += 1) {
      const z = (k - (DEPTH - 1) / 2) * SPACING
      dummy.position.set(cell.x, cell.y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      bodyMesh.setMatrixAt(idxBody++, dummy.matrix)
    }
  }
  bodyMesh.instanceMatrix.needsUpdate = true
  player.clear()
  player.add(bodyMesh)

  function buildArmGroup(cells: ArmCell[], sign: -1 | 1) {
    if (cells.length === 0) return null
    let pivotX = 0,
      pivotY = 0,
      count = 0
    for (const p of cells) {
      pivotX += p.x
      pivotY += p.y
      count += 1
    }
    pivotX /= count
    pivotY /= count
    pivotX -= sign * CELL * 1.0

    const group = new THREE.Group()
    group.position.set(pivotX, pivotY, 0)
    const mesh = new THREE.InstancedMesh(boxGeo, boxMat, cells.length * DEPTH)
    let idx = 0
    for (const cell of cells) {
      for (let k = 0; k < DEPTH; k += 1) {
        const z = (k - (DEPTH - 1) / 2) * SPACING
        dummy.position.set(cell.x - pivotX, cell.y - pivotY, z)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(idx++, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    player.add(group)
    group.add(mesh)
    return group
  }

  const armLeft = C.ENABLE_ARM_SWING ? buildArmGroup(finalLeft, -1) : null
  const armRight = C.ENABLE_ARM_SWING ? buildArmGroup(finalRight, 1) : null

  function buildFootGroup(cells: Array<{ x: number; y: number }>) {
    if (cells.length === 0) return null
    let px = 0,
      py = 0
    for (const f of cells) {
      px += f.x
      py += f.y
    }
    px /= cells.length
    py = Math.max(py / cells.length, baseY + CELL * 1.2)
    const group = new THREE.Group()
    group.position.set(px, py, 0)
    const mesh = new THREE.InstancedMesh(boxGeo, boxMat, cells.length * DEPTH)
    let idx = 0
    for (const cell of cells) {
      for (let k = 0; k < DEPTH; k += 1) {
        const z = (k - (DEPTH - 1) / 2) * SPACING
        dummy.position.set(cell.x - px, cell.y - py, z)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(idx++, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    player.add(group)
    group.add(mesh)
    return group
  }
  const leftFoot = C.ENABLE_LEG_SWING ? buildFootGroup(leftFootCells) : null
  const rightFoot = C.ENABLE_LEG_SWING ? buildFootGroup(rightFootCells) : null

  // lookAt offset roughly torso height
  const box = new THREE.Box3().setFromObject(player)
  const size = box.getSize(new THREE.Vector3())
  const min = box.min
  const targetY = min.y + size.y * C.TARGET_HEIGHT_RATIO
  const lookAt = new THREE.Vector3(0, targetY - player.position.y, 0)

  addToDispose(boxGeo)
  addToDispose(boxMat)

  return { armLeft, armRight, leftFoot, rightFoot, lookAt }
}
