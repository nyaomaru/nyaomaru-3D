import * as THREE from 'three'
import type { Collider } from '../types'
import * as C from '../constants'

export function useEnvironment(
  scene: THREE.Scene,
  addToDispose: (res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture) => void
) {
  const colliders: Collider[] = []

  // Sky and light
  scene.background = new THREE.Color(C.SKY_COLOR)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, C.HEMI_LIGHT_INTENSITY)
  const dir = new THREE.DirectionalLight(0xffffff, C.DIR_LIGHT_INTENSITY)
  dir.position.set(C.DIR_LIGHT_POSITION.x, C.DIR_LIGHT_POSITION.y, C.DIR_LIGHT_POSITION.z)
  scene.add(hemi, dir)

  // Ground
  const groundGeo = new THREE.PlaneGeometry(C.GROUND_SIZE, C.GROUND_SIZE)
  // Ground material: light sandy tan
  const groundMat = new THREE.MeshStandardMaterial({ color: C.GROUND_COLOR_SAND, roughness: C.GROUND_ROUGHNESS, metalness: C.GROUND_METALNESS })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  scene.add(ground)
  addToDispose(groundGeo)
  addToDispose(groundMat)

  // Mountains (simple cones placed around)
  const coneGeo = new THREE.ConeGeometry(3, 6, 6)
  const coneMat = new THREE.MeshStandardMaterial({ color: C.MOUNTAIN_COLOR, roughness: 0.9 })
  for (let i = 0; i < C.MOUNTAIN_COUNT; i += 1) {
    const r = C.MOUNTAIN_BASE_RADIUS_MIN + Math.random() * C.MOUNTAIN_BASE_RADIUS_RANGE
    const a = Math.random() * Math.PI * 2
    const scale = C.MOUNTAIN_SCALE_MIN + Math.random() * C.MOUNTAIN_SCALE_RANGE
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.position.set(Math.cos(a) * r, 3 * scale, Math.sin(a) * r)
    cone.scale.setScalar(scale)
    scene.add(cone)
    colliders.push({ x: cone.position.x, z: cone.position.z, r: 3 * scale * 0.9 })
  }
  addToDispose(coneGeo)
  addToDispose(coneMat)

  return { colliders }
}
