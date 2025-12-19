<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import * as C from '../constants'
import { normalizeAngle, clamp } from '../utils'
import type { Collider, Destructible, ShatterFragment } from '../types'
import { useEnvironment } from '../composables/useEnvironment'
import { useAvatar } from '../composables/useAvatar'

const container = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let animationFrameId = 0

// Player
const player = new THREE.Group()
let lookAtOffset = new THREE.Vector3(0, 1.0, 0)
const tmpVec = new THREE.Vector3()
let armLeftGroup: THREE.Group | null = null
let armRightGroup: THREE.Group | null = null
let leftFootGroup: THREE.Group | null = null
let rightFootGroup: THREE.Group | null = null

// Punch state
let isPunching = false
let punchTimer = 0
let punchCooldown = 0
let punchHand: 'left' | 'right' = 'right'

// Mouse look
let pitch = C.INITIAL_PITCH
let cameraYaw = 0
let canvasEl: HTMLCanvasElement | null = null
let isPointerLocked = false

// Movement
const keys = new Set<string>()
let playerYaw = 0
let verticalVelocity = 0
let isGrounded = true
// Preserve horizontal momentum during jump, but ignore mid-air input
const airMoveVec = new THREE.Vector3(0, 0, 0)

const colliders: Collider[] = []
const trees: Destructible[] = []
const fragments: ShatterFragment[] = []
const mountains: Destructible[] = []
let fragmentGeometry: THREE.BufferGeometry | null = null
let fragmentMaterial: THREE.Material | null = null
let punchDidHit = false

// Resources for disposal
const toDispose: Array<
  THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
> = []
function addToDispose(obj: any) {
  toDispose.push(obj)
}

function handleResize() {
  const el = container.value
  if (!el || !renderer || !camera) return
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, true)
}

function buildEnvironment() {
  if (!scene) return
  const env = useEnvironment(scene, addToDispose)
  colliders.push(...env.colliders)
  if (env.trees) trees.push(...env.trees)
  if (env.mountains) mountains.push(...env.mountains)
}

function buildPlayer() {
  const { armLeft, armRight, leftFoot, rightFoot, lookAt } = useAvatar(
    player,
    addToDispose
  )
  armLeftGroup = armLeft
  armRightGroup = armRight
  leftFootGroup = leftFoot
  rightFootGroup = rightFoot
  lookAtOffset.copy(lookAt)
}

function updatePlayer(dt: number) {
  let rot = 0
  if (keys.has('a') || keys.has('ArrowLeft')) rot += 1
  if (keys.has('d') || keys.has('ArrowRight')) rot -= 1
  playerYaw += rot * C.ROTATE_SPEED * dt
  player.rotation.y = playerYaw
  cameraYaw = playerYaw

  let forward = 0
  if (keys.has('w') || keys.has('ArrowUp')) forward += 1
  if (keys.has('s') || keys.has('ArrowDown')) forward -= 1

  const speed = C.MOVE_SPEED * (keys.has('Shift') ? 1.5 : 1)
  const moveDist = forward * speed * dt
  if (isGrounded) {
    if (forward !== 0) {
      const delta = normalizeAngle(cameraYaw - playerYaw)
      const maxStep = C.AUTO_TURN_SPEED * dt
      const step = Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep
      playerYaw += step
      player.rotation.y = playerYaw
    }
    if (moveDist !== 0) {
      tmpVec.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw)
      const nextX = player.position.x + tmpVec.x * moveDist
      const nextZ = player.position.z + tmpVec.z * moveDist
      if (!willCollide(nextX, nextZ)) {
        player.position.x = nextX
        player.position.z = nextZ
      }
    }
  } else {
    // mid-air: apply preserved momentum only; ignore new input
    if (airMoveVec.lengthSq() > 0) {
      const nextX = player.position.x + airMoveVec.x * dt
      const nextZ = player.position.z + airMoveVec.z * dt
      if (!willCollide(nextX, nextZ)) {
        player.position.x = nextX
        player.position.z = nextZ
      }
    }
  }

  if (isGrounded && (keys.has(' ') || keys.has('Space'))) {
    verticalVelocity = C.JUMP_SPEED
    isGrounded = false
    // capture momentum at takeoff
    if (forward !== 0) {
      airMoveVec.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw)
      airMoveVec.multiplyScalar(speed * forward)
    } else {
      airMoveVec.set(0, 0, 0)
    }
  }
  verticalVelocity -= C.GRAVITY * dt
  player.position.y += verticalVelocity * dt
  if (player.position.y < 0) {
    player.position.y = 0
    verticalVelocity = 0
    isGrounded = true
    airMoveVec.set(0, 0, 0)
  }

  const radial = Math.hypot(player.position.x, player.position.z)
  if (radial > C.WORLD_RADIUS - C.PLAYER_RADIUS) {
    const scale = (C.WORLD_RADIUS - C.PLAYER_RADIUS) / radial
    player.position.x *= scale
    player.position.z *= scale
  }

  // Punch animation (overrides arm swing if active)
  if (isPunching) {
    punchTimer += dt
    const t = Math.min(1, punchTimer / C.PUNCH_DURATION)
    const phase = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5)
    const angle = phase * C.PUNCH_ANGLE
    // apply hit once during forward phase
    if (t < 0.5 && !punchDidHit) {
      attemptPunchHit()
      punchDidHit = true
    }
    if (punchHand === 'left' && armLeftGroup) {
      // 左手も前方へ突き出す向きで統一
      armLeftGroup.rotation.x = -angle
      armLeftGroup.rotation.z = 0
    }
    if (punchHand === 'right' && armRightGroup) {
      armRightGroup.rotation.x = -angle
      armRightGroup.rotation.z = 0
    }
    if (t >= 1) {
      isPunching = false
      punchTimer = 0
      punchCooldown = C.PUNCH_COOLDOWN
      punchHand = punchHand === 'left' ? 'right' : 'left'
      punchDidHit = false
    }
  } else {
    if (punchCooldown > 0) punchCooldown = Math.max(0, punchCooldown - dt)
  }

  // Arm swing (optional)
  if (!isPunching && C.ENABLE_ARM_SWING) {
    const moving = Math.abs(forward) > 0.01
    const t = performance.now() * C.ARM_SWING_SPEED * (keys.has('Shift') ? C.ARM_SWING_DASH_MULT : 1)
    const amp = moving ? C.ARM_SWING_AMP : 0.0
    const swing = Math.sin(t) * amp
    if (armLeftGroup) {
      armLeftGroup.rotation.x = swing
      armLeftGroup.rotation.z = swing * 0.25
    }
    if (armRightGroup) {
      armRightGroup.rotation.x = -swing
      armRightGroup.rotation.z = -swing * 0.25
    }
  }

  // Feet swing (optional) — keep moving during punch
  if (C.ENABLE_LEG_SWING) {
    const moving = Math.abs(forward) > 0.01
    const t = performance.now() * C.LEG_SWING_SPEED
    const amp = moving ? C.LEG_SWING_AMP : 0.0
    const swing = Math.sin(t) * amp
    if (leftFootGroup) leftFootGroup.rotation.x = swing
    if (rightFootGroup) rightFootGroup.rotation.x = -swing
  }
}

function updateCamera() {
  if (!camera) return
  const distance = C.CAMERA_DISTANCE
  const target = new THREE.Vector3().copy(player.position).add(lookAtOffset)
  const fwd = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw)
    .normalize()
  const horizontal = distance * Math.cos(pitch)
  const offY = distance * Math.sin(pitch)
  const pos = new THREE.Vector3().copy(target).addScaledVector(fwd, -horizontal).add(new THREE.Vector3(0, offY, 0))
  camera.position.copy(pos)
  camera.lookAt(target)
}

function stopAnimation() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  animationFrameId = 0
}

const clock = new THREE.Clock()
function animate() {
  const dt = Math.min(0.05, clock.getDelta())
  updatePlayer(dt)
  updateCamera()
  updateFragments(dt)
  if (renderer && scene && camera) renderer.render(scene, camera)
  animationFrameId = requestAnimationFrame(animate)
}

function getPlayerForward(out: THREE.Vector3) {
  out.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw).normalize()
  return out
}

function attemptPunchHit() {
  if (!scene) return
  const fwd = new THREE.Vector3()
  getPlayerForward(fwd)
  const fist = new THREE.Vector3().copy(player.position)
  const y = lookAtOffset.y || 1.0
  fist.y += y
  fist.addScaledVector(fwd, C.PUNCH_REACH)
  // choose nearest tree within radius
  const radius = C.PUNCH_RADIUS
  let hitIndex = -1
  for (let i = 0; i < trees.length; i += 1) {
    const t = trees[i]
    const dx = t.x - fist.x
    const dz = t.z - fist.z
    if (dx * dx + dz * dz <= (t.r + radius) * (t.r + radius)) {
      hitIndex = i
      break
    }
  }
  if (hitIndex >= 0) {
    const t = trees[hitIndex]
    t.health -= 1
    flashHitColor(t.group)
    if (t.health <= 0) {
      shatterDestructible(trees, hitIndex)
    } else {
      // small nudge feedback
      t.group.scale.setScalar(1 + 0.03)
      setTimeout(() => t.group.scale.setScalar(1), 50)
    }
    return
  }
  // if no tree hit, allow mountains to flash on hit
  let mountainHit = -1
  for (let i = 0; i < mountains.length; i += 1) {
    const m = mountains[i]
    const dx = m.x - fist.x
    const dz = m.z - fist.z
    if (dx * dx + dz * dz <= (m.r + radius) * (m.r + radius)) {
      mountainHit = i
      break
    }
  }
  if (mountainHit >= 0) {
    const m = mountains[mountainHit]
    m.health -= 1
    flashHitColor(m.group)
    if (m.health <= 0) {
      shatterDestructible(mountains, mountainHit)
    }
  }
}

function ensureFragmentResources() {
  if (!fragmentGeometry) {
    fragmentGeometry = new THREE.BoxGeometry(C.SHATTER_FRAGMENT_SIZE, C.SHATTER_FRAGMENT_SIZE, C.SHATTER_FRAGMENT_SIZE)
    addToDispose(fragmentGeometry)
  }
  if (!fragmentMaterial) {
    fragmentMaterial = new THREE.MeshStandardMaterial({ color: 0x6fae6f, roughness: 0.6 })
    addToDispose(fragmentMaterial)
  }
}

function shatterDestructible(list: Destructible[], index: number) {
  if (!scene) return
  const t = list[index]
  scene.remove(t.group)
  // remove movement collider entirely so passage is clear
  if (t.collider) {
    const idx = colliders.indexOf(t.collider)
    if (idx !== -1) colliders.splice(idx, 1)
  }
  // spawn fragments around top of the object using its bounds
  ensureFragmentResources()
  const bbox = new THREE.Box3().setFromObject(t.group)
  const centerX = (bbox.min.x + bbox.max.x) * 0.5
  const centerZ = (bbox.min.z + bbox.max.z) * 0.5
  const topY = bbox.max.y
  const origin = new THREE.Vector3(centerX, topY, centerZ)
  const size = bbox.getSize(new THREE.Vector3())
  const scale = Math.max(1, Math.min(3, (size.x + size.y + size.z) / 6))
  const isMountain = t.id >= 5000
  const baseCount = Math.floor(C.SHATTER_FRAGMENT_COUNT * scale)
  const fragmentCount = isMountain ? Math.floor(baseCount * C.SHATTER_MOUNTAIN_COUNT_MULT) : baseCount
  for (let i = 0; i < fragmentCount; i += 1) {
    const mesh = new THREE.Mesh(fragmentGeometry!, fragmentMaterial!)
    mesh.position.copy(origin)
    if (isMountain) mesh.scale.setScalar(0.85)
    scene.add(mesh)
    const ang = Math.random() * Math.PI * 2
    const speedBase = C.SHATTER_FRAGMENT_SPEED * scale
    const speed = speedBase * (isMountain ? C.SHATTER_MOUNTAIN_SPEED_MULT : 1) * (0.6 + Math.random() * 0.8)
    const vx = Math.cos(ang) * speed
    const vz = Math.sin(ang) * speed
    const vy = C.SHATTER_FRAGMENT_UP * Math.max(1, scale * 0.8) * (isMountain ? C.SHATTER_MOUNTAIN_UP_MULT : 1) * (0.5 + Math.random() * 1.0)
    const life = C.SHATTER_LIFETIME * (isMountain ? C.SHATTER_MOUNTAIN_LIFETIME_MULT : 1)
    fragments.push({ mesh, velocity: new THREE.Vector3(vx, vy, vz), life })
  }
  // remove from list
  list.splice(index, 1)
}

function updateFragments(dt: number) {
  if (!scene) return
  for (let i = fragments.length - 1; i >= 0; i -= 1) {
    const f = fragments[i]
    f.velocity.y -= C.SHATTER_GRAVITY * dt
    f.mesh.position.x += f.velocity.x * dt
    f.mesh.position.y += f.velocity.y * dt
    f.mesh.position.z += f.velocity.z * dt
    f.mesh.rotation.x += 4 * dt
    f.mesh.rotation.y += 3 * dt
    f.life -= dt
    if (f.life <= 0 || f.mesh.position.y <= 0) {
      scene.remove(f.mesh)
      fragments.splice(i, 1)
      // geometry/material shared are disposed later via addToDispose
    }
  }
}

function flashHitColor(group: THREE.Group) {
  const red = new THREE.Color(0xff3333)
  const originalColors: Array<{ mat: any; color: THREE.Color }> = []
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const mat: any = (mesh && (mesh as any).material) || null
    if (!mat) return
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if (m && (m as any).color) {
          const orig = ((m as any).color as THREE.Color).clone()
          originalColors.push({ mat: m, color: orig })
          ;(m as any).color.set(red)
        }
      })
    } else if ((mat as any).color) {
      const orig = ((mat as any).color as THREE.Color).clone()
      originalColors.push({ mat, color: orig })
      ;(mat as any).color.set(red)
    }
  })
  setTimeout(() => {
    for (const entry of originalColors) {
      if ((entry.mat as any).color) (entry.mat as any).color.copy(entry.color)
    }
  }, 120)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Space') e.preventDefault()
  keys.add(e.key)
  // Trigger punch with 'z'
  if (e.key.toLowerCase() === 'z') {
    if (!isPunching && punchCooldown === 0) {
      if (armLeftGroup || armRightGroup) {
        isPunching = true
        punchTimer = 0
      }
    }
  }
}
function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key)
}
function onPointerLockChange() {
  isPointerLocked = document.pointerLockElement === canvasEl
}
function onMouseMove(e: MouseEvent) {
  if (!isPointerLocked) return
  playerYaw -= e.movementX * C.MOUSE_SENSITIVITY
  cameraYaw = playerYaw
  pitch -= e.movementY * C.MOUSE_SENSITIVITY
  pitch = clamp(pitch, C.MIN_PITCH, C.MAX_PITCH)
}

function willCollide(nextX: number, nextZ: number) {
  // Allow passing over small/big trees if jumping above their top
  const clearance = 0.05
  for (const t of trees) {
    const dx = nextX - t.x
    const dz = nextZ - t.z
    if (dx * dx + dz * dz < (t.r + C.PLAYER_RADIUS) * (t.r + C.PLAYER_RADIUS)) {
      const topY = t.topY ?? Infinity
      if (player.position.y <= topY - clearance) return true
      // else: high enough, ignore this tree
    }
  }
  // Other colliders (e.g., mountains) still block
  for (const c of colliders) {
    // Skip colliders owned by trees we've already allowed to pass
    const tree = trees.find((t) => t.collider === c)
    if (tree) {
      const topY = tree.topY ?? Infinity
      if (player.position.y > topY - clearance) continue
    }
    const dx = nextX - c.x
    const dz = nextZ - c.z
    if (dx * dx + dz * dz < (c.r + C.PLAYER_RADIUS) * (c.r + C.PLAYER_RADIUS)) return true
  }
  return false
}

onMounted(() => {
  const el = container.value!
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || window.innerHeight

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(0, 2, 4)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, true)
  el.appendChild(renderer.domElement)
  canvasEl = renderer.domElement

  buildEnvironment()
  buildPlayer()
  scene.add(player)

  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('mousemove', onMouseMove)
  el.addEventListener('click', () => {
    canvasEl?.requestPointerLock()
  })
  handleResize()

  clock.start()
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  document.removeEventListener('mousemove', onMouseMove)
  stopAnimation()
  try {
    renderer?.dispose()
    for (const res of toDispose) {
      if ((res as any).dispose) (res as any).dispose()
    }
  } catch {}
})
</script>

<template>
  <div ref="container" style="width: 100%; height: 100vh; overflow: hidden"></div>
</template>
