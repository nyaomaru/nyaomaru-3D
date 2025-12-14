<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import * as C from '../constants';
import { normalizeAngle, clamp } from '../utils';
import type { Collider, ArmCell, BodyCell } from '../types';

const container = ref<HTMLDivElement | null>(null);

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let animationFrameId = 0;

// Player
const player = new THREE.Group();
let lookAtOffset = new THREE.Vector3(0, 1.0, 0);
const tmpVec = new THREE.Vector3();
let armLeftGroup: THREE.Group | null = null;
let armRightGroup: THREE.Group | null = null;
let leftFootGroup: THREE.Group | null = null;
let rightFootGroup: THREE.Group | null = null;
// shared temp object for instanced transforms
const dummy = new THREE.Object3D();

// Mouse look (Pointer Lock)
let pitch = C.INITIAL_PITCH; // radians, camera tilt up/down
let cameraYaw = 0; // camera orbit around player (radians)
// use constants from C directly (no local mirrors)
let canvasEl: HTMLCanvasElement | null = null;
let isPointerLocked = false;

// Movement state
const keys = new Set<string>();
let playerYaw = 0; // player facing direction (radians)
let verticalVelocity = 0;
let isGrounded = true;

const colliders: Collider[] = [];

// Resources for disposal
const toDispose: Array<
  THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
> = [];

function addToDispose(obj: any) {
  toDispose.push(obj);
}

function handleResize() {
  const el = container.value;
  if (!el || !renderer || !camera) return;
  const w = el.clientWidth || window.innerWidth;
  const h = el.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
}

function buildEnvironment() {
  if (!scene) return;

  // Sky and light
  scene.background = new THREE.Color(0x87ceeb); // sky blue
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  scene.add(hemi, dir);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(1000, 1000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x7fbf7f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);
  addToDispose(groundGeo);
  addToDispose(groundMat);

  // Mountains (simple cones placed around)
  const coneGeo = new THREE.ConeGeometry(3, 6, 6);
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0x6b8e23,
    roughness: 0.9,
  });
  for (let i = 0; i < 40; i += 1) {
    const r = 40 + Math.random() * 120;
    const a = Math.random() * Math.PI * 2;
    const scale = 0.8 + Math.random() * 2.5;
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(Math.cos(a) * r, 3 * scale, Math.sin(a) * r);
    cone.scale.setScalar(scale);
    scene.add(cone);
    // register simple cylindrical collider (approx base radius)
    colliders.push({
      x: cone.position.x,
      z: cone.position.z,
      r: 3 * scale * 0.9,
    });
  }
  addToDispose(coneGeo);
  addToDispose(coneMat);
}

function buildPlayer() {
  const CELL = C.AVATAR_CELL;
  const DEPTH = C.AVATAR_DEPTH; // layers
  const SPACING = C.AVATAR_SPACING;
  const COLOR = C.AVATAR_COLOR;

  const rows = C.LOGO_PATTERN.length;
  const cols = C.LOGO_PATTERN[0].length;
  const xOffset = ((cols - 1) * CELL) / 2;
  const yOffset = ((rows - 1) * CELL) / 2;
  const baseY = yOffset + 0.02; // keep feet just above ground

  const boxGeo = new THREE.BoxGeometry(CELL, CELL, CELL);
  const boxMat = new THREE.MeshStandardMaterial({
    color: COLOR,
    roughness: 0.45,
    metalness: 0.05,
  });

  // Separate body vs arms by column distance from center within mid-height band
  const bodyCells: BodyCell[] = [];
  const leftArmCells: ArmCell[] = [];
  const rightArmCells: ArmCell[] = [];
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
  // Select arms from a lower-middle height band to avoid whiskers
  const armBandTop = Math.floor(rows * C.ARM_BAND_TOP_RATIO);
  const armBandBottom = Math.floor(rows * C.ARM_BAND_BOTTOM_RATIO);
  const armThresholdMin = Math.floor(cols * C.ARM_THRESHOLD_MIN_RATIO);
  const armThresholdMax = Math.floor(cols * C.ARM_THRESHOLD_MAX_RATIO);

  for (let r = 0; r < rows; r++) {
    const row = C.LOGO_PATTERN[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === ' ') continue;
      const x = c * CELL - xOffset;
      const y = (rows - 1 - r) * CELL - yOffset + baseY;
      const colDelta = Math.abs(c - centerCol);
      const colDeltaInt = Math.floor(colDelta + 1e-6);
      const legBandTop = Math.floor(rows * C.LEG_BAND_TOP_RATIO);
      const inLegBand = r >= legBandTop;
      const legCenterThreshold = Math.floor(
        cols * C.LEG_THRESHOLD_CENTER_RATIO
      );
      const inLegCols = Math.abs(c - centerCol) <= legCenterThreshold;
      if (C.ENABLE_LEG_SWING && inLegBand && inLegCols) {
        if (c < centerCol) leftFootCells.push({ x, y, row: r, col: c });
        else rightFootCells.push({ x, y, row: r, col: c });
      } else if (
        r >= armBandTop &&
        r <= armBandBottom &&
        colDelta >= armThresholdMin &&
        colDelta <= armThresholdMax
      ) {
        if (c < centerCol)
          leftArmCells.push({ x, y, col: c, colDelta, colDeltaInt, row: r });
        else
          rightArmCells.push({ x, y, col: c, colDelta, colDeltaInt, row: r });
      } else {
        bodyCells.push({ x, y, row: r, col: c });
      }
    }
  }

  // Enforce symmetry per row to avoid one side losing tips
  const byRowLeft: Record<number, ArmCell[]> = {};
  const byRowRight: Record<number, ArmCell[]> = {};
  for (const p of leftArmCells) (byRowLeft[p.row] ??= []).push(p);
  for (const p of rightArmCells) (byRowRight[p.row] ??= []).push(p);
  const leftArmTrimmed: ArmCell[] = [];
  const rightArmTrimmed: ArmCell[] = [];
  for (let rr = armBandTop; rr <= armBandBottom; rr += 1) {
    const L = byRowLeft[rr] ?? [];
    const R = byRowRight[rr] ?? [];
    if (L.length === 0 && R.length === 0) continue;
    const lMax = L.reduce((m, p) => Math.max(m, p.colDeltaInt), 0);
    const rMax = R.reduce((m, p) => Math.max(m, p.colDeltaInt), 0);
    const lim = Math.min(lMax, rMax);
    for (const p of L) if (p.colDeltaInt <= lim) leftArmTrimmed.push(p);
    for (const p of R) if (p.colDeltaInt <= lim) rightArmTrimmed.push(p);
  }

  // Arm meshes grouped for rotation around shoulder
  function buildArmGroup(cells: ArmCell[], sign: -1 | 1) {
    if (cells.length === 0) return null;
    // pivot as inner-most average (toward torso)
    let pivotX = 0,
      pivotY = 0;
    let count = 0;
    for (const p of cells) {
      pivotX += p.x;
      pivotY += p.y;
      count += 1;
    }
    pivotX /= count;
    pivotY /= count;
    // bias pivot slightly inward
    pivotX -= sign * CELL * 1.0;

    const group = new THREE.Group();
    group.position.set(pivotX, pivotY, 0);
    const armMesh = new THREE.InstancedMesh(
      boxGeo,
      boxMat,
      cells.length * DEPTH
    );
    let idx = 0;
    for (const cell of cells) {
      for (let k = 0; k < DEPTH; k += 1) {
        const z = (k - (DEPTH - 1) / 2) * SPACING;
        dummy.position.set(cell.x - pivotX, cell.y - pivotY, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        armMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    armMesh.instanceMatrix.needsUpdate = true;
    group.add(armMesh);
    player.add(group);
    return group;
  }

  // Use fallback if trimmed arms are too small or too close to torso
  let finalLeft = leftArmTrimmed;
  let finalRight = rightArmTrimmed;
  const leftEdge = leftArmTrimmed.reduce((m, p) => Math.max(m, p.colDelta), 0);
  const rightEdge = rightArmTrimmed.reduce(
    (m, p) => Math.max(m, p.colDelta),
    0
  );
  const needFallback =
    finalLeft.length < C.ARM_MIN_CELLS_FOR_SWING ||
    finalRight.length < C.ARM_MIN_CELLS_FOR_SWING ||
    leftEdge < armThresholdMin + C.ARM_MIN_EDGE_DELTA_MARGIN ||
    rightEdge < armThresholdMin + C.ARM_MIN_EDGE_DELTA_MARGIN;
  if (needFallback) {
    finalLeft = [];
    finalRight = [];
    for (let rr = armBandTop; rr <= armBandBottom; rr += 1) {
      const row = C.LOGO_PATTERN[rr];
      if (!row) continue;
      let first = -1;
      let last = -1;
      for (let c = 0; c < cols; c += 1) {
        if (row[c] !== ' ') {
          if (first === -1) first = c;
          last = c;
        }
      }
      if (first === -1 || last === -1) continue;
      for (let w = 0; w < C.ARM_FALLBACK_WIDTH_COLS; w += 1) {
        const cL = first + w;
        const cR = last - w;
        // Always include outermost columns to guarantee visible arms
        let x = cL * CELL - xOffset;
        let y = (rows - 1 - rr) * CELL - yOffset + baseY;
        let cd = Math.abs(cL - centerCol);
        finalLeft.push({
          x,
          y,
          col: cL,
          colDelta: cd,
          colDeltaInt: Math.floor(cd + 1e-6),
          row: rr,
        });
        x = cR * CELL - xOffset;
        y = (rows - 1 - rr) * CELL - yOffset + baseY;
        cd = Math.abs(cR - centerCol);
        finalRight.push({
          x,
          y,
          col: cR,
          colDelta: cd,
          colDeltaInt: Math.floor(cd + 1e-6),
          row: rr,
        });
      }
    }
  }

  // Build body mesh (exclude arm/foot cells if their swing is enabled)
  const key = (r: number, c: number) => `${r}:${c}`;
  const armCellsSet = new Set<string>();
  if (C.ENABLE_ARM_SWING) {
    for (const p of finalLeft) armCellsSet.add(key(p.row, p.col));
    for (const p of finalRight) armCellsSet.add(key(p.row, p.col));
  }
  const footCellsSet = new Set<string>();
  if (C.ENABLE_LEG_SWING) {
    for (const p of leftFootCells) footCellsSet.add(key(p.row, p.col));
    for (const p of rightFootCells) footCellsSet.add(key(p.row, p.col));
  }
  const bodyFiltered = bodyCells.filter(
    (b) =>
      !armCellsSet.has(key(b.row, b.col)) &&
      !footCellsSet.has(key(b.row, b.col))
  );
  const bodyMesh = new THREE.InstancedMesh(
    boxGeo,
    boxMat,
    bodyFiltered.length * DEPTH
  );
  let idxBody = 0;
  for (const cell of bodyFiltered) {
    for (let k = 0; k < DEPTH; k += 1) {
      const z = (k - (DEPTH - 1) / 2) * SPACING;
      dummy.position.set(cell.x, cell.y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(idxBody++, dummy.matrix);
    }
  }
  bodyMesh.instanceMatrix.needsUpdate = true;
  player.clear();
  player.add(bodyMesh);

  // Optionally add arms as separate swing groups
  armLeftGroup = C.ENABLE_ARM_SWING ? buildArmGroup(finalLeft, -1) : null;
  armRightGroup = C.ENABLE_ARM_SWING ? buildArmGroup(finalRight, 1) : null;

  // Optionally add feet as separate swing groups
  function buildFootGroup(cells: Array<{ x: number; y: number }>) {
    if (cells.length === 0) return null;
    let px = 0,
      py = 0;
    for (const f of cells) {
      px += f.x;
      py += f.y;
    }
    px /= cells.length;
    py = Math.max(py / cells.length, baseY + CELL * 1.2);
    const group = new THREE.Group();
    group.position.set(px, py, 0);
    const mesh = new THREE.InstancedMesh(boxGeo, boxMat, cells.length * DEPTH);
    let idx = 0;
    for (const cell of cells) {
      for (let k = 0; k < DEPTH; k += 1) {
        const z = (k - (DEPTH - 1) / 2) * SPACING;
        dummy.position.set(cell.x - px, cell.y - py, z);
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
  leftFootGroup = C.ENABLE_LEG_SWING ? buildFootGroup(leftFootCells) : null;
  rightFootGroup = C.ENABLE_LEG_SWING ? buildFootGroup(rightFootCells) : null;

  player.position.set(0, 0, 0);

  addToDispose(boxGeo);
  addToDispose(boxMat);
}

function updatePlayer(dt: number) {
  // Rotation (A/D or ArrowLeft/ArrowRight)
  let rot = 0;
  if (keys.has('a') || keys.has('ArrowLeft')) rot += 1;
  if (keys.has('d') || keys.has('ArrowRight')) rot -= 1;
  playerYaw += rot * C.ROTATE_SPEED * dt;
  player.rotation.y = playerYaw;
  // Keep camera behind player when rotating via keys
  cameraYaw = playerYaw;

  // Move (W/S or ArrowUp/ArrowDown)
  let forward = 0;
  if (keys.has('w') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('s') || keys.has('ArrowDown')) forward -= 1;

  const speed = C.MOVE_SPEED * (keys.has('Shift') ? 1.5 : 1);
  const moveDist = forward * speed * dt;
  // Auto-rotate player toward camera when moving
  if (forward !== 0) {
    const delta = normalizeAngle(cameraYaw - playerYaw);
    const maxStep = C.AUTO_TURN_SPEED * dt;
    const step = Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep;
    playerYaw += step;
    player.rotation.y = playerYaw;
  }
  if (moveDist !== 0) {
    tmpVec.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
    const nextX = player.position.x + tmpVec.x * moveDist;
    const nextZ = player.position.z + tmpVec.z * moveDist;
    if (!willCollide(nextX, nextZ)) {
      player.position.x = nextX;
      player.position.z = nextZ;
    }
  }

  // Jump
  if (isGrounded && (keys.has(' ') || keys.has('Space'))) {
    verticalVelocity = C.JUMP_SPEED;
    isGrounded = false;
  }

  // Gravity
  verticalVelocity -= C.GRAVITY * dt;
  player.position.y += verticalVelocity * dt;
  if (player.position.y < 0) {
    player.position.y = 0;
    verticalVelocity = 0;
    isGrounded = true;
  }

  // World boundary
  const radial = Math.hypot(player.position.x, player.position.z);
  if (radial > C.WORLD_RADIUS - C.PLAYER_RADIUS) {
    const scale = (C.WORLD_RADIUS - C.PLAYER_RADIUS) / radial;
    player.position.x *= scale;
    player.position.z *= scale;
  }

  // Voxel arm swing (optional)
  if (C.ENABLE_ARM_SWING) {
    const moving = Math.abs(forward) > 0.01;
    const t =
      performance.now() *
      C.ARM_SWING_SPEED *
      (keys.has('Shift') ? C.ARM_SWING_DASH_MULT : 1);
    const amp = moving ? C.ARM_SWING_AMP : 0.0;
    const swing = Math.sin(t) * amp;
    if (armLeftGroup) {
      armLeftGroup.rotation.x = swing;
      armLeftGroup.rotation.z = swing * 0.25;
    }
    if (armRightGroup) {
      armRightGroup.rotation.x = -swing;
      armRightGroup.rotation.z = -swing * 0.25;
    }
  }

  // Voxel leg (feet) swing (optional)
  if (C.ENABLE_LEG_SWING) {
    const moving = Math.abs(forward) > 0.01;
    const t = performance.now() * C.LEG_SWING_SPEED;
    const amp = moving ? C.LEG_SWING_AMP : 0.0;
    const swing = Math.sin(t) * amp;
    if (leftFootGroup) leftFootGroup.rotation.x = swing;
    if (rightFootGroup) rightFootGroup.rotation.x = -swing;
  }
}

function updateCamera() {
  if (!camera) return;
  // Centered third-person orbit with vertical pitch control
  const distance = C.CAMERA_DISTANCE;
  const target = new THREE.Vector3().copy(player.position).add(lookAtOffset);
  const fwd = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw)
    .normalize();
  const horizontal = distance * Math.cos(pitch);
  const offY = distance * Math.sin(pitch);
  const pos = new THREE.Vector3()
    .copy(target)
    .addScaledVector(fwd, -horizontal)
    .add(new THREE.Vector3(0, offY, 0));
  camera.position.copy(pos);
  camera.lookAt(target);
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
}

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  updatePlayer(dt);
  updateCamera();
  if (renderer && scene && camera) renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(animate);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Space') e.preventDefault();
  keys.add(e.key);
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key);
}

function onPointerLockChange() {
  isPointerLocked = document.pointerLockElement === canvasEl;
}

function onMouseMove(e: MouseEvent) {
  if (!isPointerLocked) return;
  // Rotate player directly; camera follows behind
  playerYaw -= e.movementX * C.MOUSE_SENSITIVITY;
  cameraYaw = playerYaw;
  // Optionally allow slight pitch look
  pitch -= e.movementY * C.MOUSE_SENSITIVITY;
  pitch = clamp(pitch, C.MIN_PITCH, C.MAX_PITCH);
}

function willCollide(nextX: number, nextZ: number) {
  // Check against mountains
  for (const c of colliders) {
    const dx = nextX - c.x;
    const dz = nextZ - c.z;
    if (dx * dx + dz * dz < (c.r + C.PLAYER_RADIUS) * (c.r + C.PLAYER_RADIUS))
      return true;
  }
  return false;
}

onMounted(() => {
  const el = container.value!;
  const w = el.clientWidth || window.innerWidth;
  const h = el.clientHeight || window.innerHeight;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  camera.position.set(0, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, true);
  el.appendChild(renderer.domElement);
  canvasEl = renderer.domElement;

  buildEnvironment();
  buildPlayer();
  scene.add(player);
  // compute look-at offset at torso height so legsだけにならない
  const box = new THREE.Box3().setFromObject(player);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  const targetY = min.y + size.y * C.TARGET_HEIGHT_RATIO;
  lookAtOffset.set(0, targetY - player.position.y, 0);

  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mousemove', onMouseMove);
  el.addEventListener('click', () => {
    canvasEl?.requestPointerLock();
  });
  handleResize();

  clock.start();
  animate();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('pointerlockchange', onPointerLockChange);
  document.removeEventListener('mousemove', onMouseMove);
  stopAnimation();
  try {
    renderer?.dispose();
    for (const res of toDispose) {
      if ((res as any).dispose) (res as any).dispose();
    }
  } catch {}
});
</script>

<template>
  <div
    ref="container"
    style="width: 100%; height: 100vh; overflow: hidden"
  ></div>
</template>
