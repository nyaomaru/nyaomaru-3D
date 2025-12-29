import * as THREE from 'three';
import type { Collider } from '../types';
import * as C from '../constants';

type DoorControl = {
  hinge: THREE.Group;
  collider: Collider;
  openAngleMagnitude: number;
  closedRotation: number;
  interactRadius: number;
};

export type PoliceStationBuild = {
  group: THREE.Group;
  colliders: Collider[];
  doors: DoorControl[];
  bearAnchors?: Array<{ anchor: THREE.Object3D; message: string }>;
  bearInteractRadius?: number;
};

type AddToDispose = (
  obj: THREE.Object3D | THREE.Material | THREE.BufferGeometry | THREE.Texture
) => void;

type MeshOptions = {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  cloneMaterial?: boolean;
};

const FLOOR_LEVEL = {
  LEVEL_0: 0, // 1F (ground)
  LEVEL_1: 1, // 2F
  LEVEL_2: 2, // 3F
} as const;

const SIGN_CONFIG = {
  canvasWidth: 512,
  canvasHeight: 128,
  backgroundColor: '#2b241b',
  textColor: '#f6e9d0',
  titleFont: 'bold 48px serif',
  subtitleFont: 'bold 36px serif',
  titleY: 0.45,
  subtitleY: 0.78,
  titleText: 'FANTASY GUARD',
  subtitleText: 'WATCH HOUSE',
  positionYOffset: 0.4,
  positionZOffset: 0.05,
};

const MATERIAL_CONFIG = {
  wallRoughness: 0.85,
  floorRoughness: 0.9,
  glassRoughness: 0.1,
  glassMetalness: 0.0,
  glassOpacity: 0.35,
  metalRoughness: 0.4,
  metalMetalness: 0.6,
  woodColor: 0x6f4c2a,
  woodRoughness: 0.8,
  darkWoodColor: 0x4b3f33,
  darkWoodRoughness: 0.85,
  stoneColor: 0x5b5b5b,
  stoneRoughness: 0.95,
  fabricColor: 0x6a5744,
  fabricRoughness: 0.9,
  bearFurColor: 0x5a3b24,
  bearFurRoughness: 0.9,
  bearMuzzleColor: 0xc9b296,
  bearMuzzleRoughness: 0.85,
  bearNoseColor: 0x2f2117,
  bearNoseRoughness: 0.7,
};

const LIGHT_CONFIG = {
  yOffset: -0.6,
  intensity: 0.9,
  distance: 16,
  positions: [
    [0, -6],
    [0, 6],
    [-10, 0],
    [10, 0],
  ] as const,
  bulbRadius: 0.2,
  bulbSegments: 10,
  bulbEmissiveIntensity: 1.2,
};

const PARTITION_CONFIG = {
  heightOffset: 0.4,
  thicknessScale: 0.8,
  stairGapExtraWidth: 2.4,
  lineXLeft: -5,
  lineXRight: 5,
  lineZStart: -12,
  lineZEnd: 12,
  corridorEdgeInset: 1,
  corridorLeftEndX: -6,
  corridorRightStartX: 6,
  floor0: {
    doorCentersLeft: [-8, 6],
    doorCentersRight: [-8, 0],
    lineZNeg: -2,
    lineZStairNeg: -4,
    lineZStairPos: 2,
  },
  floor1: {
    doorCentersLeft: [-9, -4],
    doorCentersRight: [-8, 4],
    lineZPos: 2,
    lineZNeg: -2,
    extraDoorCenterLeftX: -8.5,
    extraDoorCenterRightX: 12,
  },
  floor2: {
    doorCentersLeft: [2],
    doorCentersRight: [-2],
    lineZMid: 0,
    lineZStair: 4,
  },
} as const;

const BENCH_CONFIG = {
  seatSize: [2.6, 0.3, 0.8] as const,
  seatYOffset: 0.15,
  backSize: [2.6, 0.4, 0.2] as const,
  backYOffset: 0.5,
  backZOffset: -0.3,
};

const BAR_CONFIG = {
  barSize: 0.12,
  capHeight: 0.12,
  capDepth: 0.2,
};

const FURNITURE_CONFIG = {
  ground: {
    receptionDesk: { size: [7, 1.2, 2.4], position: [0, 0.6, -10.5] },
    backCounter: { size: [2.4, 1.4, 0.6], position: [0, 0.7, -12.6] },
    receptionRug: { size: [8, 0.08, 3.2], position: [0, 0.04, -10.2] },
    lobbyBenchLeft: { position: [-6, 0, -9.6] },
    lobbyBenchRight: { position: [6, 0, -9.6] },
    lockerA: { size: [1.2, 2.2, 0.6], position: [-8, 1.1, -12] },
    lockerB: { size: [1.2, 2.2, 0.6], position: [-9.6, 1.1, -12] },
    noticeBoard: { size: [2.2, 1.4, 0.2], position: [3.8, 0.7, -12.4] },
    jailBunkA: { size: [2.2, 0.6, 4.2], position: [-14, 0.3, -9] },
    jailBunkB: { size: [2.2, 0.6, 4.2], position: [-14, 0.3, -5] },
    cellBarsA: {
      centerX: -12.2,
      centerZ: -7,
      width: 2.8,
      height: 3.0,
      count: 6,
      baseY: 0.0,
    },
    cellBarsB: {
      centerX: -12.2,
      centerZ: -3,
      width: 2.8,
      height: 3.0,
      count: 6,
      baseY: 0.0,
    },
    toiletBlock: { size: [0.8, 0.8, 0.8], position: [-16, 0.4, -7] },
    toiletSeat: { size: [0.8, 0.6, 0.6], position: [-16, 0.3, -3] },
    interrogationTable: { size: [3.6, 0.8, 2.2], position: [12, 0.4, -9] },
    interrogationChairA: { size: [1.1, 0.7, 1.1], position: [14.2, 0.35, -9] },
    interrogationChairB: { size: [1.1, 0.7, 1.1], position: [9.8, 0.35, -9] },
    mirrorWall: { size: [2.4, 1.6, 0.4], position: [12, 0.8, -11.2] },
    interrogationRug: { size: [2.6, 0.08, 2.6], position: [12, 0.04, -8.8] },
    toiletBlockAlt: { size: [1.2, 1.0, 1.2], position: [12, 0.5, -2] },
    sink: { size: [1.4, 0.8, 0.6], position: [13.4, 0.4, -2.4] },
    morgueTable: { size: [5.4, 0.8, 2.8], position: [-13, 0.4, 8] },
    cabinet: { size: [3, 1.2, 1.2], position: [-9, 0.6, 10] },
    medicalLocker: { size: [1.2, 2.0, 0.6], position: [-16, 1.0, 10.5] },
  },
  second: {
    officeDeskA: { size: [4.2, 0.8, 2.2], position: [-12, 0.4, -6] },
    officeDeskB: { size: [4.2, 0.8, 2.2], position: [-12, 0.4, -1] },
    officeChairA: { size: [1.1, 0.7, 1.1], position: [-10, 0.35, -6] },
    officeChairB: { size: [1.1, 0.7, 1.1], position: [-10, 0.35, -1] },
    filingCabinetA: { size: [1.6, 1.8, 0.6], position: [-15, 0.9, -8] },
    filingCabinetB: { size: [1.6, 1.8, 0.6], position: [-15, 0.9, -5] },
    officeShelves: { size: [3.2, 1.6, 0.6], position: [-8, 0.8, -9.5] },
    officeRug: { size: [6.8, 0.08, 4.2], position: [-11, 0.04, -4] },
    breakTable: { size: [4.2, 0.8, 2.4], position: [12, 0.4, 5] },
    sofaA: { size: [2.6, 0.9, 1.2], position: [10, 0.45, 8] },
    sofaB: { size: [2.6, 0.9, 1.2], position: [14, 0.45, 8] },
    fridge: { size: [1.2, 2.2, 1.0], position: [8.4, 1.1, 10] },
    counter: { size: [2.4, 0.9, 0.8], position: [11.8, 0.45, 10] },
    lockers: { size: [2.4, 2.0, 0.6], position: [15.2, 1.0, 10] },
    breakRug: { size: [4.8, 0.08, 3.4], position: [12, 0.04, 7.2] },
    columnA: {
      radiusTop: 0.35,
      radiusBottom: 0.35,
      height: 2.2,
      position: [6.6, 1.1, 2],
    },
    columnB: {
      radiusTop: 0.35,
      radiusBottom: 0.35,
      height: 2.2,
      position: [17.2, 1.1, 2],
    },
  },
  third: {
    armoryRackA: { size: [5.2, 2.2, 1.2], position: [12, 1.1, -5] },
    armoryRackB: { size: [5.2, 2.2, 1.2], position: [12, 1.1, -1] },
    workbench: { size: [4, 0.8, 2.0], position: [10, 0.4, -9] },
    ammoLocker: { size: [1.6, 1.6, 0.6], position: [14.8, 0.8, -9] },
    armoryRug: { size: [3.6, 0.08, 3.2], position: [12, 0.04, -6] },
    weaponRackA: { size: [0.3, 1.8, 2.6], position: [8.4, 0.9, -9] },
    weaponRackB: { size: [0.3, 1.8, 2.6], position: [9.6, 0.9, -9] },
    evidenceShelvesA: { size: [3.4, 2.2, 1.2], position: [-12, 1.1, 3] },
    evidenceShelvesB: { size: [3.4, 2.2, 1.2], position: [-15.6, 1.1, 6] },
    evidenceTable: { size: [2.4, 1.0, 1.6], position: [-10, 0.5, 8] },
    lockbox: { size: [1.0, 1.0, 1.0], position: [-12.8, 0.5, 8.8] },
    evidenceRug: { size: [4.6, 0.08, 3.6], position: [-12, 0.04, 6] },
  },
} as const;

const BEAR_CONFIG = {
  interactRadius: 5.0,
  body: {
    radius: 0.8,
    widthSegments: 14,
    heightSegments: 12,
    position: [0, 0.8, 0],
  },
  head: {
    radius: 0.5,
    widthSegments: 12,
    heightSegments: 10,
    position: [0, 1.5, 0.15],
  },
  ear: {
    radius: 0.18,
    widthSegments: 10,
    heightSegments: 8,
    leftPosition: [-0.28, 1.9, 0.08],
    rightPosition: [0.28, 1.9, 0.08],
  },
  muzzle: {
    radius: 0.22,
    widthSegments: 10,
    heightSegments: 8,
    position: [0, 1.38, 0.55],
  },
  nose: { position: [0, 1.42, 0.68] },
  leg: {
    radiusTop: 0.18,
    radiusBottom: 0.22,
    height: 0.5,
    radialSegments: 10,
    positions: [
      [-0.35, -0.25],
      [0.35, -0.25],
      [-0.35, 0.35],
      [0.35, 0.35],
    ],
    y: 0.25,
  },
  talkAnchorPosition: [0, 2.05, 0.15],
} as const;

const BEAR_POSITIONS = {
  chief: { floor: FLOOR_LEVEL.LEVEL_2, x: -12, z: -10, message: "I'm chief" },
  lobby: { floor: FLOOR_LEVEL.LEVEL_0, x: 3.5, z: -8.8, message: 'Hello' },
  jail: { floor: FLOOR_LEVEL.LEVEL_0, x: -15, z: -10, message: 'arrested' },
} as const;

const DOOR_LAYOUT = {
  ground: [
    {
      centerX: 0,
      centerZ: 'front',
      rotationY: Math.PI,
      hingeSide: 'left' as const,
    },
    {
      centerX: -5,
      centerZ: -8,
      rotationY: Math.PI / 2,
      hingeSide: 'left' as const,
    },
    {
      centerX: -5,
      centerZ: 6,
      rotationY: Math.PI / 2,
      hingeSide: 'left' as const,
    },
    {
      centerX: 5,
      centerZ: -8,
      rotationY: -Math.PI / 2,
      hingeSide: 'right' as const,
    },
    {
      centerX: 5,
      centerZ: 0,
      rotationY: -Math.PI / 2,
      hingeSide: 'right' as const,
    },
  ],
  second: [
    {
      centerX: -5,
      centerZ: -4,
      rotationY: Math.PI / 2,
      hingeSide: 'left' as const,
    },
    {
      centerX: PARTITION_CONFIG.floor1.extraDoorCenterLeftX,
      centerZ: PARTITION_CONFIG.floor1.lineZPos,
      rotationY: 0,
      hingeSide: 'left' as const,
    },
    {
      centerX: 5,
      centerZ: -8,
      rotationY: -Math.PI / 2,
      hingeSide: 'right' as const,
    },
    {
      centerX: PARTITION_CONFIG.floor1.extraDoorCenterRightX,
      centerZ: PARTITION_CONFIG.floor1.lineZNeg,
      rotationY: 0,
      hingeSide: 'left' as const,
    },
    {
      centerX: 5,
      centerZ: 4,
      rotationY: -Math.PI / 2,
      hingeSide: 'right' as const,
    },
  ],
  third: [
    {
      centerX: -5,
      centerZ: 2,
      rotationY: Math.PI / 2,
      hingeSide: 'left' as const,
    },
    {
      centerX: 5,
      centerZ: -2,
      rotationY: -Math.PI / 2,
      hingeSide: 'right' as const,
    },
  ],
} as const;

export function usePoliceStation(
  scene: THREE.Scene,
  addToDispose: AddToDispose
): PoliceStationBuild {
  const station = new THREE.Group();
  station.position.set(
    C.POLICE_STATION_POSITION.x,
    0,
    C.POLICE_STATION_POSITION.z
  );

  const addToStation = (...objects: THREE.Object3D[]) => {
    station.add(...objects);
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

  const materials = (() => {
    const mats = {
      wallMat: new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_WALL_COLOR,
        roughness: MATERIAL_CONFIG.wallRoughness,
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_TRIM_COLOR,
      }),
      floorMat: new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_FLOOR_COLOR,
        roughness: MATERIAL_CONFIG.floorRoughness,
      }),
      glassMat: new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_GLASS_COLOR,
        roughness: MATERIAL_CONFIG.glassRoughness,
        metalness: MATERIAL_CONFIG.glassMetalness,
        transparent: true,
        opacity: MATERIAL_CONFIG.glassOpacity,
        side: THREE.DoubleSide,
      }),
      metalMat: new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_METAL_COLOR,
        roughness: MATERIAL_CONFIG.metalRoughness,
        metalness: MATERIAL_CONFIG.metalMetalness,
      }),
    };
    addToDispose(mats.wallMat);
    addToDispose(mats.trimMat);
    addToDispose(mats.floorMat);
    addToDispose(mats.glassMat);
    addToDispose(mats.metalMat);
    return mats;
  })();

  const createSignMaterial = () => {
    const canvas = document.createElement('canvas');
    canvas.width = SIGN_CONFIG.canvasWidth;
    canvas.height = SIGN_CONFIG.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = SIGN_CONFIG.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = SIGN_CONFIG.textColor;
      ctx.font = SIGN_CONFIG.titleFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        SIGN_CONFIG.titleText,
        canvas.width / 2,
        canvas.height * SIGN_CONFIG.titleY
      );
      ctx.font = SIGN_CONFIG.subtitleFont;
      ctx.fillText(
        SIGN_CONFIG.subtitleText,
        canvas.width / 2,
        canvas.height * SIGN_CONFIG.subtitleY
      );
    }
    const texture = new THREE.CanvasTexture(canvas);
    addToDispose(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
    });
    addToDispose(mat);
    return mat;
  };

  const colliders: Collider[] = [];
  const doors: DoorControl[] = [];
  const bearAnchors: Array<{ anchor: THREE.Object3D; message: string }> = [];

  const halfW = C.POLICE_STATION_WIDTH / 2;
  const halfD = C.POLICE_STATION_DEPTH / 2;
  const wallThickness = C.POLICE_STATION_WALL_THICKNESS;
  const floorHeight = C.POLICE_STATION_FLOOR_HEIGHT;

  const addWallColliderLine = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    minY: number,
    maxY: number
  ) => {
    const spacing = C.POLICE_STATION_WALL_COLLIDER_SPACING;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.floor(len / spacing));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      colliders.push({
        x: station.position.x + x1 + (x2 - x1) * t,
        z: station.position.z + z1 + (z2 - z1) * t,
        r: C.POLICE_STATION_WALL_COLLIDER_RADIUS,
        minBlockY: minY,
        maxBlockY: maxY,
      });
    }
  };

  const addWallSegment = (
    width: number,
    height: number,
    depth: number,
    position: [number, number, number]
  ) => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    addToDispose(geo);
    const mesh = createMesh(geo, materials.wallMat, { position });
    addToStation(mesh);
  };

  const addGlassBand = (
    width: number,
    height: number,
    depth: number,
    position: [number, number, number]
  ) => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    addToDispose(geo);
    const mesh = createMesh(geo, materials.glassMat, {
      position,
      cloneMaterial: false,
    });
    addToStation(mesh);
  };

  const addDoor = (options: {
    centerX: number;
    centerZ: number;
    baseY: number;
    rotationY: number;
    hingeSide: 'left' | 'right';
  }) => {
    const hinge = new THREE.Group();
    const hingeSign = options.hingeSide === 'left' ? -1 : 1;
    const halfW = C.POLICE_STATION_DOOR_WIDTH / 2;
    const offX = Math.cos(options.rotationY) * (hingeSign * halfW);
    const offZ = -Math.sin(options.rotationY) * (hingeSign * halfW);
    const hingeX = options.centerX + offX;
    const hingeZ = options.centerZ + offZ;
    hinge.position.set(hingeX, options.baseY, hingeZ);
    hinge.rotation.y = options.rotationY;
    const doorGeo = new THREE.BoxGeometry(
      C.POLICE_STATION_DOOR_WIDTH,
      C.POLICE_STATION_DOOR_HEIGHT,
      C.POLICE_STATION_DOOR_THICKNESS
    );
    addToDispose(doorGeo);
    const doorOffset = options.hingeSide === 'left' ? halfW : -halfW;
    const doorMesh = createMesh(doorGeo, materials.trimMat, {
      position: [doorOffset, C.POLICE_STATION_DOOR_HEIGHT / 2, 0],
    });
    hinge.add(doorMesh);
    addToStation(hinge);
    doors.push({
      hinge,
      collider: {
        x: station.position.x + options.centerX,
        z: station.position.z + options.centerZ,
        r: C.POLICE_STATION_DOOR_COLLIDER_RADIUS,
        minBlockY: options.baseY,
        maxBlockY: options.baseY + C.POLICE_STATION_DOOR_HEIGHT,
      },
      openAngleMagnitude: C.POLICE_STATION_DOOR_OPEN_ANGLE,
      closedRotation: options.rotationY,
      interactRadius: C.POLICE_STATION_DOOR_INTERACT_RADIUS,
    });
  };

  const buildFloors = () => {
    const floorGeo = new THREE.BoxGeometry(
      C.POLICE_STATION_WIDTH,
      C.POLICE_STATION_FLOOR_THICKNESS,
      C.POLICE_STATION_DEPTH
    );
    addToDispose(floorGeo);
    for (let i = 0; i < C.POLICE_STATION_FLOOR_COUNT; i += 1) {
      const y = i * floorHeight + C.POLICE_STATION_FLOOR_THICKNESS / 2;
      const floor = createMesh(floorGeo, materials.floorMat, {
        position: [0, y, 0],
        cloneMaterial: false,
      });
      addToStation(floor);
    }
    const roofGeo = new THREE.BoxGeometry(
      C.POLICE_STATION_WIDTH,
      C.POLICE_STATION_FLOOR_THICKNESS,
      C.POLICE_STATION_DEPTH
    );
    addToDispose(roofGeo);
    const roofY =
      C.POLICE_STATION_FLOOR_COUNT * floorHeight +
      C.POLICE_STATION_FLOOR_THICKNESS / 2;
    const roof = createMesh(roofGeo, materials.trimMat, {
      position: [0, roofY, 0],
      cloneMaterial: false,
    });
    addToStation(roof);
  };

  const buildOuterWalls = () => {
    const windowBottom = C.POLICE_STATION_WINDOW_SILL;
    const windowHeight = C.POLICE_STATION_WINDOW_HEIGHT;
    const windowInset = C.POLICE_STATION_WINDOW_INSET;
    const upperHeight = floorHeight - (windowBottom + windowHeight);
    const doorGap = C.POLICE_STATION_ENTRY_GAP;

    for (
      let floorIndex = 0;
      floorIndex < C.POLICE_STATION_FLOOR_COUNT;
      floorIndex += 1
    ) {
      const baseY = floorIndex * floorHeight;
      const lowerY = baseY + windowBottom / 2;
      const upperY = baseY + windowBottom + windowHeight + upperHeight / 2;
      const windowY = baseY + windowBottom + windowHeight / 2;

      if (floorIndex === FLOOR_LEVEL.LEVEL_0) {
        const leftWidth = (C.POLICE_STATION_WIDTH - doorGap) / 2;
        const rightWidth = leftWidth;
        addWallSegment(leftWidth, windowBottom, wallThickness, [
          -(doorGap / 2 + leftWidth / 2),
          lowerY,
          halfD - wallThickness / 2,
        ]);
        addWallSegment(rightWidth, windowBottom, wallThickness, [
          doorGap / 2 + rightWidth / 2,
          lowerY,
          halfD - wallThickness / 2,
        ]);
        addWallSegment(C.POLICE_STATION_WIDTH, windowBottom, wallThickness, [
          0,
          lowerY,
          -halfD + wallThickness / 2,
        ]);
      } else {
        addWallSegment(C.POLICE_STATION_WIDTH, windowBottom, wallThickness, [
          0,
          lowerY,
          -halfD + wallThickness / 2,
        ]);
      }

      if (upperHeight > 0) {
        addWallSegment(C.POLICE_STATION_WIDTH, upperHeight, wallThickness, [
          0,
          upperY,
          -halfD + wallThickness / 2,
        ]);
      }

      if (floorIndex > FLOOR_LEVEL.LEVEL_0) {
        addWallSegment(C.POLICE_STATION_WIDTH, windowBottom, wallThickness, [
          0,
          lowerY,
          halfD - wallThickness / 2,
        ]);
      }
      if (upperHeight > 0) {
        addWallSegment(C.POLICE_STATION_WIDTH, upperHeight, wallThickness, [
          0,
          upperY,
          halfD - wallThickness / 2,
        ]);
      }

      addWallSegment(wallThickness, windowBottom, C.POLICE_STATION_DEPTH, [
        -halfW + wallThickness / 2,
        lowerY,
        0,
      ]);
      addWallSegment(wallThickness, windowBottom, C.POLICE_STATION_DEPTH, [
        halfW - wallThickness / 2,
        lowerY,
        0,
      ]);

      if (upperHeight > 0) {
        addWallSegment(wallThickness, upperHeight, C.POLICE_STATION_DEPTH, [
          -halfW + wallThickness / 2,
          upperY,
          0,
        ]);
        addWallSegment(wallThickness, upperHeight, C.POLICE_STATION_DEPTH, [
          halfW - wallThickness / 2,
          upperY,
          0,
        ]);
      }

      if (floorIndex > FLOOR_LEVEL.LEVEL_0) {
        addGlassBand(
          C.POLICE_STATION_WIDTH - windowInset * 2,
          windowHeight,
          wallThickness * 0.5,
          [0, windowY, -halfD + wallThickness / 2 + windowInset]
        );
      }
      addGlassBand(
        C.POLICE_STATION_WIDTH - windowInset * 2,
        windowHeight,
        wallThickness * 0.5,
        [0, windowY, halfD - wallThickness / 2 - windowInset]
      );
      addGlassBand(
        wallThickness * 0.5,
        windowHeight,
        C.POLICE_STATION_DEPTH - windowInset * 2,
        [-halfW + wallThickness / 2 + windowInset, windowY, 0]
      );
      addGlassBand(
        wallThickness * 0.5,
        windowHeight,
        C.POLICE_STATION_DEPTH - windowInset * 2,
        [halfW - wallThickness / 2 - windowInset, windowY, 0]
      );
    }
  };

  const buildPerimeterColliders = () => {
    const doorGap = C.POLICE_STATION_ENTRY_GAP;
    for (
      let floorIndex = 0;
      floorIndex < C.POLICE_STATION_FLOOR_COUNT;
      floorIndex += 1
    ) {
      const minY = floorIndex * floorHeight;
      const maxY = minY + floorHeight;
      if (floorIndex === FLOOR_LEVEL.LEVEL_0) {
        addWallColliderLine(-halfW, -halfD, halfW, -halfD, minY, maxY);
        addWallColliderLine(-halfW, halfD, -doorGap / 2, halfD, minY, maxY);
        addWallColliderLine(doorGap / 2, halfD, halfW, halfD, minY, maxY);
      } else {
        addWallColliderLine(-halfW, -halfD, halfW, -halfD, minY, maxY);
      }
      if (floorIndex > FLOOR_LEVEL.LEVEL_0) {
        addWallColliderLine(-halfW, halfD, halfW, halfD, minY, maxY);
      }
      addWallColliderLine(-halfW, -halfD, -halfW, halfD, minY, maxY);
      addWallColliderLine(halfW, -halfD, halfW, halfD, minY, maxY);
    }
  };

  const buildPartitions = () => {
    const partitionHeight = floorHeight - PARTITION_CONFIG.heightOffset;
    const thickness = wallThickness * PARTITION_CONFIG.thicknessScale;
    const stairGap = {
      centerX: C.POLICE_STATION_STAIR_CENTER_X,
      width: C.POLICE_STATION_STAIR_WIDTH + PARTITION_CONFIG.stairGapExtraWidth,
    };

    const addPartitionLineX = (
      x: number,
      zStart: number,
      zEnd: number,
      baseY: number,
      gaps: { centerZ: number; width: number }[] = []
    ) => {
      const y = baseY + partitionHeight / 2;
      const segments: [number, number][] = [];
      let cursor = zStart;
      const sorted = [...gaps].sort((a, b) => a.centerZ - b.centerZ);
      for (const gap of sorted) {
        const gapStart = gap.centerZ - gap.width / 2;
        const gapEnd = gap.centerZ + gap.width / 2;
        if (gapStart > cursor) segments.push([cursor, gapStart]);
        cursor = Math.max(cursor, gapEnd);
      }
      if (cursor < zEnd) segments.push([cursor, zEnd]);
      for (const [segStart, segEnd] of segments) {
        const len = segEnd - segStart;
        const geo = new THREE.BoxGeometry(thickness, partitionHeight, len);
        addToDispose(geo);
        const mesh = createMesh(geo, materials.wallMat, {
          position: [x, y, (segStart + segEnd) / 2],
        });
        addToStation(mesh);
        addWallColliderLine(x, segStart, x, segEnd, baseY, baseY + floorHeight);
      }
    };

    const addPartitionLineZ = (
      z: number,
      xStart: number,
      xEnd: number,
      baseY: number,
      gaps: { centerX: number; width: number }[] = []
    ) => {
      const y = baseY + partitionHeight / 2;
      const segments: [number, number][] = [];
      let cursor = xStart;
      const sorted = [...gaps].sort((a, b) => a.centerX - b.centerX);
      for (const gap of sorted) {
        const gapStart = gap.centerX - gap.width / 2;
        const gapEnd = gap.centerX + gap.width / 2;
        if (gapStart > cursor) segments.push([cursor, gapStart]);
        cursor = Math.max(cursor, gapEnd);
      }
      if (cursor < xEnd) segments.push([cursor, xEnd]);
      for (const [segStart, segEnd] of segments) {
        const len = segEnd - segStart;
        const geo = new THREE.BoxGeometry(len, partitionHeight, thickness);
        addToDispose(geo);
        const mesh = createMesh(geo, materials.wallMat, {
          position: [(segStart + segEnd) / 2, y, z],
        });
        addToStation(mesh);
        addWallColliderLine(segStart, z, segEnd, z, baseY, baseY + floorHeight);
      }
    };

    const doorGap = C.POLICE_STATION_INTERIOR_DOOR_GAP;
    const floor0 = FLOOR_LEVEL.LEVEL_0 * floorHeight;
    addPartitionLineX(
      PARTITION_CONFIG.lineXLeft,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor0,
      [
        { centerZ: PARTITION_CONFIG.floor0.doorCentersLeft[0], width: doorGap },
        { centerZ: PARTITION_CONFIG.floor0.doorCentersLeft[1], width: doorGap },
      ]
    );
    addPartitionLineX(
      PARTITION_CONFIG.lineXRight,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor0,
      [
        {
          centerZ: PARTITION_CONFIG.floor0.doorCentersRight[0],
          width: doorGap,
        },
        {
          centerZ: PARTITION_CONFIG.floor0.doorCentersRight[1],
          width: doorGap,
        },
      ]
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor0.lineZNeg,
      -halfW + PARTITION_CONFIG.corridorEdgeInset,
      PARTITION_CONFIG.corridorLeftEndX,
      floor0
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor0.lineZStairNeg,
      PARTITION_CONFIG.corridorRightStartX,
      halfW - PARTITION_CONFIG.corridorEdgeInset,
      floor0,
      [stairGap]
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor0.lineZStairPos,
      PARTITION_CONFIG.corridorRightStartX,
      halfW - PARTITION_CONFIG.corridorEdgeInset,
      floor0,
      [stairGap]
    );

    const floor1 = FLOOR_LEVEL.LEVEL_1 * floorHeight;
    addPartitionLineX(
      PARTITION_CONFIG.lineXLeft,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor1,
      [
        { centerZ: PARTITION_CONFIG.floor1.doorCentersLeft[0], width: doorGap },
        { centerZ: PARTITION_CONFIG.floor1.doorCentersLeft[1], width: doorGap },
      ]
    );
    addPartitionLineX(
      PARTITION_CONFIG.lineXRight,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor1,
      [
        {
          centerZ: PARTITION_CONFIG.floor1.doorCentersRight[0],
          width: doorGap,
        },
        {
          centerZ: PARTITION_CONFIG.floor1.doorCentersRight[1],
          width: doorGap,
        },
      ]
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor1.lineZPos,
      -halfW + PARTITION_CONFIG.corridorEdgeInset,
      PARTITION_CONFIG.corridorLeftEndX,
      floor1,
      [
        {
          centerX: PARTITION_CONFIG.floor1.extraDoorCenterLeftX,
          width: doorGap,
        },
      ]
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor1.lineZNeg,
      PARTITION_CONFIG.corridorRightStartX,
      halfW - PARTITION_CONFIG.corridorEdgeInset,
      floor1,
      [
        stairGap,
        {
          centerX: PARTITION_CONFIG.floor1.extraDoorCenterRightX,
          width: doorGap,
        },
      ]
    );

    const floor2 = FLOOR_LEVEL.LEVEL_2 * floorHeight;
    addPartitionLineX(
      PARTITION_CONFIG.lineXLeft,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor2,
      [{ centerZ: PARTITION_CONFIG.floor2.doorCentersLeft[0], width: doorGap }]
    );
    addPartitionLineX(
      PARTITION_CONFIG.lineXRight,
      PARTITION_CONFIG.lineZStart,
      PARTITION_CONFIG.lineZEnd,
      floor2,
      [{ centerZ: PARTITION_CONFIG.floor2.doorCentersRight[0], width: doorGap }]
    );
    addPartitionLineZ(
      PARTITION_CONFIG.floor2.lineZStair,
      PARTITION_CONFIG.corridorRightStartX,
      halfW - PARTITION_CONFIG.corridorEdgeInset,
      floor2,
      [stairGap]
    );
  };

  const buildStairs = () => {
    const stairWidth = C.POLICE_STATION_STAIR_WIDTH;
    const stairDepth = C.POLICE_STATION_STAIR_DEPTH;
    const stepCount = C.POLICE_STATION_STAIR_STEP_COUNT;
    const stepHeight = floorHeight / stepCount;
    const stepDepth = stairDepth / stepCount;
    const baseX = C.POLICE_STATION_STAIR_CENTER_X;
    const baseZ = C.POLICE_STATION_STAIR_CENTER_Z - stairDepth / 2;
    const stepGeo = new THREE.BoxGeometry(stairWidth, stepHeight, stepDepth);
    addToDispose(stepGeo);

    for (let flight = 0; flight < 2; flight += 1) {
      const baseY = flight * floorHeight;
      for (let i = 0; i < stepCount; i += 1) {
        const step = createMesh(stepGeo, materials.trimMat, {
          position: [
            baseX,
            baseY + stepHeight / 2 + stepHeight * i,
            baseZ + stepDepth / 2 + stepDepth * i,
          ],
          cloneMaterial: false,
        });
        addToStation(step);
      }
    }
  };

  const buildFurniture = () => {
    const woodMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.woodColor,
      roughness: MATERIAL_CONFIG.woodRoughness,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.darkWoodColor,
      roughness: MATERIAL_CONFIG.darkWoodRoughness,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.stoneColor,
      roughness: MATERIAL_CONFIG.stoneRoughness,
    });
    const bearFurMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.bearFurColor,
      roughness: MATERIAL_CONFIG.bearFurRoughness,
    });
    const bearMuzzleMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.bearMuzzleColor,
      roughness: MATERIAL_CONFIG.bearMuzzleRoughness,
    });
    const bearNoseMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.bearNoseColor,
      roughness: MATERIAL_CONFIG.bearNoseRoughness,
    });
    addToDispose(bearFurMat);
    addToDispose(bearMuzzleMat);
    addToDispose(bearNoseMat);
    const fabricMat = new THREE.MeshStandardMaterial({
      color: MATERIAL_CONFIG.fabricColor,
      roughness: MATERIAL_CONFIG.fabricRoughness,
    });
    addToDispose(woodMat);
    addToDispose(darkWoodMat);
    addToDispose(stoneMat);
    addToDispose(fabricMat);

    const makeBox = (
      size: readonly [number, number, number],
      position: readonly [number, number, number],
      material: THREE.Material
    ) => {
      const geo = new THREE.BoxGeometry(...size);
      addToDispose(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(...position);
      addToStation(mesh);
    };
    const makeCylinder = (
      radiusTop: number,
      radiusBottom: number,
      height: number,
      position: readonly [number, number, number],
      material: THREE.Material,
      radialSegments = 10
    ) => {
      const geo = new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        radialSegments
      );
      addToDispose(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(...position);
      addToStation(mesh);
    };

    const addBench = (x: number, y: number, z: number) => {
      makeBox(
        BENCH_CONFIG.seatSize,
        [x, y + BENCH_CONFIG.seatYOffset, z],
        darkWoodMat
      );
      makeBox(
        BENCH_CONFIG.backSize,
        [x, y + BENCH_CONFIG.backYOffset, z + BENCH_CONFIG.backZOffset],
        darkWoodMat
      );
    };

    const addBars = (
      centerX: number,
      centerZ: number,
      width: number,
      height: number,
      count: number,
      baseY: number
    ) => {
      const spacing = width / (count + 1);
      for (let i = 1; i <= count; i += 1) {
        makeBox(
          [BAR_CONFIG.barSize, height, BAR_CONFIG.barSize],
          [centerX - width / 2 + spacing * i, baseY + height / 2, centerZ],
          materials.metalMat
        );
      }
      makeBox(
        [width, BAR_CONFIG.capHeight, BAR_CONFIG.capDepth],
        [centerX, baseY + height, centerZ],
        materials.metalMat
      );
      makeBox(
        [width, BAR_CONFIG.capHeight, BAR_CONFIG.capDepth],
        [centerX, baseY, centerZ],
        materials.metalMat
      );
    };

    const buildGroundFurniture = () => {
      makeBox(
        FURNITURE_CONFIG.ground.receptionDesk.size,
        FURNITURE_CONFIG.ground.receptionDesk.position,
        woodMat
      ); // reception desk
      makeBox(
        FURNITURE_CONFIG.ground.backCounter.size,
        FURNITURE_CONFIG.ground.backCounter.position,
        darkWoodMat
      ); // back counter
      makeBox(
        FURNITURE_CONFIG.ground.receptionRug.size,
        FURNITURE_CONFIG.ground.receptionRug.position,
        darkWoodMat
      ); // rug
      addBench(...FURNITURE_CONFIG.ground.lobbyBenchLeft.position);
      addBench(...FURNITURE_CONFIG.ground.lobbyBenchRight.position);
      makeBox(
        FURNITURE_CONFIG.ground.lockerA.size,
        FURNITURE_CONFIG.ground.lockerA.position,
        materials.metalMat
      ); // locker
      makeBox(
        FURNITURE_CONFIG.ground.lockerB.size,
        FURNITURE_CONFIG.ground.lockerB.position,
        materials.metalMat
      );
      makeBox(
        FURNITURE_CONFIG.ground.noticeBoard.size,
        FURNITURE_CONFIG.ground.noticeBoard.position,
        materials.metalMat
      ); // notice board

      makeBox(
        FURNITURE_CONFIG.ground.jailBunkA.size,
        FURNITURE_CONFIG.ground.jailBunkA.position,
        darkWoodMat
      ); // jail bunk
      makeBox(
        FURNITURE_CONFIG.ground.jailBunkB.size,
        FURNITURE_CONFIG.ground.jailBunkB.position,
        darkWoodMat
      );
      addBars(
        FURNITURE_CONFIG.ground.cellBarsA.centerX,
        FURNITURE_CONFIG.ground.cellBarsA.centerZ,
        FURNITURE_CONFIG.ground.cellBarsA.width,
        FURNITURE_CONFIG.ground.cellBarsA.height,
        FURNITURE_CONFIG.ground.cellBarsA.count,
        FURNITURE_CONFIG.ground.cellBarsA.baseY
      ); // cell bars
      addBars(
        FURNITURE_CONFIG.ground.cellBarsB.centerX,
        FURNITURE_CONFIG.ground.cellBarsB.centerZ,
        FURNITURE_CONFIG.ground.cellBarsB.width,
        FURNITURE_CONFIG.ground.cellBarsB.height,
        FURNITURE_CONFIG.ground.cellBarsB.count,
        FURNITURE_CONFIG.ground.cellBarsB.baseY
      );
      makeBox(
        FURNITURE_CONFIG.ground.toiletBlock.size,
        FURNITURE_CONFIG.ground.toiletBlock.position,
        stoneMat
      ); // toilet
      makeBox(
        FURNITURE_CONFIG.ground.toiletSeat.size,
        FURNITURE_CONFIG.ground.toiletSeat.position,
        stoneMat
      );

      makeBox(
        FURNITURE_CONFIG.ground.interrogationTable.size,
        FURNITURE_CONFIG.ground.interrogationTable.position,
        woodMat
      ); // interrogation table
      makeBox(
        FURNITURE_CONFIG.ground.interrogationChairA.size,
        FURNITURE_CONFIG.ground.interrogationChairA.position,
        darkWoodMat
      );
      makeBox(
        FURNITURE_CONFIG.ground.interrogationChairB.size,
        FURNITURE_CONFIG.ground.interrogationChairB.position,
        darkWoodMat
      );
      makeBox(
        FURNITURE_CONFIG.ground.mirrorWall.size,
        FURNITURE_CONFIG.ground.mirrorWall.position,
        materials.metalMat
      ); // mirror wall
      makeBox(
        FURNITURE_CONFIG.ground.interrogationRug.size,
        FURNITURE_CONFIG.ground.interrogationRug.position,
        darkWoodMat
      ); // rug
      makeBox(
        FURNITURE_CONFIG.ground.toiletBlockAlt.size,
        FURNITURE_CONFIG.ground.toiletBlockAlt.position,
        stoneMat
      ); // toilet block
      makeBox(
        FURNITURE_CONFIG.ground.sink.size,
        FURNITURE_CONFIG.ground.sink.position,
        stoneMat
      ); // sink

      makeBox(
        FURNITURE_CONFIG.ground.morgueTable.size,
        FURNITURE_CONFIG.ground.morgueTable.position,
        stoneMat
      ); // morgue table
      makeBox(
        FURNITURE_CONFIG.ground.cabinet.size,
        FURNITURE_CONFIG.ground.cabinet.position,
        materials.metalMat
      ); // cabinet
      makeBox(
        FURNITURE_CONFIG.ground.medicalLocker.size,
        FURNITURE_CONFIG.ground.medicalLocker.position,
        materials.metalMat
      ); // medical locker
    };

    const buildSecondFloorFurniture = (floorY: number) => {
      makeBox(
        FURNITURE_CONFIG.second.officeDeskA.size,
        [
          FURNITURE_CONFIG.second.officeDeskA.position[0],
          floorY + FURNITURE_CONFIG.second.officeDeskA.position[1],
          FURNITURE_CONFIG.second.officeDeskA.position[2],
        ],
        woodMat
      ); // office desks
      makeBox(
        FURNITURE_CONFIG.second.officeDeskB.size,
        [
          FURNITURE_CONFIG.second.officeDeskB.position[0],
          floorY + FURNITURE_CONFIG.second.officeDeskB.position[1],
          FURNITURE_CONFIG.second.officeDeskB.position[2],
        ],
        woodMat
      );
      makeBox(
        FURNITURE_CONFIG.second.officeChairA.size,
        [
          FURNITURE_CONFIG.second.officeChairA.position[0],
          floorY + FURNITURE_CONFIG.second.officeChairA.position[1],
          FURNITURE_CONFIG.second.officeChairA.position[2],
        ],
        darkWoodMat
      ); // chairs
      makeBox(
        FURNITURE_CONFIG.second.officeChairB.size,
        [
          FURNITURE_CONFIG.second.officeChairB.position[0],
          floorY + FURNITURE_CONFIG.second.officeChairB.position[1],
          FURNITURE_CONFIG.second.officeChairB.position[2],
        ],
        darkWoodMat
      );
      makeBox(
        FURNITURE_CONFIG.second.filingCabinetA.size,
        [
          FURNITURE_CONFIG.second.filingCabinetA.position[0],
          floorY + FURNITURE_CONFIG.second.filingCabinetA.position[1],
          FURNITURE_CONFIG.second.filingCabinetA.position[2],
        ],
        materials.metalMat
      ); // filing
      makeBox(
        FURNITURE_CONFIG.second.filingCabinetB.size,
        [
          FURNITURE_CONFIG.second.filingCabinetB.position[0],
          floorY + FURNITURE_CONFIG.second.filingCabinetB.position[1],
          FURNITURE_CONFIG.second.filingCabinetB.position[2],
        ],
        materials.metalMat
      );
      makeBox(
        FURNITURE_CONFIG.second.officeShelves.size,
        [
          FURNITURE_CONFIG.second.officeShelves.position[0],
          floorY + FURNITURE_CONFIG.second.officeShelves.position[1],
          FURNITURE_CONFIG.second.officeShelves.position[2],
        ],
        materials.metalMat
      ); // shelves
      makeBox(
        FURNITURE_CONFIG.second.officeRug.size,
        [
          FURNITURE_CONFIG.second.officeRug.position[0],
          floorY + FURNITURE_CONFIG.second.officeRug.position[1],
          FURNITURE_CONFIG.second.officeRug.position[2],
        ],
        darkWoodMat
      ); // rug

      makeBox(
        FURNITURE_CONFIG.second.breakTable.size,
        [
          FURNITURE_CONFIG.second.breakTable.position[0],
          floorY + FURNITURE_CONFIG.second.breakTable.position[1],
          FURNITURE_CONFIG.second.breakTable.position[2],
        ],
        woodMat
      ); // break table
      makeBox(
        FURNITURE_CONFIG.second.sofaA.size,
        [
          FURNITURE_CONFIG.second.sofaA.position[0],
          floorY + FURNITURE_CONFIG.second.sofaA.position[1],
          FURNITURE_CONFIG.second.sofaA.position[2],
        ],
        fabricMat
      ); // sofa
      makeBox(
        FURNITURE_CONFIG.second.sofaB.size,
        [
          FURNITURE_CONFIG.second.sofaB.position[0],
          floorY + FURNITURE_CONFIG.second.sofaB.position[1],
          FURNITURE_CONFIG.second.sofaB.position[2],
        ],
        fabricMat
      );
      makeBox(
        FURNITURE_CONFIG.second.fridge.size,
        [
          FURNITURE_CONFIG.second.fridge.position[0],
          floorY + FURNITURE_CONFIG.second.fridge.position[1],
          FURNITURE_CONFIG.second.fridge.position[2],
        ],
        materials.metalMat
      ); // fridge
      makeBox(
        FURNITURE_CONFIG.second.counter.size,
        [
          FURNITURE_CONFIG.second.counter.position[0],
          floorY + FURNITURE_CONFIG.second.counter.position[1],
          FURNITURE_CONFIG.second.counter.position[2],
        ],
        woodMat
      ); // counter
      makeBox(
        FURNITURE_CONFIG.second.lockers.size,
        [
          FURNITURE_CONFIG.second.lockers.position[0],
          floorY + FURNITURE_CONFIG.second.lockers.position[1],
          FURNITURE_CONFIG.second.lockers.position[2],
        ],
        materials.metalMat
      ); // lockers
      makeBox(
        FURNITURE_CONFIG.second.breakRug.size,
        [
          FURNITURE_CONFIG.second.breakRug.position[0],
          floorY + FURNITURE_CONFIG.second.breakRug.position[1],
          FURNITURE_CONFIG.second.breakRug.position[2],
        ],
        darkWoodMat
      ); // rug
      makeCylinder(
        FURNITURE_CONFIG.second.columnA.radiusTop,
        FURNITURE_CONFIG.second.columnA.radiusBottom,
        FURNITURE_CONFIG.second.columnA.height,
        [
          FURNITURE_CONFIG.second.columnA.position[0],
          floorY + FURNITURE_CONFIG.second.columnA.position[1],
          FURNITURE_CONFIG.second.columnA.position[2],
        ],
        materials.trimMat
      );
      makeCylinder(
        FURNITURE_CONFIG.second.columnB.radiusTop,
        FURNITURE_CONFIG.second.columnB.radiusBottom,
        FURNITURE_CONFIG.second.columnB.height,
        [
          FURNITURE_CONFIG.second.columnB.position[0],
          floorY + FURNITURE_CONFIG.second.columnB.position[1],
          FURNITURE_CONFIG.second.columnB.position[2],
        ],
        materials.trimMat
      );
    };

    const buildThirdFloorFurniture = (floorY: number) => {
      makeBox(
        FURNITURE_CONFIG.third.armoryRackA.size,
        [
          FURNITURE_CONFIG.third.armoryRackA.position[0],
          floorY + FURNITURE_CONFIG.third.armoryRackA.position[1],
          FURNITURE_CONFIG.third.armoryRackA.position[2],
        ],
        materials.metalMat
      ); // armory racks
      makeBox(
        FURNITURE_CONFIG.third.armoryRackB.size,
        [
          FURNITURE_CONFIG.third.armoryRackB.position[0],
          floorY + FURNITURE_CONFIG.third.armoryRackB.position[1],
          FURNITURE_CONFIG.third.armoryRackB.position[2],
        ],
        materials.metalMat
      );
      makeBox(
        FURNITURE_CONFIG.third.workbench.size,
        [
          FURNITURE_CONFIG.third.workbench.position[0],
          floorY + FURNITURE_CONFIG.third.workbench.position[1],
          FURNITURE_CONFIG.third.workbench.position[2],
        ],
        woodMat
      ); // workbench
      makeBox(
        FURNITURE_CONFIG.third.ammoLocker.size,
        [
          FURNITURE_CONFIG.third.ammoLocker.position[0],
          floorY + FURNITURE_CONFIG.third.ammoLocker.position[1],
          FURNITURE_CONFIG.third.ammoLocker.position[2],
        ],
        materials.metalMat
      ); // ammo locker
      makeBox(
        FURNITURE_CONFIG.third.armoryRug.size,
        [
          FURNITURE_CONFIG.third.armoryRug.position[0],
          floorY + FURNITURE_CONFIG.third.armoryRug.position[1],
          FURNITURE_CONFIG.third.armoryRug.position[2],
        ],
        darkWoodMat
      ); // rug
      makeBox(
        FURNITURE_CONFIG.third.weaponRackA.size,
        [
          FURNITURE_CONFIG.third.weaponRackA.position[0],
          floorY + FURNITURE_CONFIG.third.weaponRackA.position[1],
          FURNITURE_CONFIG.third.weaponRackA.position[2],
        ],
        materials.metalMat
      ); // weapon rack
      makeBox(
        FURNITURE_CONFIG.third.weaponRackB.size,
        [
          FURNITURE_CONFIG.third.weaponRackB.position[0],
          floorY + FURNITURE_CONFIG.third.weaponRackB.position[1],
          FURNITURE_CONFIG.third.weaponRackB.position[2],
        ],
        materials.metalMat
      );
      makeBox(
        FURNITURE_CONFIG.third.evidenceShelvesA.size,
        [
          FURNITURE_CONFIG.third.evidenceShelvesA.position[0],
          floorY + FURNITURE_CONFIG.third.evidenceShelvesA.position[1],
          FURNITURE_CONFIG.third.evidenceShelvesA.position[2],
        ],
        darkWoodMat
      ); // evidence shelves
      makeBox(
        FURNITURE_CONFIG.third.evidenceShelvesB.size,
        [
          FURNITURE_CONFIG.third.evidenceShelvesB.position[0],
          floorY + FURNITURE_CONFIG.third.evidenceShelvesB.position[1],
          FURNITURE_CONFIG.third.evidenceShelvesB.position[2],
        ],
        darkWoodMat
      );
      makeBox(
        FURNITURE_CONFIG.third.evidenceTable.size,
        [
          FURNITURE_CONFIG.third.evidenceTable.position[0],
          floorY + FURNITURE_CONFIG.third.evidenceTable.position[1],
          FURNITURE_CONFIG.third.evidenceTable.position[2],
        ],
        woodMat
      ); // evidence table
      makeBox(
        FURNITURE_CONFIG.third.lockbox.size,
        [
          FURNITURE_CONFIG.third.lockbox.position[0],
          floorY + FURNITURE_CONFIG.third.lockbox.position[1],
          FURNITURE_CONFIG.third.lockbox.position[2],
        ],
        materials.metalMat
      ); // lockbox
      makeBox(
        FURNITURE_CONFIG.third.evidenceRug.size,
        [
          FURNITURE_CONFIG.third.evidenceRug.position[0],
          floorY + FURNITURE_CONFIG.third.evidenceRug.position[1],
          FURNITURE_CONFIG.third.evidenceRug.position[2],
        ],
        darkWoodMat
      ); // rug
    };

    const createBearGroup = (withAnchor: boolean) => {
      const bearGroup = new THREE.Group();
      const bearBodyGeo = new THREE.SphereGeometry(
        BEAR_CONFIG.body.radius,
        BEAR_CONFIG.body.widthSegments,
        BEAR_CONFIG.body.heightSegments
      );
      const bearHeadGeo = new THREE.SphereGeometry(
        BEAR_CONFIG.head.radius,
        BEAR_CONFIG.head.widthSegments,
        BEAR_CONFIG.head.heightSegments
      );
      const bearEarGeo = new THREE.SphereGeometry(
        BEAR_CONFIG.ear.radius,
        BEAR_CONFIG.ear.widthSegments,
        BEAR_CONFIG.ear.heightSegments
      );
      const bearMuzzleGeo = new THREE.SphereGeometry(
        BEAR_CONFIG.muzzle.radius,
        BEAR_CONFIG.muzzle.widthSegments,
        BEAR_CONFIG.muzzle.heightSegments
      );
      const bearLegGeo = new THREE.CylinderGeometry(
        BEAR_CONFIG.leg.radiusTop,
        BEAR_CONFIG.leg.radiusBottom,
        BEAR_CONFIG.leg.height,
        BEAR_CONFIG.leg.radialSegments
      );
      addToDispose(bearBodyGeo);
      addToDispose(bearHeadGeo);
      addToDispose(bearEarGeo);
      addToDispose(bearMuzzleGeo);
      addToDispose(bearLegGeo);
      const body = createMesh(bearBodyGeo, bearFurMat, {
        position: BEAR_CONFIG.body.position,
        cloneMaterial: false,
      });
      const head = createMesh(bearHeadGeo, bearFurMat, {
        position: BEAR_CONFIG.head.position,
        cloneMaterial: false,
      });
      const leftEar = createMesh(bearEarGeo, bearFurMat, {
        position: BEAR_CONFIG.ear.leftPosition,
        cloneMaterial: false,
      });
      const rightEar = createMesh(bearEarGeo, bearFurMat, {
        position: BEAR_CONFIG.ear.rightPosition,
        cloneMaterial: false,
      });
      const muzzle = createMesh(bearMuzzleGeo, bearMuzzleMat, {
        position: BEAR_CONFIG.muzzle.position,
        cloneMaterial: false,
      });
      const nose = createMesh(bearMuzzleGeo, bearNoseMat, {
        position: BEAR_CONFIG.nose.position,
        cloneMaterial: false,
      });
      for (const [x, z] of BEAR_CONFIG.leg.positions) {
        const leg = createMesh(bearLegGeo, bearFurMat, {
          position: [x, BEAR_CONFIG.leg.y, z],
          cloneMaterial: false,
        });
        bearGroup.add(leg);
      }
      bearGroup.add(body, head, leftEar, rightEar, muzzle, nose);
      if (withAnchor) {
        const bearTalkAnchor = new THREE.Object3D();
        bearTalkAnchor.position.set(
          BEAR_CONFIG.talkAnchorPosition[0],
          BEAR_CONFIG.talkAnchorPosition[1],
          BEAR_CONFIG.talkAnchorPosition[2]
        );
        bearGroup.add(bearTalkAnchor);
        return { group: bearGroup, anchor: bearTalkAnchor };
      }
      return { group: bearGroup };
    };

    const placeBears = () => {
      type BearPosition = (typeof BEAR_POSITIONS)[keyof typeof BEAR_POSITIONS];
      const spawnBear = (pos: BearPosition) => {
        const bear = createBearGroup(true);
        bear.group.position.set(pos.x, floorHeight * pos.floor, pos.z);
        addToStation(bear.group);
        if (bear.anchor)
          bearAnchors.push({ anchor: bear.anchor, message: pos.message });
      };

      spawnBear(BEAR_POSITIONS.chief);
      spawnBear(BEAR_POSITIONS.lobby);
      spawnBear(BEAR_POSITIONS.jail);
    };

    buildGroundFurniture();
    buildSecondFloorFurniture(floorHeight * FLOOR_LEVEL.LEVEL_1);
    buildThirdFloorFurniture(floorHeight * FLOOR_LEVEL.LEVEL_2);
    placeBears();
  };

  const buildLights = () => {
    const lightPositions: [number, number, number][] = [];
    for (let i = 0; i < C.POLICE_STATION_FLOOR_COUNT; i += 1) {
      const y = i * floorHeight + floorHeight + LIGHT_CONFIG.yOffset;
      for (const [x, z] of LIGHT_CONFIG.positions) {
        lightPositions.push([x, y, z]);
      }
    }
    for (const [x, y, z] of lightPositions) {
      const light = new THREE.PointLight(
        C.POLICE_STATION_LIGHT_COLOR,
        LIGHT_CONFIG.intensity,
        LIGHT_CONFIG.distance
      );
      light.position.set(x, y, z);
      addToStation(light);
      const bulbGeo = new THREE.SphereGeometry(
        LIGHT_CONFIG.bulbRadius,
        LIGHT_CONFIG.bulbSegments,
        LIGHT_CONFIG.bulbSegments
      );
      addToDispose(bulbGeo);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: C.POLICE_STATION_LIGHT_COLOR,
        emissive: C.POLICE_STATION_LIGHT_COLOR,
        emissiveIntensity: LIGHT_CONFIG.bulbEmissiveIntensity,
      });
      addToDispose(bulbMat);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, y, z);
      addToStation(bulb);
    }
  };

  const buildSign = () => {
    const signGeo = new THREE.PlaneGeometry(
      C.POLICE_STATION_SIGN_WIDTH,
      C.POLICE_STATION_SIGN_HEIGHT
    );
    addToDispose(signGeo);
    const sign = new THREE.Mesh(signGeo, createSignMaterial());
    sign.position.set(
      0,
      C.POLICE_STATION_FLOOR_HEIGHT - SIGN_CONFIG.positionYOffset,
      halfD + SIGN_CONFIG.positionZOffset
    );
    sign.rotation.y = 0;
    addToStation(sign);
  };

  const buildDoors = () => {
    const resolveCenterZ = (centerZ: number | 'front') =>
      centerZ === 'front' ? halfD - wallThickness / 2 : centerZ;
    const addDoorSet = (
      entries: ReadonlyArray<{
        centerX: number;
        centerZ: number | 'front';
        rotationY: number;
        hingeSide: 'left' | 'right';
      }>,
      floorIndex: number
    ) => {
      const baseY = floorHeight * floorIndex;
      for (const entry of entries) {
        addDoor({
          centerX: entry.centerX,
          centerZ: resolveCenterZ(entry.centerZ),
          baseY,
          rotationY: entry.rotationY,
          hingeSide: entry.hingeSide,
        });
      }
    };

    addDoorSet(DOOR_LAYOUT.ground, FLOOR_LEVEL.LEVEL_0);
    addDoorSet(DOOR_LAYOUT.second, FLOOR_LEVEL.LEVEL_1);
    addDoorSet(DOOR_LAYOUT.third, FLOOR_LEVEL.LEVEL_2);
  };

  buildFloors();
  buildOuterWalls();
  buildPerimeterColliders();
  buildPartitions();
  buildStairs();
  buildFurniture();
  buildLights();
  buildSign();
  buildDoors();

  scene.add(station);

  return {
    group: station,
    colliders,
    doors,
    bearAnchors,
    bearInteractRadius: BEAR_CONFIG.interactRadius,
  };
}
