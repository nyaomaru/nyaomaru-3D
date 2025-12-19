import * as THREE from 'three';
import type { Collider } from './collision';

export type Destructible = {
  id: number;
  group: THREE.Group; // visual group (added to scene)
  x: number;
  y: number;
  z: number;
  r: number; // hit radius in XZ
  topY?: number; // approximate top height for jump-over logic
  health: number;
  maxHealth: number;
  collider?: Collider; // reference to movement collider
};

export type ShatterFragment = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number; // seconds remaining
};

export type PunchTarget = {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  r: number;
  collider?: Collider;
};
