export type Collider = {
  x: number;
  z: number;
  r: number;
  // Optional min blocking height. When the player's Y is below this
  // height (plus a small clearance), collisions are ignored.
  minBlockY?: number;
  // Optional max blocking height. When the player's Y is above this
  // height (minus a small clearance), collisions against this collider
  // are ignored to allow passing over it (e.g., house walls when on roof).
  maxBlockY?: number;
};
