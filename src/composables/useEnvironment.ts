import * as THREE from 'three'
import type { Collider } from '../types'

export function useEnvironment(
  scene: THREE.Scene,
  addToDispose: (res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture) => void
) {
  const colliders: Collider[] = []

  // Sky and light
  scene.background = new THREE.Color(0x87ceeb)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.8)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(5, 10, 5)
  scene.add(hemi, dir)

  // Ground
  const groundGeo = new THREE.PlaneGeometry(1000, 1000)
  // Ground material: light sandy tan
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.92, metalness: 0.0 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  scene.add(ground)
  addToDispose(groundGeo)
  addToDispose(groundMat)

  // Mountains (simple cones placed around)
  const coneGeo = new THREE.ConeGeometry(3, 6, 6)
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.9 })
  for (let i = 0; i < 40; i += 1) {
    const r = 40 + Math.random() * 120
    const a = Math.random() * Math.PI * 2
    const scale = 0.8 + Math.random() * 2.5
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
