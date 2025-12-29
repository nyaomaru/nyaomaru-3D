<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import * as C from '../constants';
import { isDisposable } from '../utils/is';
import { normalizeAngle, clamp } from '../utils';
import type { Collider, Destructible, ShatterFragment } from '../types';
import { useEnvironment } from '../composables/useEnvironment';
import { useAvatar } from '../composables/useAvatar';
import { useHouse } from '../composables/useHouse';
import { usePoliceStation } from '../composables/usePoliceStation';

const container = ref<HTMLDivElement | null>(null);

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let animationFrameId = 0;

// Player
const player = new THREE.Group();
const lookAtOffset = new THREE.Vector3(0, 1.0, 0);
const moveDir = new THREE.Vector3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
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

// Bear (police station chief room)
const bearAnchors: Array<{ anchor: THREE.Object3D; message: string }> = [];
let activeBearAnchor: { anchor: THREE.Object3D; message: string } | null = null;
let bearInteractRadius = 5.0;
let bearTalkUntil = 0;
const bearPromptVisible = ref(false);
const bearBubbleVisible = ref(false);
const bearBubbleText = ref('Hello');
const bearBubbleStyle = ref<Record<string, string>>({});

// House
let houseDoorHinge: THREE.Group | null = null;
let houseDoorCollider: Collider | null = null;
let houseDoorOpen = false;

type DoorState = {
  hinge: THREE.Group;
  collider: Collider;
  openAngleMagnitude: number;
  closedRotation: number;
  interactRadius?: number;
  open: boolean;
};
let policeStationDoors: DoorState[] = [];

// Camera mode
const FIRST_PERSON_EYE_BACK_OFFSET = 0.05; // slight pull-back to avoid clipping
let firstPersonActive = false;

/**
 * Toggle first-person camera mode state.
 * @param active Whether first-person mode is active
 * @returns void
 */
function setFirstPersonActive(active: boolean) {
  if (firstPersonActive === active) return;
  firstPersonActive = active;
  // Keep avatar visible so mirrors can reflect the player.
  // If self-visibility becomes an issue, we can hide only specific parts
  // or switch to camera layer-based culling instead of global visibility.
}

/**
 * Assign a render layer to an object and all descendants.
 * @param obj Root object to assign
 * @param layer Layer index
 * @returns void
 */
function setLayersRecursive(obj: THREE.Object3D, layer: number) {
  obj.layers.set(layer);
  obj.traverse((child) => child.layers.set(layer));
}

/**
 * Convert world XZ to house-local XZ.
 * @param wx World X
 * @param wz World Z
 * @returns Local XZ object
 */
function getHouseLocalXZ(wx: number, wz: number) {
  return {
    x: wx - C.HOUSE_POSITION.x,
    z: wz - C.HOUSE_POSITION.z,
  };
}

/**
 * Convert world XZ to police-station-local XZ.
 * @param wx World X
 * @param wz World Z
 * @returns Local XZ object
 */
function getPoliceStationLocalXZ(wx: number, wz: number) {
  return {
    x: wx - C.POLICE_STATION_POSITION.x,
    z: wz - C.POLICE_STATION_POSITION.z,
  };
}

/**
 * Write a forward vector from yaw into `out`.
 * @param out Vector to write into
 * @param yaw Yaw in radians
 * @returns The same vector passed in
 */
function setForwardFromYaw(out: THREE.Vector3, yaw: number) {
  return out.set(0, 0, -1).applyAxisAngle(AXIS_Y, yaw).normalize();
}

function isPlayerInsideHouse(): boolean {
  // Determine if player's XZ is within inner house bounds
  const { x: localX, z: localZ } = getHouseLocalXZ(
    player.position.x,
    player.position.z
  );
  const halfW = C.HOUSE_WIDTH / 2 - C.HOUSE_WALL_THICKNESS * 0.5;
  const halfD = C.HOUSE_DEPTH / 2 - C.HOUSE_WALL_THICKNESS * 0.5;
  return localX > -halfW && localX < halfW && localZ > -halfD && localZ < halfD;
}

function isPlayerInsidePoliceStation(): boolean {
  const { x: localX, z: localZ } = getPoliceStationLocalXZ(
    player.position.x,
    player.position.z
  );
  const halfW =
    C.POLICE_STATION_WIDTH / 2 - C.POLICE_STATION_WALL_THICKNESS * 0.5;
  const halfD =
    C.POLICE_STATION_DEPTH / 2 - C.POLICE_STATION_WALL_THICKNESS * 0.5;
  if (localX <= -halfW || localX >= halfW || localZ <= -halfD || localZ >= halfD)
    return false;
  const maxY =
    C.POLICE_STATION_FLOOR_COUNT * C.POLICE_STATION_FLOOR_HEIGHT;
  return player.position.y >= 0 && player.position.y <= maxY;
}

function isPlayerOnRoof(): boolean {
  const { x: localX, z: localZ } = getHouseLocalXZ(
    player.position.x,
    player.position.z
  );
  const roofHalfW = (C.HOUSE_WIDTH + C.HOUSE_ROOF_OVERHANG) / 2;
  const roofHalfD = (C.HOUSE_DEPTH + C.HOUSE_ROOF_OVERHANG) / 2;
  if (
    localX <= -roofHalfW ||
    localX >= roofHalfW ||
    localZ <= -roofHalfD ||
    localZ >= roofHalfD
  )
    return false;
  return (
    player.position.y >=
    C.HOUSE_ROOF_TOP_Y - C.COLLISION_VERTICAL_CLEARANCE
  );
}

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
 * Return the ground height at a given XZ location, considering
 * special platforms like the house step and roof.
 */
function getGroundHeight(px: number, pz: number): number {
  let groundY = C.GROUND_Y;
  // Step top region (world space rectangle)
  const stepCenterX = C.HOUSE_POSITION.x + C.HOUSE_STEP_LOCAL_X;
  const stepCenterZ = C.HOUSE_POSITION.z + C.HOUSE_STEP_LOCAL_Z;
  const halfStepW = C.HOUSE_STEP_WIDTH / 2;
  const halfStepD = C.HOUSE_STEP_DEPTH / 2;
  if (
    px >= stepCenterX - halfStepW &&
    px <= stepCenterX + halfStepW &&
    pz >= stepCenterZ - halfStepD &&
    pz <= stepCenterZ + halfStepD
  ) {
    groundY = Math.max(groundY, C.HOUSE_STEP_HEIGHT);
  }
  // Roof top region (world space rectangle)
  const { x: localX, z: localZ } = getHouseLocalXZ(px, pz);
  const roofHalfW = (C.HOUSE_WIDTH + C.HOUSE_ROOF_OVERHANG) / 2;
  const roofHalfD = (C.HOUSE_DEPTH + C.HOUSE_ROOF_OVERHANG) / 2;
  if (
    localX > -roofHalfW &&
    localX < roofHalfW &&
    localZ > -roofHalfD &&
    localZ < roofHalfD
  ) {
    // Only consider roof as ground when the player is already
    // above the wall height, to avoid warping upward while indoors.
    if (
      player.position.y >
      C.HOUSE_WALL_HEIGHT - C.COLLISION_VERTICAL_CLEARANCE
    ) {
      groundY = Math.max(groundY, C.HOUSE_ROOF_TOP_Y);
    }
  }

  const { x: stationX, z: stationZ } = getPoliceStationLocalXZ(px, pz);
  const stationHalfW = C.POLICE_STATION_WIDTH / 2;
  const stationHalfD = C.POLICE_STATION_DEPTH / 2;
  if (
    stationX > -stationHalfW &&
    stationX < stationHalfW &&
    stationZ > -stationHalfD &&
    stationZ < stationHalfD
  ) {
    const clearance = C.COLLISION_VERTICAL_CLEARANCE;
    const stairStepHeight =
      C.POLICE_STATION_FLOOR_HEIGHT / C.POLICE_STATION_STAIR_STEP_COUNT;
    for (let floor = 1; floor < C.POLICE_STATION_FLOOR_COUNT; floor += 1) {
      const floorY =
        C.POLICE_STATION_FLOOR_HEIGHT * floor +
        C.POLICE_STATION_FLOOR_THICKNESS;
      if (player.position.y > floorY - stairStepHeight - clearance) {
        groundY = Math.max(groundY, floorY);
      }
    }

    const stairHalfW = C.POLICE_STATION_STAIR_WIDTH / 2 + 0.4;
    const stairHalfD = C.POLICE_STATION_STAIR_DEPTH / 2 + 0.4;
    const stairMinX = C.POLICE_STATION_STAIR_CENTER_X - stairHalfW;
    const stairMaxX = C.POLICE_STATION_STAIR_CENTER_X + stairHalfW;
    const stairMinZ = C.POLICE_STATION_STAIR_CENTER_Z - stairHalfD;
    const stairMaxZ = C.POLICE_STATION_STAIR_CENTER_Z + stairHalfD;
    if (
      stationX >= stairMinX &&
      stationX <= stairMaxX &&
      stationZ >= stairMinZ &&
      stationZ <= stairMaxZ
    ) {
      const stepCount = C.POLICE_STATION_STAIR_STEP_COUNT;
      const stepDepth = C.POLICE_STATION_STAIR_DEPTH / stepCount;
      const along = stationZ - stairMinZ;
      const stepIndex = Math.min(
        stepCount - 1,
        Math.max(0, Math.floor(along / stepDepth))
      );
      const stepHeight = C.POLICE_STATION_FLOOR_HEIGHT / stepCount;
      const flightCount = Math.min(
        2,
        Math.max(1, C.POLICE_STATION_FLOOR_COUNT - 1)
      );
      const flightIndex = Math.min(
        flightCount - 1,
        Math.max(
          0,
          Math.floor(
            (player.position.y + clearance) / C.POLICE_STATION_FLOOR_HEIGHT
          )
        )
      );
      const baseY = C.POLICE_STATION_FLOOR_HEIGHT * flightIndex;
      groundY = Math.max(groundY, baseY + (stepIndex + 1) * stepHeight);
    }
  }
  return groundY;
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
  setForwardFromYaw(moveDir, playerYaw);
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
    setForwardFromYaw(airMoveVec, playerYaw);
    airMoveVec.multiplyScalar(speed * forward * C.AIR_TAKEOFF_SPEED_MULT);
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
 * Build a large house with a hinged door and add its colliders.
 */
function buildHouse() {
  if (!scene) return;
  const h = useHouse(scene, addToDispose);
  houseDoorHinge = h.doorHinge;
  houseDoorCollider = h.doorCollider;
  houseDoorOpen = false;
  colliders.push(...h.wallColliders);
  if (houseDoorCollider) colliders.push(houseDoorCollider);
}

function buildPoliceStation() {
  if (!scene) return;
  const station = usePoliceStation(scene, addToDispose);
  colliders.push(...station.colliders);
  bearAnchors.length = 0;
  if (station.bearAnchors) bearAnchors.push(...station.bearAnchors);
  bearInteractRadius = station.bearInteractRadius ?? bearInteractRadius;
  policeStationDoors = station.doors.map((door) => ({
    hinge: door.hinge,
    collider: door.collider,
    openAngleMagnitude: door.openAngleMagnitude,
    closedRotation: door.closedRotation,
    interactRadius: door.interactRadius,
    open: false,
  }));
  for (const door of policeStationDoors) {
    colliders.push(door.collider);
  }
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
    // mid-air: apply preserved momentum and allow small steering input
    let nextX = player.position.x;
    let nextZ = player.position.z;
    if (airMoveVec.lengthSq() > 0) {
      nextX += airMoveVec.x * deltaSeconds;
      nextZ += airMoveVec.z * deltaSeconds;
    }
    if (forward !== 0) {
      const steer = setForwardFromYaw(tmpVecA, playerYaw);
      const airDist =
        forward * (C.MOVE_SPEED * C.AIR_CONTROL_MULT) * deltaSeconds;
      nextX += steer.x * airDist;
      nextZ += steer.z * airDist;
    }
    movePlayerIfNoCollision(nextX, nextZ);
  }

  if (isGrounded && C.KEYS_JUMP.some((k) => keys.has(k))) {
    verticalVelocity = C.JUMP_SPEED;
    isGrounded = false;
    // capture momentum at takeoff
    applyJumpTakeoffMomentum(forward, speed);
  }
  verticalVelocity -= C.GRAVITY * deltaSeconds;
  player.position.y += verticalVelocity * deltaSeconds;
  const groundY = getGroundHeight(player.position.x, player.position.z);
  if (player.position.y < groundY) {
    player.position.y = groundY;
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
  const inside = isPlayerInsideHouse();
  const insideStation = isPlayerInsidePoliceStation();
  const onRoof = isPlayerOnRoof();
  const target = tmpTarget.copy(player.position).add(lookAtOffset);

  if ((inside && !onRoof) || insideStation) {
    // First-person-style view when inside the house
    setFirstPersonActive(true);
    // Hide player layer for main camera in first-person
    camera.layers.disable(C.PLAYER_LAYER);
    const dir = tmpVecB
      .set(0, 0, -1)
      .applyAxisAngle(AXIS_X, pitch)
      .applyAxisAngle(AXIS_Y, playerYaw)
      .normalize();
    const eye = tmpVecC.copy(target);
    const camPos = tmpVecA
      .copy(eye)
      .addScaledVector(dir, -FIRST_PERSON_EYE_BACK_OFFSET);
    const look = tmpVecC.addScaledVector(dir, 1.0);
    camera.position.copy(camPos);
    camera.lookAt(look);
    return;
  }

  // Third-person camera outside
  setFirstPersonActive(false);
  // Show player layer for main camera in third-person
  camera.layers.enable(C.PLAYER_LAYER);
  const distance = C.CAMERA_DISTANCE;
  const fwd = setForwardFromYaw(tmpVecB, playerYaw);
  const horizontal = distance * Math.cos(pitch);
  const offY = distance * Math.sin(pitch);
  const pos = tmpVecC
    .copy(target)
    .addScaledVector(fwd, -horizontal)
    .add(tmpVecA.set(0, offY, 0));
  camera.position.copy(pos);
  camera.lookAt(target);
}

function getNearbyBearAnchor(): { anchor: THREE.Object3D; message: string } | null {
  if (bearAnchors.length === 0) return null;
  let nearest: { anchor: THREE.Object3D; message: string } | null = null;
  let nearestDist2 = Infinity;
  for (const entry of bearAnchors) {
    entry.anchor.getWorldPosition(tmpVecD);
    const dist2 = xzDistanceSquared(
      player.position.x,
      player.position.z,
      tmpVecD.x,
      tmpVecD.z
    );
    if (dist2 < nearestDist2) {
      nearestDist2 = dist2;
      nearest = entry;
    }
  }
  if (nearest && nearestDist2 <= bearInteractRadius * bearInteractRadius) {
    return nearest;
  }
  return null;
}

function updateBearBubblePosition() {
  if (!activeBearAnchor || !camera || !container.value) return;
  activeBearAnchor.anchor.getWorldPosition(tmpVecD);
  const projected = tmpVecA.copy(tmpVecD).project(camera);
  const width = container.value.clientWidth || window.innerWidth;
  const height = container.value.clientHeight || window.innerHeight;
  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (-projected.y * 0.5 + 0.5) * height;
  const inView =
    projected.z >= -1 &&
    projected.z <= 1 &&
    projected.x >= -1 &&
    projected.x <= 1 &&
    projected.y >= -1 &&
    projected.y <= 1;
  bearBubbleStyle.value = {
    transform: `translate(-50%, -100%) translate(${x}px, ${y}px)`,
    opacity: inView ? '1' : '0',
  };
}

function updateBearUI() {
  if (bearAnchors.length === 0) {
    bearPromptVisible.value = false;
    bearBubbleVisible.value = false;
    return;
  }
  const nearAnchor = getNearbyBearAnchor();
  if (nearAnchor && activeBearAnchor?.anchor !== nearAnchor.anchor) {
    activeBearAnchor = nearAnchor;
    if (bearBubbleVisible.value) {
      bearBubbleText.value = nearAnchor.message;
      updateBearBubblePosition();
    }
  }
  activeBearAnchor = nearAnchor;
  const nearBear = Boolean(nearAnchor);
  bearPromptVisible.value = nearBear;
  if (!nearBear && bearBubbleVisible.value) {
    bearBubbleVisible.value = false;
    return;
  }
  if (bearBubbleVisible.value) {
    if (performance.now() > bearTalkUntil) {
      bearBubbleVisible.value = false;
    } else {
      updateBearBubblePosition();
    }
  }
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
  updateBearUI();
  if (renderer && scene && camera) renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Write the player's forward XZ vector into `out`.
 * @param out Vector to write into
 * @returns The same vector passed in
 */
function getPlayerForward(out: THREE.Vector3) {
  setForwardFromYaw(out, playerYaw);
  return out;
}

function toggleDoorIfHit(door: DoorState, fist: THREE.Vector3) {
  const dx = fist.x - door.collider.x;
  const dz = fist.z - door.collider.z;
  const hitRadius = door.interactRadius ?? door.collider.r;
  const rr = (hitRadius + C.PUNCH_RADIUS) * (hitRadius + C.PUNCH_RADIUS);
  if (dx * dx + dz * dz > rr) return false;
  if (!door.open) {
    const toPlayerX = player.position.x - door.collider.x;
    const toPlayerZ = player.position.z - door.collider.z;
    const normal = tmpVecA
      .set(0, 0, 1)
      .applyAxisAngle(AXIS_Y, door.closedRotation);
    const dot = normal.x * toPlayerX + normal.z * toPlayerZ;
    const openSign = dot >= 0 ? -1 : 1;
    door.hinge.rotation.y =
      door.closedRotation + openSign * door.openAngleMagnitude;
    door.open = true;
    const idx = colliders.indexOf(door.collider);
    if (idx !== -1) colliders.splice(idx, 1);
    return true;
  }
  const pdx = player.position.x - door.collider.x;
  const pdz = player.position.z - door.collider.z;
  const pr2 = (door.collider.r + C.PLAYER_RADIUS) * (door.collider.r + C.PLAYER_RADIUS);
  if (pdx * pdx + pdz * pdz <= pr2) return false;
  door.hinge.rotation.y = door.closedRotation;
  door.open = false;
  if (!colliders.includes(door.collider)) colliders.push(door.collider);
  return true;
}

/**
 * Run punch hit test and apply damage/visuals on trees or mountains.
 * @returns void
 */
function attemptPunchHit() {
  if (!scene) return;
  const fwd = tmpVecA;
  getPlayerForward(fwd);
  const fist = tmpVecB.copy(player.position);
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
    return;
  }
  // Open/close house door if punching near it
  if (houseDoorCollider) {
    const dx = fist.x - houseDoorCollider.x;
    const dz = fist.z - houseDoorCollider.z;
    const rr =
      (houseDoorCollider.r + C.PUNCH_RADIUS) *
      (houseDoorCollider.r + C.PUNCH_RADIUS);
    const inRange = dx * dx + dz * dz <= rr;
    if (!houseDoorOpen && inRange) {
      if (houseDoorHinge) {
        houseDoorHinge.rotation.y = -C.HOUSE_DOOR_OPEN_ANGLE;
      }
      houseDoorOpen = true;
      // Remove door collider to allow passage
      const idx = colliders.indexOf(houseDoorCollider);
      if (idx !== -1) colliders.splice(idx, 1);
    } else if (houseDoorOpen && inRange && isPlayerInsideHouse()) {
      const pdx = player.position.x - houseDoorCollider.x;
      const pdz = player.position.z - houseDoorCollider.z;
      const pr2 =
        (houseDoorCollider.r + C.PLAYER_RADIUS) *
        (houseDoorCollider.r + C.PLAYER_RADIUS);
      // Avoid closing the door when the player is in the doorway
      if (pdx * pdx + pdz * pdz > pr2) {
        if (houseDoorHinge) {
          houseDoorHinge.rotation.y = 0;
        }
        houseDoorOpen = false;
        if (!colliders.includes(houseDoorCollider)) {
          colliders.push(houseDoorCollider);
        }
      }
    }
  }

  for (const door of policeStationDoors) {
    if (toggleDoorIfHit(door, fist)) return;
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
  if ((C.KEYS_TALK as readonly string[]).includes(keyLower)) {
    const nearAnchor = getNearbyBearAnchor();
    if (nearAnchor) {
      activeBearAnchor = nearAnchor;
      bearBubbleText.value = nearAnchor.message;
      bearBubbleVisible.value = true;
      bearTalkUntil = performance.now() + 2200;
      updateBearBubblePosition();
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
    // Allow passing over colliders that only block up to a height (e.g., house walls)
    if (
      typeof c.maxBlockY === 'number' &&
      player.position.y > c.maxBlockY - clearance
    ) {
      continue;
    }
    if (
      typeof c.minBlockY === 'number' &&
      player.position.y < c.minBlockY - clearance
    ) {
      continue;
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
  // Start with showing player (third-person default outside)
  camera.layers.enable(0);
  camera.layers.enable(C.PLAYER_LAYER);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, C.RENDERER_MAX_PIXEL_RATIO)
  );
  renderer.setSize(width, height, true);
  containerElement.appendChild(renderer.domElement);
  canvasEl = renderer.domElement;

  buildEnvironment();
  buildHouse();
  buildPoliceStation();
  buildPlayer();
  // Put the avatar on a dedicated layer so we can hide it in first-person
  setLayersRecursive(player, C.PLAYER_LAYER);
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
  <div class="world-root">
    <div
      ref="container"
      class="world-canvas"
    ></div>
    <div
      v-if="bearBubbleVisible"
      class="speech-bubble"
      :style="bearBubbleStyle"
    >
      {{ bearBubbleText }}
    </div>
    <div
      v-if="bearPromptVisible"
      class="talk-prompt"
    >
      <span class="talk-key">x</span>
      <span class="talk-sep">:</span>
      <span class="talk-text">talk</span>
    </div>
    <div class="hud">
      <div class="hud-mark">KEY MARK</div>
      <div class="hud-line">
        <span class="hud-key">space</span>
        <span class="hud-sep">:</span>
        <span class="hud-action">jump</span>
      </div>
      <div class="hud-line">
        <span class="hud-key">z</span>
        <span class="hud-sep">:</span>
        <span class="hud-action">punch or open</span>
      </div>
      <div class="hud-line">
        <span class="hud-key">x</span>
        <span class="hud-sep">:</span>
        <span class="hud-action">talk</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.world-canvas {
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 10px 12px;
  background: rgba(15, 12, 8, 0.6);
  color: #f7e7c2;
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  border: 1px solid rgba(247, 231, 194, 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.hud-mark {
  display: inline-block;
  padding: 2px 6px;
  margin-bottom: 6px;
  font-weight: 700;
  font-size: 11px;
  background: rgba(247, 231, 194, 0.18);
  border: 1px solid rgba(247, 231, 194, 0.5);
}

.hud-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hud-line + .hud-line {
  margin-top: 4px;
}

.hud-key {
  min-width: 36px;
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  text-align: center;
  background: rgba(32, 28, 22, 0.8);
  border: 1px solid rgba(247, 231, 194, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.35);
}

.hud-sep {
  opacity: 0.8;
}

.hud-action {
  font-size: 11px;
}

.speech-bubble {
  position: absolute;
  left: 0;
  top: 0;
  padding: 8px 12px;
  border-radius: 12px;
  border: 2px solid rgba(25, 18, 12, 0.9);
  background: #f6f1e4;
  color: #2c1b10;
  font-size: 13px;
  letter-spacing: 0.2px;
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.talk-prompt {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(18, 14, 10, 0.78);
  color: #f7e7c2;
  font-size: 12px;
  text-transform: uppercase;
  border: 1px solid rgba(247, 231, 194, 0.45);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.talk-key {
  min-width: 20px;
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  text-align: center;
  background: rgba(32, 28, 22, 0.9);
  border: 1px solid rgba(247, 231, 194, 0.6);
}

.talk-sep {
  opacity: 0.8;
}

.talk-text {
  font-size: 11px;
}
</style>
