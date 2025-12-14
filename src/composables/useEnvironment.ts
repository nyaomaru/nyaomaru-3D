import * as THREE from 'three';
import type { Collider } from '../types';
import * as C from '../constants';

export function useEnvironment(
  scene: THREE.Scene,
  addToDispose: (
    res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
  ) => void
) {
  const colliders: Collider[] = [];

  // Sky and light
  scene.background = new THREE.Color(C.SKY_COLOR);
  const hemi = new THREE.HemisphereLight(
    0xffffff,
    0x556b2f,
    C.HEMI_LIGHT_INTENSITY
  );
  const dir = new THREE.DirectionalLight(0xffffff, C.DIR_LIGHT_INTENSITY);
  dir.position.set(
    C.DIR_LIGHT_POSITION.x,
    C.DIR_LIGHT_POSITION.y,
    C.DIR_LIGHT_POSITION.z
  );
  scene.add(hemi, dir);

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(C.GROUND_SIZE, C.GROUND_SIZE);
  // Ground material: light sandy tan
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: C.GROUND_COLOR_SAND,
    roughness: C.GROUND_ROUGHNESS,
    metalness: C.GROUND_METALNESS,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);
  addToDispose(groundGeometry);
  addToDispose(groundMaterial);

  // Mountains (simple cones placed around)
  const mountainGeometry = new THREE.ConeGeometry(3, 6, 6);
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: C.MOUNTAIN_COLOR,
    roughness: 0.9,
  });
  for (let index = 0; index < C.MOUNTAIN_COUNT; index += 1) {
    const distanceFromOrigin =
      C.MOUNTAIN_BASE_RADIUS_MIN + Math.random() * C.MOUNTAIN_BASE_RADIUS_RANGE;
    const angleRad = Math.random() * Math.PI * 2;
    const mountainScale =
      C.MOUNTAIN_SCALE_MIN + Math.random() * C.MOUNTAIN_SCALE_RANGE;
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountain.position.set(
      Math.cos(angleRad) * distanceFromOrigin,
      3 * mountainScale,
      Math.sin(angleRad) * distanceFromOrigin
    );
    mountain.scale.setScalar(mountainScale);
    scene.add(mountain);
    colliders.push({
      x: mountain.position.x,
      z: mountain.position.z,
      r: 3 * mountainScale * 0.9,
    });
  }
  addToDispose(mountainGeometry);
  addToDispose(mountainMaterial);

  return { colliders };
}
