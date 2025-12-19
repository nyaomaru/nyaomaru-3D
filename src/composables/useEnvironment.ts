import * as THREE from 'three';
import type { Collider, Destructible } from '../types';
import * as C from '../constants';

export function useEnvironment(
  scene: THREE.Scene,
  addToDispose: (
    res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
  ) => void
) {
  const colliders: Collider[] = [];
  const trees: Destructible[] = [];
  const mountains: Destructible[] = [];

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
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial.clone());
    addToDispose(mountain.material);
    mountain.position.set(
      Math.cos(angleRad) * distanceFromOrigin,
      3 * mountainScale,
      Math.sin(angleRad) * distanceFromOrigin
    );
    mountain.scale.setScalar(mountainScale);
    scene.add(mountain);
    // Add a slightly generous collider to prevent grazing through edges
    const collider: Collider = { x: mountain.position.x, z: mountain.position.z, r: 3 * mountainScale * 1.05 };
    colliders.push(collider);
    const mbbox = new THREE.Box3().setFromObject(mountain);
    mountains.push({
      id: 5000 + index,
      group: mountain,
      x: mountain.position.x,
      y: mountain.position.y,
      z: mountain.position.z,
      r: collider.r,
      topY: mbbox.max.y,
      health: C.MOUNTAIN_HEALTH,
      maxHealth: C.MOUNTAIN_HEALTH,
      collider,
    });
  }
  addToDispose(mountainGeometry);
  addToDispose(mountainMaterial);

  // Trees: simple trunk + crown
  const trunkGeometry = new THREE.CylinderGeometry(
    C.TREE_TRUNK_RADIUS,
    C.TREE_TRUNK_RADIUS,
    C.TREE_TRUNK_HEIGHT,
    8
  );
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const crownGeometry = new THREE.SphereGeometry(C.TREE_CROWN_RADIUS, 10, 8);
  const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
  for (let i = 0; i < C.TREE_COUNT; i += 1) {
    const dist = C.TREE_MIN_RADIUS + Math.random() * C.TREE_RADIUS_RANGE;
    const ang = Math.random() * Math.PI * 2;
    const gx = Math.cos(ang) * dist;
    const gz = Math.sin(ang) * dist;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial.clone());
    addToDispose(trunk.material);
    trunk.position.set(0, C.TREE_TRUNK_HEIGHT / 2, 0);
    const crown = new THREE.Mesh(crownGeometry, crownMaterial.clone());
    addToDispose(crown.material);
    crown.position.set(0, C.TREE_TRUNK_HEIGHT + C.TREE_CROWN_RADIUS * 0.6, 0);
    group.add(trunk, crown);
    group.position.set(gx, 0, gz);
    scene.add(group);
    const bbox = new THREE.Box3().setFromObject(group);
    const collider: Collider = { x: gx, z: gz, r: Math.max(C.TREE_CROWN_RADIUS * 0.8, 0.6) };
    colliders.push(collider);
    trees.push({
      id: i,
      group,
      x: gx,
      y: 0,
      z: gz,
      r: Math.max(C.TREE_CROWN_RADIUS, 0.6),
      topY: bbox.max.y,
      health: C.TREE_HEALTH,
      maxHealth: C.TREE_HEALTH,
      collider,
    });
  }
  addToDispose(trunkGeometry);
  addToDispose(trunkMaterial);
  addToDispose(crownGeometry);
  addToDispose(crownMaterial);

  // Big trees
  const bigTrunkGeo = new THREE.CylinderGeometry(
    C.BIG_TREE_TRUNK_RADIUS,
    C.BIG_TREE_TRUNK_RADIUS,
    C.BIG_TREE_TRUNK_HEIGHT,
    10
  );
  const bigTrunkMat = new THREE.MeshStandardMaterial({ color: 0x82562a });
  const bigCrownGeo = new THREE.SphereGeometry(C.BIG_TREE_CROWN_RADIUS, 14, 12);
  const bigCrownMat = new THREE.MeshStandardMaterial({ color: 0x2b7a4b });
  for (let i = 0; i < C.BIG_TREE_COUNT; i += 1) {
    const dist = C.BIG_TREE_MIN_RADIUS + Math.random() * C.BIG_TREE_RADIUS_RANGE;
    const ang = Math.random() * Math.PI * 2;
    const gx = Math.cos(ang) * dist;
    const gz = Math.sin(ang) * dist;
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(bigTrunkGeo, bigTrunkMat.clone());
    addToDispose(trunk.material);
    trunk.position.set(0, C.BIG_TREE_TRUNK_HEIGHT / 2, 0);
    const crown = new THREE.Mesh(bigCrownGeo, bigCrownMat.clone());
    addToDispose(crown.material);
    crown.position.set(0, C.BIG_TREE_TRUNK_HEIGHT + C.BIG_TREE_CROWN_RADIUS * 0.7, 0);
    group.add(trunk, crown);
    group.position.set(gx, 0, gz);
    scene.add(group);
    const bboxB = new THREE.Box3().setFromObject(group);
    const collider: Collider = { x: gx, z: gz, r: C.BIG_TREE_CROWN_RADIUS * 0.9 };
    colliders.push(collider);
    trees.push({
      id: 1000 + i,
      group,
      x: gx,
      y: 0,
      z: gz,
      r: C.BIG_TREE_CROWN_RADIUS,
      topY: bboxB.max.y,
      health: C.BIG_TREE_HEALTH,
      maxHealth: C.BIG_TREE_HEALTH,
      collider,
    });
  }
  addToDispose(bigTrunkGeo);
  addToDispose(bigTrunkMat);
  addToDispose(bigCrownGeo);
  addToDispose(bigCrownMat);

  return { colliders, trees, mountains };
}
