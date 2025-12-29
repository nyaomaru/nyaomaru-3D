export const MOVE_SPEED = 50;
export const ROTATE_SPEED = 2;
export const AUTO_TURN_SPEED = 8;
export const PLAYER_RADIUS = 0.6;
export const WORLD_RADIUS = 180;
export const DASH_MULTIPLIER = 1.5; // sprint speed multiplier when Shift is held
export const MOVING_THRESHOLD = 0.01; // abs(forward) > threshold means moving for swing

// Airborne movement tuning
// Scale preserved horizontal speed at jump takeoff (0.5 = half, 0.25 = quarter)
export const AIR_TAKEOFF_SPEED_MULT = 0.5;
// Allow limited steering while airborne as a fraction of ground speed
export const AIR_CONTROL_MULT = 0.25;
