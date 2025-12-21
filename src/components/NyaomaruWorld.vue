<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import * as C from '../constants';
import { isDisposable } from '../utils/is';
import { normalizeAngle, clamp } from '../utils';
import type { Collider, Destructible, ShatterFragment } from '../types';
import { useEnvironment } from '../composables/useEnvironment';
import { useAvatar } from '../composables/useAvatar';

const container = ref<HTMLDivElement | null>(null);

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let animationFrameId = 0;

// Player
const player = new THREE.Group();
const lookAtOffset = new THREE.Vector3(0, 1.0, 0);
const moveDir = new THREE.Vector3();
let armLeftGroup: THREE.Group | null = null;
let armRightGroup: THREE.Group | null = null;
let leftFootGroup: THREE.Group | null = null;
let rightFootGroup: THREE.Group | null = null;

// Punch state
let isPunching = false;
let punchTimer = 0;
let punchCooldown = 0;
let punchHand: C.Hand = C.HAND.RIGHT;

// Mouse look
let pitch = C.INITIAL_PITCH;
let cameraYaw = 0;
let canvasEl: HTMLCanvasElement | null = null;
let isPointerLocked = false;

// Movement
const keys = new Set<string>();
let playerYaw = 0;
let verticalVelocity = 0;
let isGrounded = true;
// Preserve horizontal momentum during jump, but ignore mid-air input
const airMoveVec = new THREE.Vector3(0, 0, 0);

const colliders: Collider[] = [];
const trees: Destructible[] = [];
const fragments: ShatterFragment[] = [];
const mountains: Destructible[] = [];
let fragmentGeometry: THREE.BufferGeometry | null = null;
let fragmentMaterial: THREE.Material | null = null;
let punchDidHit = false;

// Resources for disposal
type DisposableResource =
  | THREE.Object3D
  | THREE.Material
  | THREE.BufferGeometry
  | THREE.Texture;
const toDispose: DisposableResource[] = [];
/**
 * Register a resource to dispose later.
 * Its dispose() will be called on unmount.
 * @param obj Resource that may have a dispose() method.
 * @returns void
 */
function addToDispose(obj: DisposableResource) {
  toDispose.push(obj);
}

/**
 * Fit camera and renderer to the container element size.
 * @returns void
 */
function handleResize() {
  const containerElement = container.value;
  if (!containerElement || !renderer || !camera) return;
  const width = containerElement.clientWidth || window.innerWidth;
  const height = containerElement.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, true);
}

// Helpers
/**
 * Return squared distance on XZ plane (avoid sqrt for performance).
 * @param x1 X of first point
 * @param z1 Z of first point
 * @param x2 X of second point
 * @param z2 Z of second point
 * @returns Squared distance between the two XZ points
 */
function xzDistanceSquared(x1: number, z1: number, x2: number, z2: number) {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return dx * dx + dz * dz;
}

/**
 * Update player XZ position if the move does not collide.
 * @param nextX Next X coordinate
 * @param nextZ Next Z coordinate
 * @returns void
 */
function movePlayerIfNoCollision(nextX: number, nextZ: number) {
  if (!willCollide(nextX, nextZ)) {
    player.position.x = nextX;
    player.position.z = nextZ;
  }
}

/**
 * Compute next XZ coordinates from facing (playerYaw) and move distance.
 * @param moveDist Movement distance in world units
 * @returns Object with nextX and nextZ
 */
function computeNextXZFromMoveDist(moveDist: number) {
  moveDir.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
  const nextX = player.position.x + moveDir.x * moveDist;
  const nextZ = player.position.z + moveDir.z * moveDist;
  return { nextX, nextZ } as const;
}

/**
 * Capture horizontal momentum at jump takeoff (airborne inertia).
 * @param forward Forward input (-1|0|1)
 * @param speed Current movement speed scalar
 * @returns void
 */
function applyJumpTakeoffMomentum(forward: number, speed: number) {
  if (forward !== 0) {
    airMoveVec
      .set(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
    airMoveVec.multiplyScalar(speed * forward);
  } else {
    airMoveVec.set(0, 0, 0);
  }
}

/**
 * Apply a punch pose to the active arm using the given angle.
 * @param angle Arm rotation magnitude in radians
 * @returns void
 */
function setPunchArmPose(angle: number) {
  if (punchHand === C.HAND.LEFT && armLeftGroup) {
    armLeftGroup.rotation.x = -angle;
    armLeftGroup.rotation.z = 0;
  }
  if (punchHand === C.HAND.RIGHT && armRightGroup) {
    armRightGroup.rotation.x = -angle;
    armRightGroup.rotation.z = 0;
  }
}

/**
 * Return index of first target within radius of (px, pz); -1 if none.
 * @param targets List of potential targets
 * @param px Center X position
 * @param pz Center Z position
 * @param radius Inclusion radius
 * @returns Index or -1 when none found
 */
function findHitIndex(
  targets: Destructible[],
  px: number,
  pz: number,
  radius: number
) {
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!target) continue;
    if (
      xzDistanceSquared(target.x, target.z, px, pz) <=
      (target.r + radius) * (target.r + radius)
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Apply damage and visuals to a destructible; shatter when health <= 0.
 * @param targets The list containing the target
 * @param index Index of the target in the list
 * @returns void
 */
function applyDamage(targets: Destructible[], index: number) {
  const target = targets[index];
  if (!target) return;
  const isMountain = target.id >= C.MOUNTAIN_ID_BASE;
  target.health -= 1;
  flashHitColor(target.group);
  if (target.health <= 0) {
    shatterDestructible(targets, index);
  } else if (!isMountain) {
    // small nudge feedback for trees only
    target.group.scale.setScalar(1 + C.TREE_NUDGE_SCALE_DELTA);
    setTimeout(() => target.group.scale.setScalar(1), C.TREE_NUDGE_DURATION_MS);
  }
}

/**
 * Build environment (ground, mountains, trees) and populate lists.
 * @returns void
 */
function buildEnvironment() {
  if (!scene) return;
  const env = useEnvironment(scene, addToDispose);
  colliders.push(...env.colliders);
  if (env.trees) trees.push(...env.trees);
  if (env.mountains) mountains.push(...env.mountains);
}

/**
 * Build the player avatar (body/arms/feet) and store references.
 * @returns void
 */
function buildPlayer() {
  const { armLeft, armRight, leftFoot, rightFoot, lookAt } = useAvatar(
    player,
    addToDispose
  );
  armLeftGroup = armLeft;
  armRightGroup = armRight;
  leftFootGroup = leftFoot;
  rightFootGroup = rightFoot;
  lookAtOffset.copy(lookAt);
}

/**
 * Update player: input, movement, jump, punch, limb swing, bounds.
 * @param deltaSeconds Frame delta time in seconds
 * @returns void
 */
function updatePlayer(deltaSeconds: number) {
  let rotationInput = 0;
  if (C.KEYS_LEFT.some((k) => keys.has(k))) rotationInput += 1;
  if (C.KEYS_RIGHT.some((k) => keys.has(k))) rotationInput -= 1;
  playerYaw += rotationInput * C.ROTATE_SPEED * deltaSeconds;
  player.rotation.y = playerYaw;
  cameraYaw = playerYaw;

  let forward = 0;
  if (C.KEYS_FORWARD.some((k) => keys.has(k))) forward += 1;
  if (C.KEYS_BACKWARD.some((k) => keys.has(k))) forward -= 1;

  const speed =
    C.MOVE_SPEED *
    (C.KEYS_SPRINT.some((k) => keys.has(k)) ? C.DASH_MULTIPLIER : 1);
  const moveDist = forward * speed * deltaSeconds;
  if (isGrounded) {
    if (forward !== 0) {
      const delta = normalizeAngle(cameraYaw - playerYaw);
      const maxStep = C.AUTO_TURN_SPEED * deltaSeconds;
      const step =
        Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep;
      playerYaw += step;
      player.rotation.y = playerYaw;
    }
    if (moveDist !== 0) {
      const { nextX, nextZ } = computeNextXZFromMoveDist(moveDist);
      movePlayerIfNoCollision(nextX, nextZ);
    }
  } else {
    // mid-air: apply preserved momentum only; ignore new input
    if (airMoveVec.lengthSq() > 0) {
      const nextX = player.position.x + airMoveVec.x * deltaSeconds;
      const nextZ = player.position.z + airMoveVec.z * deltaSeconds;
      movePlayerIfNoCollision(nextX, nextZ);
    }
  }

  if (isGrounded && C.KEYS_JUMP.some((k) => keys.has(k))) {
    verticalVelocity = C.JUMP_SPEED;
    isGrounded = false;
    // capture momentum at takeoff
    applyJumpTakeoffMomentum(forward, speed);
  }
  verticalVelocity -= C.GRAVITY * deltaSeconds;
  player.position.y += verticalVelocity * deltaSeconds;
  if (player.position.y < C.GROUND_Y) {
    player.position.y = C.GROUND_Y;
    verticalVelocity = 0;
    isGrounded = true;
    airMoveVec.set(0, 0, 0);
  }

  const radialDistance = Math.hypot(player.position.x, player.position.z);
  if (radialDistance > C.WORLD_RADIUS - C.PLAYER_RADIUS) {
    const scale = (C.WORLD_RADIUS - C.PLAYER_RADIUS) / radialDistance;
    player.position.x *= scale;
    player.position.z *= scale;
  }

  // Punch animation (overrides arm swing if active)
  if (isPunching) {
    punchTimer += deltaSeconds;
    const punchProgress = Math.min(1, punchTimer / C.PUNCH_DURATION);
    const phase =
      punchProgress < C.PUNCH_HALF_PHASE
        ? punchProgress / C.PUNCH_HALF_PHASE
        : 1 - (punchProgress - C.PUNCH_HALF_PHASE) / C.PUNCH_HALF_PHASE;
    const angle = phase * C.PUNCH_ANGLE;
    // apply hit once during forward phase
    if (punchProgress < C.PUNCH_HALF_PHASE && !punchDidHit) {
      attemptPunchHit();
      punchDidHit = true;
    }
    setPunchArmPose(angle);
    if (punchProgress >= 1) {
      isPunching = false;
      punchTimer = 0;
      punchCooldown = C.PUNCH_COOLDOWN;
      punchHand = punchHand === C.HAND.LEFT ? C.HAND.RIGHT : C.HAND.LEFT;
      punchDidHit = false;
    }
  } else {
    if (punchCooldown > 0)
      punchCooldown = Math.max(0, punchCooldown - deltaSeconds);
  }

  // Arm swing (optional)
  if (!isPunching && C.ENABLE_ARM_SWING) {
    const moving = Math.abs(forward) > C.MOVING_THRESHOLD;
    const swingTime =
      performance.now() *
      C.ARM_SWING_SPEED *
      (C.KEYS_SPRINT.some((k) => keys.has(k)) ? C.ARM_SWING_DASH_MULT : 1);
    const amp = moving ? C.ARM_SWING_AMP : 0.0;
    const swing = Math.sin(swingTime) * amp;
    if (armLeftGroup) {
      armLeftGroup.rotation.x = swing;
      armLeftGroup.rotation.z = swing * C.ARM_SWING_Z_MULT;
    }
    if (armRightGroup) {
      armRightGroup.rotation.x = -swing;
      armRightGroup.rotation.z = -swing * C.ARM_SWING_Z_MULT;
    }
  }

  // Feet swing (optional) — keep moving during punch
  if (C.ENABLE_LEG_SWING) {
    const moving = Math.abs(forward) > C.MOVING_THRESHOLD;
    const legSwingTime = performance.now() * C.LEG_SWING_SPEED;
    const amp = moving ? C.LEG_SWING_AMP : 0.0;
    const swing = Math.sin(legSwingTime) * amp;
    if (leftFootGroup) leftFootGroup.rotation.x = swing;
    if (rightFootGroup) rightFootGroup.rotation.x = -swing;
  }
}

/**
 * Update third-person camera behind and above the target.
 * @returns void
 */
function updateCamera() {
  if (!camera) return;
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

/**
 * Stop the animation loop (cancel requestAnimationFrame).
 * @returns void
 */
function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
}

const clock = new THREE.Clock();
/**
 * Main animation loop: update subsystems and render.
 * @returns void
 */
function animate() {
  const deltaSeconds = Math.min(C.MAX_FRAME_DELTA, clock.getDelta());
  updatePlayer(deltaSeconds);
  updateCamera();
  updateFragments(deltaSeconds);
  if (renderer && scene && camera) renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Write the player's forward XZ vector into `out`.
 * @param out Vector to write into
 * @returns The same vector passed in
 */
function getPlayerForward(out: THREE.Vector3) {
  out
    .set(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw)
    .normalize();
  return out;
}

/**
 * Run punch hit test and apply damage/visuals on trees or mountains.
 * @returns void
 */
function attemptPunchHit() {
  if (!scene) return;
  const fwd = new THREE.Vector3();
  getPlayerForward(fwd);
  const fist = new THREE.Vector3().copy(player.position);
  const lookAtY = lookAtOffset.y || 1.0;
  fist.y += lookAtY;
  fist.addScaledVector(fwd, C.PUNCH_REACH);
  // choose nearest tree within radius
  const radius = C.PUNCH_RADIUS;
  const treeHit = findHitIndex(trees, fist.x, fist.z, radius);
  if (treeHit >= 0) {
    applyDamage(trees, treeHit);
    return;
  }
  // if no tree hit, allow mountains to flash on hit
  const mountainHit = findHitIndex(mountains, fist.x, fist.z, radius);
  if (mountainHit >= 0) {
    applyDamage(mountains, mountainHit);
  }
}

/**
 * Lazily create shared fragment geometry/material.
 * @returns void
 */
function ensureFragmentResources() {
  if (!fragmentGeometry) {
    fragmentGeometry = new THREE.BoxGeometry(
      C.SHATTER_FRAGMENT_SIZE,
      C.SHATTER_FRAGMENT_SIZE,
      C.SHATTER_FRAGMENT_SIZE
    );
    addToDispose(fragmentGeometry);
  }
  if (!fragmentMaterial) {
    fragmentMaterial = new THREE.MeshStandardMaterial({
      color: 0x6fae6f,
      roughness: 0.6,
    });
    addToDispose(fragmentMaterial);
  }
}

function getFragmentResources(): {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} | null {
  ensureFragmentResources();
  if (!fragmentGeometry || !fragmentMaterial) return null;
  return { geometry: fragmentGeometry, material: fragmentMaterial };
}

/**
 * Remove a destructible from the scene, spawn fragments, and remove from list.
 * @param list List of destructibles containing the target
 * @param index Index of the target to shatter
 * @returns void
 */
function shatterDestructible(list: Destructible[], index: number) {
  if (!scene) return;
  const target = list[index];
  if (!target) return;
  scene.remove(target.group);
  // remove movement collider entirely so passage is clear
  if (target.collider) {
    const colliderIndex = colliders.indexOf(target.collider);
    if (colliderIndex !== -1) colliders.splice(colliderIndex, 1);
  }
  // spawn fragments around top of the object using its bounds
  ensureFragmentResources();
  const bbox = new THREE.Box3().setFromObject(target.group);
  const centerX = (bbox.min.x + bbox.max.x) * 0.5;
  const centerZ = (bbox.min.z + bbox.max.z) * 0.5;
  const topY = bbox.max.y;
  const origin = new THREE.Vector3(centerX, topY, centerZ);
  const size = bbox.getSize(new THREE.Vector3());
  const scale = Math.max(1, Math.min(3, (size.x + size.y + size.z) / 6));
  const isMountain = target.id >= C.MOUNTAIN_ID_BASE;
  const baseCount = Math.floor(C.SHATTER_FRAGMENT_COUNT * scale);
  const fragmentCount = isMountain
    ? Math.floor(baseCount * C.SHATTER_MOUNTAIN_COUNT_MULT)
    : baseCount;
  const frags = getFragmentResources();
  if (!frags) return;
  for (let i = 0; i < fragmentCount; i += 1) {
    const mesh = new THREE.Mesh(frags.geometry, frags.material);
    mesh.position.copy(origin);
    if (isMountain) mesh.scale.setScalar(C.SHATTER_MOUNTAIN_FRAGMENT_SCALE);
    scene.add(mesh);
    const angleRad = Math.random() * Math.PI * 2;
    const speedBase = C.SHATTER_FRAGMENT_SPEED * scale;
    const speed =
      speedBase *
      (isMountain ? C.SHATTER_MOUNTAIN_SPEED_MULT : 1) *
      (0.6 + Math.random() * 0.8);
    const velocityX = Math.cos(angleRad) * speed;
    const velocityZ = Math.sin(angleRad) * speed;
    const velocityY =
      C.SHATTER_FRAGMENT_UP *
      Math.max(1, scale * 0.8) *
      (isMountain ? C.SHATTER_MOUNTAIN_UP_MULT : 1) *
      (0.5 + Math.random() * 1.0);
    const life =
      C.SHATTER_LIFETIME * (isMountain ? C.SHATTER_MOUNTAIN_LIFETIME_MULT : 1);
    fragments.push({
      mesh,
      velocity: new THREE.Vector3(velocityX, velocityY, velocityZ),
      life,
    });
  }
  // remove from list
  list.splice(index, 1);
}

/**
 * Update fragment physics and lifetimes; remove expired ones.
 * @param deltaSeconds Frame delta time in seconds
 * @returns void
 */
function updateFragments(deltaSeconds: number) {
  if (!scene) return;
  for (let i = fragments.length - 1; i >= 0; i -= 1) {
    const fragment = fragments[i];
    if (!fragment) continue;
    fragment.velocity.y -= C.SHATTER_GRAVITY * deltaSeconds;
    fragment.mesh.position.x += fragment.velocity.x * deltaSeconds;
    fragment.mesh.position.y += fragment.velocity.y * deltaSeconds;
    fragment.mesh.position.z += fragment.velocity.z * deltaSeconds;
    fragment.mesh.rotation.x += C.SHATTER_FRAGMENT_ROTATION_X * deltaSeconds;
    fragment.mesh.rotation.y += C.SHATTER_FRAGMENT_ROTATION_Y * deltaSeconds;
    fragment.life -= deltaSeconds;
    if (fragment.life <= 0 || fragment.mesh.position.y <= 0) {
      scene.remove(fragment.mesh);
      fragments.splice(i, 1);
      // geometry/material shared are disposed later via addToDispose
    }
  }
}

/**
 * Temporarily tint materials to the hit color, then restore after a delay.
 * @param group Group whose descendant mesh materials are tinted
 * @returns void
 */
function flashHitColor(group: THREE.Group) {
  const red = new THREE.Color(C.HIT_FLASH_COLOR);
  const originalColors: Array<{ mat: THREE.Material; color: THREE.Color }> = [];

  const getMaterialColor = (m: THREE.Material): THREE.Color | null => {
    const maybe = m as unknown as { color?: unknown };
    return maybe.color instanceof THREE.Color
      ? (maybe.color as THREE.Color)
      : null;
  };

  group.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const material = obj.material;
    if (!material) return;
    if (Array.isArray(material)) {
      for (const mat of material) {
        const color = getMaterialColor(mat);
        if (color) {
          originalColors.push({ mat, color: color.clone() });
          color.set(red);
        }
      }
    } else {
      const color = getMaterialColor(material);
      if (color) {
        originalColors.push({ mat: material, color: color.clone() });
        color.set(red);
      }
    }
  });
  setTimeout(() => {
    for (const entry of originalColors) {
      const maybe = entry.mat as unknown as { color?: unknown };
      if (maybe.color instanceof THREE.Color) maybe.color.copy(entry.color);
    }
  }, C.HIT_FLASH_DURATION_MS);
}

/**
 * Record key down; start punch on punch key; prevent space from scrolling.
 * @param e Keyboard event
 * @returns void
 */
function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Space') e.preventDefault();
  keys.add(e.key);
  // Trigger punch with 'z'
  const keyLower = e.key.toLowerCase();
  if ((C.KEYS_PUNCH as readonly string[]).includes(keyLower)) {
    if (!isPunching && punchCooldown === 0) {
      if (armLeftGroup || armRightGroup) {
        isPunching = true;
        punchTimer = 0;
      }
    }
  }
}
/**
 * Record key up.
 * @param e Keyboard event
 * @returns void
 */
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key);
}
/**
 * Track pointer lock state changes.
 * @returns void
 */
function onPointerLockChange() {
  isPointerLocked = document.pointerLockElement === canvasEl;
}
/**
 * When pointer-locked, update yaw/pitch from mouse deltas.
 * @param e Mouse event
 * @returns void
 */
function onMouseMove(e: MouseEvent) {
  if (!isPointerLocked) return;
  playerYaw -= e.movementX * C.MOUSE_SENSITIVITY;
  cameraYaw = playerYaw;
  pitch -= e.movementY * C.MOUSE_SENSITIVITY;
  pitch = clamp(pitch, C.MIN_PITCH, C.MAX_PITCH);
}

/**
 * Test if moving to (nextX, nextZ) collides with colliders.
 * Trees can be bypassed when jumping high enough (clearance).
 * @param nextX Candidate X position
 * @param nextZ Candidate Z position
 * @returns true if colliding, false otherwise
 */
function willCollide(nextX: number, nextZ: number) {
  // Allow passing over small/big trees if jumping above their top
  const clearance = C.COLLISION_VERTICAL_CLEARANCE;
  for (const tree of trees) {
    if (
      xzDistanceSquared(nextX, nextZ, tree.x, tree.z) <
      (tree.r + C.PLAYER_RADIUS) * (tree.r + C.PLAYER_RADIUS)
    ) {
      const topY = tree.topY ?? Infinity;
      if (player.position.y <= topY - clearance) return true;
      // else: high enough, ignore this tree
    }
  }
  // Other colliders (e.g., mountains) still block
  for (const c of colliders) {
    // Skip colliders owned by trees we've already allowed to pass
    const blockingTree = trees.find((t) => t.collider === c);
    if (blockingTree) {
      const topY = blockingTree.topY ?? Infinity;
      if (player.position.y > topY - clearance) continue;
    }
    if (
      xzDistanceSquared(nextX, nextZ, c.x, c.z) <
      (c.r + C.PLAYER_RADIUS) * (c.r + C.PLAYER_RADIUS)
    )
      return true;
  }
  return false;
}

onMounted(() => {
  const containerElement = container.value;
  if (!containerElement) return;
  const width = containerElement.clientWidth || window.innerWidth;
  const height = containerElement.clientHeight || window.innerHeight;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    C.CAMERA_FOV_DEG,
    width / height,
    C.CAMERA_NEAR,
    C.CAMERA_FAR
  );
  camera.position.set(0, 2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, C.RENDERER_MAX_PIXEL_RATIO)
  );
  renderer.setSize(width, height, true);
  containerElement.appendChild(renderer.domElement);
  canvasEl = renderer.domElement;

  buildEnvironment();
  buildPlayer();
  scene.add(player);

  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mousemove', onMouseMove);
  containerElement.addEventListener('click', () => {
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
      if (isDisposable(res)) res.dispose();
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
