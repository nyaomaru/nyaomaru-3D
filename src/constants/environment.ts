export const SKY_COLOR = 0x87ceeb; // sky blue

// Ground (sand)
export const GROUND_COLOR_SAND = 0xD2B48C; // tan
export const GROUND_ROUGHNESS = 0.92;
export const GROUND_METALNESS = 0.0;
export const GROUND_SIZE = 1000;

// Mountains
export const MOUNTAIN_COLOR = 0x6b8e23; // olive drab
export const MOUNTAIN_COUNT = 40;
export const MOUNTAIN_BASE_RADIUS_MIN = 40;
export const MOUNTAIN_BASE_RADIUS_RANGE = 120;
export const MOUNTAIN_SCALE_MIN = 0.8;
export const MOUNTAIN_SCALE_RANGE = 2.5;
export const MOUNTAIN_HEALTH = 5;
export const MOUNTAIN_ID_BASE = 5000; // base ID offset for mountain objects

// Lighting
export const HEMI_LIGHT_INTENSITY = 0.8;
export const DIR_LIGHT_INTENSITY = 0.8;
export const DIR_LIGHT_POSITION = { x: 5, y: 10, z: 5 } as const;

// Trees (destructible)
export const TREE_COUNT = 8;
export const TREE_MIN_RADIUS = 8;
export const TREE_RADIUS_RANGE = 20;
export const TREE_TRUNK_RADIUS = 0.25;
export const TREE_TRUNK_HEIGHT = 1.4;
export const TREE_CROWN_RADIUS = 0.9; // foliage sphere radius
export const TREE_HEALTH = 3; // hits to break

// Punch hit shape
export const PUNCH_REACH = 1.15; // distance in front of player
export const PUNCH_RADIUS = 0.35; // fist sphere radius

// Shatter effect
export const SHATTER_FRAGMENT_COUNT = 24;
export const SHATTER_FRAGMENT_SIZE = 0.08;
export const SHATTER_FRAGMENT_SPEED = 2.4;
export const SHATTER_FRAGMENT_UP = 2.0;
export const SHATTER_GRAVITY = 9.8;
export const SHATTER_LIFETIME = 1.5; // seconds
// Mountain shatter multipliers (make it flashier)
export const SHATTER_MOUNTAIN_COUNT_MULT = 3.0;
export const SHATTER_MOUNTAIN_SPEED_MULT = 1.8;
export const SHATTER_MOUNTAIN_UP_MULT = 1.6;
export const SHATTER_MOUNTAIN_LIFETIME_MULT = 1.4;
export const SHATTER_MOUNTAIN_FRAGMENT_SCALE = 0.85;
export const SHATTER_FRAGMENT_ROTATION_X = 4; // rad/s
export const SHATTER_FRAGMENT_ROTATION_Y = 3; // rad/s

// Big Trees (destructible + collidable)
export const BIG_TREE_COUNT = 2;
export const BIG_TREE_MIN_RADIUS = 25;
export const BIG_TREE_RADIUS_RANGE = 20;
export const BIG_TREE_TRUNK_RADIUS = 0.6;
export const BIG_TREE_TRUNK_HEIGHT = 3.2;
export const BIG_TREE_CROWN_RADIUS = 2.2;
export const BIG_TREE_HEALTH = 5;

// Visual feedback and rendering
export const HIT_FLASH_COLOR = 0xff3333;
export const HIT_FLASH_DURATION_MS = 120;
export const TREE_NUDGE_SCALE_DELTA = 0.03;
export const TREE_NUDGE_DURATION_MS = 50;
export const RENDERER_MAX_PIXEL_RATIO = 2;
