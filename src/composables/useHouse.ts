import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Collider } from '../types';
import * as C from '../constants';

export type HouseBuild = {
  group: THREE.Group;
  doorHinge: THREE.Group;
  doorMesh: THREE.Mesh;
  doorCollider: Collider;
  wallColliders: Collider[];
};

type MeshOptions = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  cloneMaterial?: boolean;
};

type HouseDimensions = {
  wallY: number;
  frontZ: number;
  sideZ: number;
  sideX: number;
  segmentWidth: number;
};

type HouseMaterials = {
  wallMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  roofMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshStandardMaterial;
};

type HouseTuning = {
  windowInset: number;
  tableZOffsetRatio: number;
  chairTableGap: number;
  bookshelfXOffsetRatio: number;
  bookshelfZOffsetRatio: number;
  bedFrameScale: number;
  pillowZOffsetRatio: number;
  bedXOffsetRatio: number;
  bedZOffsetRatio: number;
  lampRadiusTop: number;
  lampRadiusBottom: number;
  lampHeight: number;
  lampRadialSegments: number;
  lampClearanceY: number;
  lampColor: number;
  lightColor: number;
  lightIntensity: number;
  mirrorZOffsetRatio: number;
  wallBlockMaxYPad: number;
  wallRoughness: number;
  roofRoughness: number;
  glassRoughness: number;
  glassMetalness: number;
  glassOpacity: number;
  tableRoughness: number;
  chairRoughness: number;
  shelfRoughness: number;
  bedFrameRoughness: number;
  mattressRoughness: number;
  pillowRoughness: number;
  lampRoughness: number;
  lampMetalness: number;
  mirrorClipBias: number;
  minShelfBoardCount: number;
};

/**
 * Build a simple large house with four walls, a flat roof, and a hinged door.
 * Returns the group, door controls, and world-space colliders for movement.
 */
export function useHouse(
  scene: THREE.Scene,
  addToDispose: (
    res: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
  ) => void
): HouseBuild {
  const house = new THREE.Group();
  house.position.set(C.HOUSE_POSITION.x, 0, C.HOUSE_POSITION.z);

  const addToHouse = (...objects: THREE.Object3D[]) => {
    house.add(...objects);
    return objects;
  };

  const createMesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    options: MeshOptions = {}
  ) => {
    const cloneMaterial = options.cloneMaterial !== false;
    const meshMaterial = cloneMaterial ? material.clone() : material;
    if (cloneMaterial) addToDispose(meshMaterial);
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    if (options.position) mesh.position.set(...options.position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    return mesh;
  };

  const tuning: HouseTuning = {
    windowInset: 0.01,
    tableZOffsetRatio: 0.15,
    chairTableGap: 0.65,
    bookshelfXOffsetRatio: 0.32,
    bookshelfZOffsetRatio: 0.30,
    bedFrameScale: 0.98,
    pillowZOffsetRatio: 0.35,
    bedXOffsetRatio: 0.30,
    bedZOffsetRatio: 0.10,
    lampRadiusTop: 0.15,
    lampRadiusBottom: 0.20,
    lampHeight: 0.12,
    lampRadialSegments: 12,
    lampClearanceY: 0.15,
    lampColor: 0xf0f0f0,
    lightColor: 0xffe2b3,
    lightIntensity: 1.2,
    mirrorZOffsetRatio: 0.15,
    wallBlockMaxYPad: 0.01,
    wallRoughness: 0.95,
    roofRoughness: 0.7,
    glassRoughness: 0.1,
    glassMetalness: 0.0,
    glassOpacity: 0.35,
    tableRoughness: 0.7,
    chairRoughness: 0.7,
    shelfRoughness: 0.75,
    bedFrameRoughness: 0.8,
    mattressRoughness: 0.95,
    pillowRoughness: 0.95,
    lampRoughness: 0.6,
    lampMetalness: 0.1,
    mirrorClipBias: 0.003,
    minShelfBoardCount: 2,
  };

  const materials: HouseMaterials = {
    wallMat: new THREE.MeshStandardMaterial({
      color: C.HOUSE_WALL_COLOR,
      roughness: tuning.wallRoughness,
    }),
    trimMat: new THREE.MeshStandardMaterial({ color: C.HOUSE_TRIM_COLOR }),
    roofMat: new THREE.MeshStandardMaterial({
      color: C.HOUSE_ROOF_COLOR,
      roughness: tuning.roofRoughness,
    }),
    glassMat: new THREE.MeshStandardMaterial({
      color: C.WINDOW_TINT_COLOR,
      roughness: tuning.glassRoughness,
      metalness: tuning.glassMetalness,
      transparent: true,
      opacity: tuning.glassOpacity,
    }),
  };
  addToDispose(materials.wallMat);
  addToDispose(materials.trimMat);
  addToDispose(materials.roofMat);
  addToDispose(materials.glassMat);

  const dimensions: HouseDimensions = {
    wallY: C.HOUSE_WALL_HEIGHT / 2,
    frontZ: -C.HOUSE_DEPTH / 2 + C.HOUSE_WALL_THICKNESS / 2,
    sideZ: C.HOUSE_DEPTH / 2 - C.HOUSE_WALL_THICKNESS / 2,
    sideX: C.HOUSE_WIDTH / 2 - C.HOUSE_WALL_THICKNESS / 2,
    segmentWidth: (C.HOUSE_WIDTH - C.HOUSE_DOOR_WIDTH) / 2,
  };

  const buildWallsAndRoof = () => {
    const frontLeftGeo = new THREE.BoxGeometry(
      dimensions.segmentWidth,
      C.HOUSE_WALL_HEIGHT,
      C.HOUSE_WALL_THICKNESS
    );
    const backGeo = new THREE.BoxGeometry(
      C.HOUSE_WIDTH,
      C.HOUSE_WALL_HEIGHT,
      C.HOUSE_WALL_THICKNESS
    );
    const sideGeo = new THREE.BoxGeometry(
      C.HOUSE_WALL_THICKNESS,
      C.HOUSE_WALL_HEIGHT,
      C.HOUSE_DEPTH
    );
    addToDispose(frontLeftGeo);
    addToDispose(backGeo);
    addToDispose(sideGeo);

    const frontLeft = createMesh(frontLeftGeo, materials.wallMat, {
      position: [
        -C.HOUSE_DOOR_WIDTH / 2 - dimensions.segmentWidth / 2,
        dimensions.wallY,
        dimensions.frontZ,
      ],
    });
    const frontRight = createMesh(frontLeftGeo, materials.wallMat, {
      position: [
        C.HOUSE_DOOR_WIDTH / 2 + dimensions.segmentWidth / 2,
        dimensions.wallY,
        dimensions.frontZ,
      ],
    });
    const back = createMesh(backGeo, materials.wallMat, {
      position: [0, dimensions.wallY, dimensions.sideZ],
    });
    const left = createMesh(sideGeo, materials.wallMat, {
      position: [-dimensions.sideX, dimensions.wallY, 0],
    });
    const right = createMesh(sideGeo, materials.wallMat, {
      position: [dimensions.sideX, dimensions.wallY, 0],
    });

    const roofGeo = new THREE.BoxGeometry(
      C.HOUSE_WIDTH + C.HOUSE_ROOF_OVERHANG,
      C.HOUSE_ROOF_THICKNESS,
      C.HOUSE_DEPTH + C.HOUSE_ROOF_OVERHANG
    );
    addToDispose(roofGeo);
    const roof = createMesh(roofGeo, materials.roofMat, {
      position: [0, C.HOUSE_WALL_HEIGHT + C.HOUSE_ROOF_THICKNESS / 2, 0],
      cloneMaterial: false,
    });

    addToHouse(frontLeft, frontRight, back, left, right, roof);
  };

  const buildStep = () => {
    const stepGeo = new THREE.BoxGeometry(
      C.HOUSE_STEP_WIDTH,
      C.HOUSE_STEP_HEIGHT,
      C.HOUSE_STEP_DEPTH
    );
    addToDispose(stepGeo);
    const step = createMesh(stepGeo, materials.trimMat, {
      position: [
        C.HOUSE_STEP_LOCAL_X,
        C.HOUSE_STEP_HEIGHT / 2,
        C.HOUSE_STEP_LOCAL_Z,
      ],
    });
    addToHouse(step);
  };

  const buildWindows = () => {
    const winGeo = new THREE.BoxGeometry(
      C.WINDOW_WIDTH,
      C.WINDOW_HEIGHT,
      C.WINDOW_THICKNESS
    );
    addToDispose(winGeo);
    const windowY = C.WINDOW_SILL_Y + C.WINDOW_HEIGHT / 2;
    const leftWin = createMesh(winGeo, materials.glassMat, {
      position: [
        -dimensions.sideX + C.HOUSE_WALL_THICKNESS / 2 + tuning.windowInset,
        windowY,
        0,
      ],
      rotation: [0, Math.PI / 2, 0],
    });
    const rightWin = createMesh(winGeo, materials.glassMat, {
      position: [
        dimensions.sideX - C.HOUSE_WALL_THICKNESS / 2 - tuning.windowInset,
        windowY,
        0,
      ],
      rotation: [0, Math.PI / 2, 0],
    });
    const backWin = createMesh(winGeo, materials.glassMat, {
      position: [
        0,
        windowY,
        dimensions.sideZ - C.HOUSE_WALL_THICKNESS / 2 - tuning.windowInset,
      ],
    });
    addToHouse(leftWin, rightWin, backWin);
  };

  const buildTableAndChairs = () => {
    const tableGroup = new THREE.Group();
    const tableTopGeo = new THREE.BoxGeometry(
      C.TABLE_TOP_WIDTH,
      C.TABLE_TOP_THICKNESS,
      C.TABLE_TOP_DEPTH
    );
    const tableLegGeo = new THREE.BoxGeometry(
      C.TABLE_LEG_THICKNESS,
      C.TABLE_HEIGHT,
      C.TABLE_LEG_THICKNESS
    );
    addToDispose(tableTopGeo);
    addToDispose(tableLegGeo);
    const tableMat = new THREE.MeshStandardMaterial({
      color: C.TABLE_COLOR,
      roughness: tuning.tableRoughness,
    });
    addToDispose(tableMat);
    const tableTop = createMesh(tableTopGeo, tableMat, {
      position: [0, C.TABLE_HEIGHT + C.TABLE_TOP_THICKNESS / 2, 0],
      cloneMaterial: false,
    });
    tableGroup.add(tableTop);
    const legOffsetX = C.TABLE_TOP_WIDTH / 2 - C.TABLE_LEG_THICKNESS / 2;
    const legOffsetZ = C.TABLE_TOP_DEPTH / 2 - C.TABLE_LEG_THICKNESS / 2;
    const legPositions: [number, number][] = [
      [-legOffsetX, -legOffsetZ],
      [legOffsetX, -legOffsetZ],
      [-legOffsetX, legOffsetZ],
      [legOffsetX, legOffsetZ],
    ];
    for (const [localX, localZ] of legPositions) {
      const leg = createMesh(tableLegGeo, tableMat, {
        position: [localX, C.TABLE_HEIGHT / 2, localZ],
      });
      tableGroup.add(leg);
    }
    tableGroup.position.set(0, 0, C.HOUSE_DEPTH * tuning.tableZOffsetRatio);
    house.add(tableGroup);

    const chairGroupA = new THREE.Group();
    const chairGroupB = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(
      C.CHAIR_SEAT_WIDTH,
      C.CHAIR_SEAT_THICKNESS,
      C.CHAIR_SEAT_DEPTH
    );
    const chairLegGeo = new THREE.BoxGeometry(
      C.CHAIR_LEG_THICKNESS,
      C.CHAIR_SEAT_HEIGHT,
      C.CHAIR_LEG_THICKNESS
    );
    const chairBackGeo = new THREE.BoxGeometry(
      C.CHAIR_SEAT_WIDTH,
      C.CHAIR_BACK_HEIGHT,
      C.CHAIR_LEG_THICKNESS
    );
    addToDispose(seatGeo);
    addToDispose(chairLegGeo);
    addToDispose(chairBackGeo);
    const chairMat = new THREE.MeshStandardMaterial({
      color: C.CHAIR_COLOR,
      roughness: tuning.chairRoughness,
    });
    addToDispose(chairMat);
    const buildChair = (target: THREE.Group) => {
      const seat = createMesh(seatGeo, chairMat, {
        position: [0, C.CHAIR_SEAT_HEIGHT + C.CHAIR_SEAT_THICKNESS / 2, 0],
      });
      target.add(seat);
      const legOffX = C.CHAIR_SEAT_WIDTH / 2 - C.CHAIR_LEG_THICKNESS / 2;
      const legOffZ = C.CHAIR_SEAT_DEPTH / 2 - C.CHAIR_LEG_THICKNESS / 2;
      const legs: [number, number][] = [
        [-legOffX, -legOffZ],
        [legOffX, -legOffZ],
        [-legOffX, legOffZ],
        [legOffX, legOffZ],
      ];
      for (const [localX, localZ] of legs) {
        const leg = createMesh(chairLegGeo, chairMat, {
          position: [localX, C.CHAIR_SEAT_HEIGHT / 2, localZ],
        });
        target.add(leg);
      }
      const back = createMesh(chairBackGeo, chairMat, {
        position: [
          0,
          C.CHAIR_SEAT_HEIGHT + C.CHAIR_BACK_HEIGHT / 2,
          -C.CHAIR_SEAT_DEPTH / 2 + C.CHAIR_LEG_THICKNESS / 2,
        ],
      });
      target.add(back);
    };
    buildChair(chairGroupA);
    buildChair(chairGroupB);
    chairGroupA.position.set(
      0,
      0,
      tableGroup.position.z - (C.TABLE_TOP_DEPTH / 2 + tuning.chairTableGap)
    );
    chairGroupB.position.set(
      0,
      0,
      tableGroup.position.z + (C.TABLE_TOP_DEPTH / 2 + tuning.chairTableGap)
    );
    chairGroupA.rotation.y = 0;
    chairGroupB.rotation.y = Math.PI;
    house.add(chairGroupA, chairGroupB);

    return { tableGroup, chairGroupA, chairGroupB };
  };

  const buildBookshelf = () => {
    const shelfGroup = new THREE.Group();
    const shelfSideGeo = new THREE.BoxGeometry(
      C.BOOKSHELF_THICKNESS,
      C.BOOKSHELF_HEIGHT,
      C.BOOKSHELF_DEPTH
    );
    const shelfBackGeo = new THREE.BoxGeometry(
      C.BOOKSHELF_WIDTH,
      C.BOOKSHELF_HEIGHT,
      C.BOOKSHELF_THICKNESS
    );
    const shelfBoardGeo = new THREE.BoxGeometry(
      C.BOOKSHELF_WIDTH - C.BOOKSHELF_THICKNESS * 2,
      C.BOOKSHELF_THICKNESS,
      C.BOOKSHELF_DEPTH - C.BOOKSHELF_THICKNESS
    );
    addToDispose(shelfSideGeo);
    addToDispose(shelfBackGeo);
    addToDispose(shelfBoardGeo);
    const shelfMat = new THREE.MeshStandardMaterial({
      color: C.BOOKSHELF_COLOR,
      roughness: tuning.shelfRoughness,
    });
    addToDispose(shelfMat);
    const shelfLeft = createMesh(shelfSideGeo, shelfMat, {
      position: [
        -C.BOOKSHELF_WIDTH / 2 + C.BOOKSHELF_THICKNESS / 2,
        C.BOOKSHELF_HEIGHT / 2,
        0,
      ],
    });
    const shelfRight = createMesh(shelfSideGeo, shelfMat, {
      position: [
        C.BOOKSHELF_WIDTH / 2 - C.BOOKSHELF_THICKNESS / 2,
        C.BOOKSHELF_HEIGHT / 2,
        0,
      ],
    });
    const shelfBack = createMesh(shelfBackGeo, shelfMat, {
      position: [
        0,
        C.BOOKSHELF_HEIGHT / 2,
        -C.BOOKSHELF_DEPTH / 2 + C.BOOKSHELF_THICKNESS / 2,
      ],
    });
    shelfGroup.add(shelfLeft, shelfRight, shelfBack);
    const boardCount = Math.max(
      tuning.minShelfBoardCount,
      C.BOOKSHELF_SHELF_COUNT
    );
    for (let i = 0; i < boardCount; i += 1) {
      const t = i / (boardCount - 1);
      const y =
        C.BOOKSHELF_THICKNESS / 2 +
        t * (C.BOOKSHELF_HEIGHT - C.BOOKSHELF_THICKNESS);
      const board = createMesh(shelfBoardGeo, shelfMat, {
        position: [0, y, -C.BOOKSHELF_THICKNESS / 2],
      });
      shelfGroup.add(board);
    }
    shelfGroup.position.set(
      C.HOUSE_WIDTH * tuning.bookshelfXOffsetRatio,
      0,
      C.HOUSE_DEPTH * tuning.bookshelfZOffsetRatio
    );
    house.add(shelfGroup);
    return shelfGroup;
  };

  const buildBed = () => {
    const bedGroup = new THREE.Group();
    const bedFrameGeo = new THREE.BoxGeometry(
      C.BED_WIDTH,
      C.BED_FRAME_HEIGHT,
      C.BED_LENGTH
    );
    const mattressGeo = new THREE.BoxGeometry(
      C.BED_WIDTH * tuning.bedFrameScale,
      C.MATTRESS_THICKNESS,
      C.BED_LENGTH * tuning.bedFrameScale
    );
    const pillowGeo = new THREE.BoxGeometry(
      C.PILLOW_WIDTH,
      C.PILLOW_HEIGHT,
      C.PILLOW_DEPTH
    );
    addToDispose(bedFrameGeo);
    addToDispose(mattressGeo);
    addToDispose(pillowGeo);
    const bedFrameMat = new THREE.MeshStandardMaterial({
      color: C.BED_FRAME_COLOR,
      roughness: tuning.bedFrameRoughness,
    });
    const mattressMat = new THREE.MeshStandardMaterial({
      color: C.MATTRESS_COLOR,
      roughness: tuning.mattressRoughness,
    });
    const pillowMat = new THREE.MeshStandardMaterial({
      color: C.PILLOW_COLOR,
      roughness: tuning.pillowRoughness,
    });
    addToDispose(bedFrameMat);
    addToDispose(mattressMat);
    addToDispose(pillowMat);
    const bedFrame = createMesh(bedFrameGeo, bedFrameMat, {
      position: [0, C.BED_FRAME_HEIGHT / 2, 0],
      cloneMaterial: false,
    });
    const mattress = createMesh(mattressGeo, mattressMat, {
      position: [0, C.BED_FRAME_HEIGHT + C.MATTRESS_THICKNESS / 2, 0],
      cloneMaterial: false,
    });
    const pillow = createMesh(pillowGeo, pillowMat, {
      position: [
        0,
        C.BED_FRAME_HEIGHT + C.MATTRESS_THICKNESS + C.PILLOW_HEIGHT / 2,
        -C.BED_LENGTH * tuning.pillowZOffsetRatio,
      ],
      cloneMaterial: false,
    });
    bedGroup.add(bedFrame, mattress, pillow);
    bedGroup.position.set(
      -C.HOUSE_WIDTH * tuning.bedXOffsetRatio,
      0,
      -C.HOUSE_DEPTH * tuning.bedZOffsetRatio
    );
    house.add(bedGroup);
    return bedGroup;
  };

  const buildLamp = () => {
    const lampGroup = new THREE.Group();
    const lampGeo = new THREE.CylinderGeometry(
      tuning.lampRadiusTop,
      tuning.lampRadiusBottom,
      tuning.lampHeight,
      tuning.lampRadialSegments
    );
    addToDispose(lampGeo);
    const lampMat = new THREE.MeshStandardMaterial({
      color: tuning.lampColor,
      roughness: tuning.lampRoughness,
      metalness: tuning.lampMetalness,
    });
    addToDispose(lampMat);
    const lampMesh = createMesh(lampGeo, lampMat, {
      position: [0, C.HOUSE_WALL_HEIGHT - tuning.lampClearanceY, 0],
      cloneMaterial: false,
    });
    lampGroup.add(lampMesh);
    const light = new THREE.PointLight(
      tuning.lightColor,
      tuning.lightIntensity,
      Math.max(C.HOUSE_WIDTH, C.HOUSE_DEPTH)
    );
    light.position.copy(lampMesh.position);
    lampGroup.add(light);
    house.add(lampGroup);
  };

  const buildMirror = () => {
    const mirrorGeo = new THREE.PlaneGeometry(C.MIRROR_WIDTH, C.MIRROR_HEIGHT);
    addToDispose(mirrorGeo);
    const mirror = new Reflector(mirrorGeo, {
      clipBias: tuning.mirrorClipBias,
      textureWidth: C.MIRROR_TEXTURE_SIZE,
      textureHeight: C.MIRROR_TEXTURE_SIZE,
      color: C.MIRROR_COLOR,
    });
    (mirror.material as THREE.Material).side = THREE.DoubleSide;
    (mirror.material as THREE.Material).needsUpdate = true;
    mirror.position.set(
      -dimensions.sideX + C.HOUSE_WALL_THICKNESS / 2 + C.MIRROR_INSET,
      C.MIRROR_Y,
      -C.HOUSE_DEPTH * tuning.mirrorZOffsetRatio
    );
    mirror.rotation.y = Math.PI / 2;
    addToDispose(mirror as unknown as THREE.Object3D);
    const origBefore = mirror.onBeforeRender;
    mirror.onBeforeRender = function (
      renderer: THREE.WebGLRenderer,
      sceneRef: THREE.Scene,
      cam: THREE.Camera,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      group: THREE.Group
    ) {
      const origMask = (cam as THREE.Camera & { layers: THREE.Layers }).layers
        .mask;
      (cam as THREE.Camera & { layers: THREE.Layers }).layers.enable(
        C.PLAYER_LAYER
      );
      if ((this as unknown as { camera?: THREE.Camera }).camera?.layers) {
        (this as unknown as { camera: THREE.Camera }).camera.layers.enable(
          C.PLAYER_LAYER
        );
      }
      try {
        origBefore?.call(this, renderer, sceneRef, cam, geometry, material, group);
      } finally {
        (cam as THREE.Camera & { layers: THREE.Layers }).layers.mask = origMask;
      }
    };
    house.add(mirror);
  };

  const buildDoor = () => {
    const doorHinge = new THREE.Group();
    const doorGeo = new THREE.BoxGeometry(
      C.HOUSE_DOOR_WIDTH,
      C.HOUSE_DOOR_HEIGHT,
      C.HOUSE_DOOR_THICKNESS
    );
    addToDispose(doorGeo);
    const door = createMesh(doorGeo, materials.trimMat, {
      position: [C.HOUSE_DOOR_WIDTH / 2, C.HOUSE_DOOR_HEIGHT / 2, 0],
    });
    doorHinge.add(door);
    doorHinge.position.set(-C.HOUSE_DOOR_WIDTH / 2, 0, dimensions.frontZ);
    house.add(doorHinge);
    return { doorHinge, door };
  };

  const buildColliders = (
    tableGroup: THREE.Group,
    chairGroupA: THREE.Group,
    chairGroupB: THREE.Group,
    shelfGroup: THREE.Group,
    bedGroup: THREE.Group
  ) => {
    const worldColliders: Collider[] = [];
    const spacing = C.HOUSE_WALL_COLLIDER_SPACING;
    const rad = C.HOUSE_WALL_COLLIDER_RADIUS;
    const wallBlockMaxY = C.HOUSE_WALL_HEIGHT + tuning.wallBlockMaxYPad;

    const pushCol = (localX: number, localZ: number) => {
      worldColliders.push({
        x: localX + house.position.x,
        z: localZ + house.position.z,
        r: rad,
        maxBlockY: wallBlockMaxY,
      });
    };

    const pushFurnCol = (localX: number, localZ: number, r: number) => {
      worldColliders.push({
        x: localX + house.position.x,
        z: localZ + house.position.z,
        r,
      });
    };

    const frontLeftStart = -C.HOUSE_WIDTH / 2;
    const frontLeftEnd = -C.HOUSE_DOOR_WIDTH / 2 - spacing * 0.5;
    for (let x = frontLeftStart; x <= frontLeftEnd; x += spacing)
      pushCol(x, dimensions.frontZ);
    const frontRightStart = C.HOUSE_DOOR_WIDTH / 2 + spacing * 0.5;
    const frontRightEnd = C.HOUSE_WIDTH / 2;
    for (let x = frontRightStart; x <= frontRightEnd; x += spacing)
      pushCol(x, dimensions.frontZ);
    for (let x = -C.HOUSE_WIDTH / 2; x <= C.HOUSE_WIDTH / 2; x += spacing)
      pushCol(x, dimensions.sideZ);
    for (let z = -C.HOUSE_DEPTH / 2; z <= C.HOUSE_DEPTH / 2; z += spacing) {
      pushCol(-dimensions.sideX, z);
    }
    for (let z = -C.HOUSE_DEPTH / 2; z <= C.HOUSE_DEPTH / 2; z += spacing) {
      pushCol(dimensions.sideX, z);
    }

    pushFurnCol(
      tableGroup.position.x,
      tableGroup.position.z,
      C.TABLE_COLLIDER_RADIUS
    );
    pushFurnCol(
      chairGroupA.position.x,
      chairGroupA.position.z,
      C.CHAIR_COLLIDER_RADIUS
    );
    pushFurnCol(
      chairGroupB.position.x,
      chairGroupB.position.z,
      C.CHAIR_COLLIDER_RADIUS
    );
    pushFurnCol(
      shelfGroup.position.x,
      shelfGroup.position.z,
      C.BOOKSHELF_COLLIDER_RADIUS
    );
    pushFurnCol(
      bedGroup.position.x,
      bedGroup.position.z,
      C.BED_COLLIDER_RADIUS
    );

    const doorCollider: Collider = {
      x: house.position.x,
      z: house.position.z + dimensions.frontZ,
      r: C.HOUSE_DOOR_COLLIDER_RADIUS,
    };

    return { worldColliders, doorCollider };
  };

  buildWallsAndRoof();
  buildStep();
  buildWindows();
  const { tableGroup, chairGroupA, chairGroupB } = buildTableAndChairs();
  const shelfGroup = buildBookshelf();
  const bedGroup = buildBed();
  buildLamp();
  buildMirror();
  const { doorHinge, door } = buildDoor();

  scene.add(house);

  const { worldColliders, doorCollider } = buildColliders(
    tableGroup,
    chairGroupA,
    chairGroupB,
    shelfGroup,
    bedGroup
  );

  return {
    group: house,
    doorHinge,
    doorMesh: door,
    doorCollider,
    wallColliders: worldColliders,
  };
}
