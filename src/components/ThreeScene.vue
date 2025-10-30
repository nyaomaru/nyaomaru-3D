<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';

const container = ref<HTMLDivElement | null>(null);

const LOGO_PATTERN = [
  '                        ',
  '                        ',
  '        #       #       ',
  '       ###     ###      ',
  '       ###########      ',
  '      #############     ',
  '     ###############    ',
  '     ###############    ',
  '  ##################### ',
  ' #   ###############   #',
  '   ###################  ',
  '   #  #############  #  ',
  '  #    ###########    # ',
  '        #########       ',
  '        #########       ',
  '       ###########      ',
  '      ### ##### ###     ',
  '      #   #####   #     ',
  '          #####         ',
  '          ## ##         ',
  '          #   #         ',
  '          #   #         ',
  '                        ',
];

const CELL_SIZE = 0.1;
const DEPTH_LAYERS = 3;
const DEPTH_SPACING = CELL_SIZE * 0.8;
const LOGO_COLOR = new THREE.Color(0x9cff4f);
const BACKGROUND_MASKS = [
  { x0: 90, y0: 1080, x1: 390, y1: 1650 },
  { x0: 2680, y0: 1080, x1: 2980, y1: 1650 },
];

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let catMesh: THREE.InstancedMesh | undefined;
let catGeometry: THREE.BoxGeometry | undefined;
let catMaterial: THREE.MeshStandardMaterial | undefined;
let backgroundPlane:
  | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  | undefined;
let backgroundTexture: THREE.Texture | undefined;
let animationFrameId = 0;
const backgroundPlaneDistanceFromCamera = 15;
const cameraForward = new THREE.Vector3();
const planeOffset = new THREE.Vector3();
const dummyObject = new THREE.Object3D();

function applyBackgroundMask(texture: THREE.Texture) {
  const sourceImage = texture.image as HTMLImageElement | HTMLCanvasElement;
  if (!sourceImage) return;

  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.drawImage(sourceImage, 0, 0);
  context.fillStyle = '#111115';

  const padding = 40;
  BACKGROUND_MASKS.forEach(({ x0, y0, x1, y1 }) => {
    const width = x1 - x0;
    const height = y1 - y0;
    const drawX = Math.max(0, x0 - padding);
    const drawY = Math.max(0, y0 - padding);
    const drawWidth = Math.min(canvas.width - drawX, width + padding * 2);
    const drawHeight = Math.min(canvas.height - drawY, height + padding * 2);
    context.fillRect(drawX, drawY, drawWidth, drawHeight);
  });

  texture.image = canvas;
  texture.needsUpdate = true;
}

function createBackgroundPlane() {
  if (!scene || !camera || backgroundPlane) return;

  const texture = backgroundTexture;
  if (!texture) return;

  const backgroundMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
  });
  const backgroundGeometry = new THREE.PlaneGeometry(1, 1);
  backgroundPlane = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
  backgroundPlane.renderOrder = -1;
  scene.add(backgroundPlane);

  updateBackgroundPlane();
}

function handleResize() {
  const containerElement = container.value;
  if (!containerElement || !renderer || !camera) return;
  const containerWidth = containerElement.clientWidth || window.innerWidth;
  const containerHeight = containerElement.clientHeight || window.innerHeight;
  camera.aspect = containerWidth / containerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerWidth, containerHeight, false);
  createBackgroundPlane();
  updateBackgroundPlane();
  renderScene();
}

function updateBackgroundPlane() {
  if (!camera || !backgroundPlane) return;

  const texture = backgroundTexture;
  const textureImage = texture?.image as
    | HTMLImageElement
    | ImageBitmap
    | undefined;
  if (!textureImage) return;

  camera.getWorldDirection(cameraForward);
  planeOffset
    .copy(cameraForward)
    .multiplyScalar(backgroundPlaneDistanceFromCamera);
  backgroundPlane.position.copy(camera.position).add(planeOffset);
  backgroundPlane.quaternion.copy(camera.quaternion);

  const cameraToPlaneDistance = backgroundPlane.position.distanceTo(
    camera.position
  );
  const verticalFovRad = THREE.MathUtils.degToRad(camera.fov / 2);
  const viewHeightAtPlane =
    2 * Math.tan(verticalFovRad) * cameraToPlaneDistance;
  const viewWidthAtPlane = viewHeightAtPlane * camera.aspect;

  const textureAspect = textureImage.width / textureImage.height;
  const viewAspect = viewWidthAtPlane / viewHeightAtPlane;

  let planeWidth = viewWidthAtPlane;
  let planeHeight = viewHeightAtPlane;

  if (viewAspect > textureAspect) {
    planeWidth = viewWidthAtPlane;
    planeHeight = planeWidth / textureAspect;
  } else {
    planeHeight = viewHeightAtPlane;
    planeWidth = planeHeight * textureAspect;
  }

  backgroundPlane.scale.set(planeWidth, planeHeight, 1);
}

function renderScene() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}

function startAnimation() {
  stopAnimation();
  const animate = () => {
    if (catMesh) {
      catMesh.rotation.y += 0.01;
    }
    renderScene();
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();
}

function buildCatMesh() {
  if (!scene) return;

  if (catMesh) {
    scene.remove(catMesh);
    catGeometry?.dispose();
    catMaterial?.dispose();
    catMesh.dispose();
    catMesh = undefined;
  }

  const activeCells: Array<{ x: number; y: number }> = [];
  const totalRows = LOGO_PATTERN.length;
  const totalColumns = LOGO_PATTERN[0]?.length ?? 0;
  const xOffset = ((totalColumns - 1) * CELL_SIZE) / 2;
  const yOffset = ((totalRows - 1) * CELL_SIZE) / 2;

  LOGO_PATTERN.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== ' ') {
        const xPosition = columnIndex * CELL_SIZE - xOffset;
        const yPosition = (totalRows - 1 - rowIndex) * CELL_SIZE - yOffset;
        activeCells.push({ x: xPosition, y: yPosition });
      }
    });
  });

  if (activeCells.length === 0) return;

  catGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
  catMaterial = new THREE.MeshStandardMaterial({
    color: LOGO_COLOR,
    roughness: 0.35,
    metalness: 0.1,
  });
  catMesh = new THREE.InstancedMesh(
    catGeometry,
    catMaterial,
    activeCells.length * DEPTH_LAYERS
  );

  activeCells.forEach((cell, cellIndex) => {
    for (let layer = 0; layer < DEPTH_LAYERS; layer += 1) {
      const instanceIndex = cellIndex * DEPTH_LAYERS + layer;
      const zPosition = (layer - (DEPTH_LAYERS - 1) / 2) * DEPTH_SPACING;
      dummyObject.position.set(cell.x, cell.y, zPosition);
      dummyObject.rotation.set(0, 0, 0);
      dummyObject.updateMatrix();
      catMesh!.setMatrixAt(instanceIndex, dummyObject.matrix);
    }
  });

  catMesh.instanceMatrix.needsUpdate = true;
  scene.add(catMesh);
  startAnimation();
}

onMounted(() => {
  const containerElement = container.value!;
  const containerWidth = containerElement.clientWidth || window.innerWidth;
  const containerHeight = containerElement.clientHeight || window.innerHeight;

  const assetsBasePath = import.meta.env.BASE_URL;
  const normalizedBasePath = assetsBasePath.endsWith('/')
    ? assetsBasePath
    : `${assetsBasePath}/`;

  const textureLoader = new THREE.TextureLoader();
  const backgroundTextureUrl = `${normalizedBasePath}nyaomaru_logo.png`;

  scene = new THREE.Scene();

  backgroundTexture = textureLoader.load(
    backgroundTextureUrl,
    () => {
      if (backgroundTexture) {
        applyBackgroundMask(backgroundTexture);
      }
      if (backgroundTexture) {
        backgroundTexture.colorSpace = THREE.SRGBColorSpace;
      }
      createBackgroundPlane();
      if (renderer && scene && camera) {
        renderScene();
      }
    },
    undefined,
    (error) => {
      console.error('Failed to load background texture', error);
    }
  );
  scene.background = backgroundTexture;

  // scene.background = new THREE.Color(0x111115);

  camera = new THREE.PerspectiveCamera(
    60,
    containerWidth / containerHeight,
    0.1,
    100
  );
  camera.position.set(2, 2, 3);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(containerWidth, containerHeight, false);
  containerElement.appendChild(renderer.domElement);

  createBackgroundPlane();
  buildCatMesh();

  // ライト
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(3, 5, 2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3), directionalLight);

  // リサイズ
  window.addEventListener('resize', handleResize);
  // マウント直後のレイアウト確定後にも一度
  queueMicrotask(handleResize);
  renderScene();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  stopAnimation();

  // 安全に破棄
  try {
    if (catMesh) {
      scene?.remove(catMesh);
      catGeometry?.dispose();
      catMaterial?.dispose();
      catMesh.dispose();
      catMesh = undefined;
      catGeometry = undefined;
      catMaterial = undefined;
    }
    if (backgroundPlane) {
      backgroundPlane.geometry.dispose();
      backgroundPlane.material.map?.dispose();
      backgroundPlane.material.dispose();
      backgroundPlane = undefined;
      backgroundTexture = undefined;
    }
    renderer?.dispose();
  } catch {}
});
</script>

<template>
  <!-- ビューポート全高にする -->
  <div
    ref="container"
    style="width: 100%; height: 100vh; overflow: hidden"
  ></div>
</template>
