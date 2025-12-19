export const GRAVITY = 20;
export const JUMP_HEIGHT = 3.0 * 1.5; // boosted to clear small trees
export const JUMP_SPEED = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
export const MAX_FRAME_DELTA = 0.05; // clamp delta seconds to avoid simulation spikes
export const COLLISION_VERTICAL_CLEARANCE = 0.05; // jump-over clearance for tree tops
export const GROUND_Y = 0; // ground plane height
