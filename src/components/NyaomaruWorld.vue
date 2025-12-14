<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import * as C from '../constants'
import { normalizeAngle, clamp } from '../utils'
import type { Collider } from '../types'
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

const colliders: Collider[] = []

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

  if (isGrounded && (keys.has(' ') || keys.has('Space'))) {
    verticalVelocity = C.JUMP_SPEED
    isGrounded = false
  }
  verticalVelocity -= C.GRAVITY * dt
  player.position.y += verticalVelocity * dt
  if (player.position.y < 0) {
    player.position.y = 0
    verticalVelocity = 0
    isGrounded = true
  }

  const radial = Math.hypot(player.position.x, player.position.z)
  if (radial > C.WORLD_RADIUS - C.PLAYER_RADIUS) {
    const scale = (C.WORLD_RADIUS - C.PLAYER_RADIUS) / radial
    player.position.x *= scale
    player.position.z *= scale
  }

  // Arm swing (optional)
  if (C.ENABLE_ARM_SWING) {
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

  // Feet swing (optional)
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
  if (renderer && scene && camera) renderer.render(scene, camera)
  animationFrameId = requestAnimationFrame(animate)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Space') e.preventDefault()
  keys.add(e.key)
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
  for (const c of colliders) {
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

