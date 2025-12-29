export const INITIAL_PITCH = 0.28;
export const MIN_PITCH = -0.4;
export const MAX_PITCH = 1.0;
export const MOUSE_SENSITIVITY = 0.0025;

// Keyboard key groups
export const KEYS_LEFT = ['a', 'ArrowLeft'] as const;
export const KEYS_RIGHT = ['d', 'ArrowRight'] as const;
export const KEYS_FORWARD = ['w', 'ArrowUp'] as const;
export const KEYS_BACKWARD = ['s', 'ArrowDown'] as const;
export const KEYS_SPRINT = ['Shift'] as const;
export const KEYS_JUMP = [' ', 'Space'] as const;
export const KEYS_PUNCH = ['z'] as const;
export const KEYS_TALK = ['x'] as const;
