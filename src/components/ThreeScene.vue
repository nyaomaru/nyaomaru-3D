<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';

const container = ref<HTMLDivElement | null>(null);

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let cubeMesh: THREE.Mesh | undefined;
let backgroundPlane:
  | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  | undefined;
let backgroundTexture: THREE.Texture | undefined;
let animationFrameId = 0;
const backgroundPlaneDistanceFromCamera = 15;
const cameraForward = new THREE.Vector3();
const planeOffset = new THREE.Vector3();

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
}

function updateBackgroundPlane() {
  if (!camera || !backgroundPlane) return;

  const texture = backgroundTexture;
  const textureImage = texture?.image as HTMLImageElement | ImageBitmap | undefined;
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

onMounted(() => {
  const containerElement = container.value!;
  const containerWidth = containerElement.clientWidth || window.innerWidth;
  const containerHeight = containerElement.clientHeight || window.innerHeight;

  const assetsBasePath = import.meta.env.BASE_URL;
  const normalizedBasePath = assetsBasePath.endsWith('/')
    ? assetsBasePath
    : `${assetsBasePath}/`;

  // 背景テクスチャ（単一画像）
  const textureLoader = new THREE.TextureLoader();
  const backgroundTextureUrl = `${normalizedBasePath}nyaomaru_logo.png`;

  scene = new THREE.Scene();

  backgroundTexture = textureLoader.load(
    backgroundTextureUrl,
    () => {
      backgroundTexture?.colorSpace = THREE.SRGBColorSpace;
      createBackgroundPlane();
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
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

  // オブジェクト
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x41b883,
    roughness: 0.4,
  });
  cubeMesh = new THREE.Mesh(geometry, material);
  scene.add(cubeMesh);

  // ライト
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(3, 5, 2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3), directionalLight);

  // ループ
  const renderFrame = () => {
    cubeMesh!.rotation.y += 0.01;
    cubeMesh!.rotation.x += 0.005;
    renderer!.render(scene!, camera!);
    animationFrameId = requestAnimationFrame(renderFrame);
  };
  renderFrame();

  // リサイズ
  window.addEventListener('resize', handleResize);
  // マウント直後のレイアウト確定後にも一度
  queueMicrotask(handleResize);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', handleResize);

  // 安全に破棄
  try {
    cubeMesh?.geometry.dispose();
    (cubeMesh?.material as THREE.Material | undefined)?.dispose();
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
