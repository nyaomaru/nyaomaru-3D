export const HAND_LEFT = 'left' as const;
export const HAND_RIGHT = 'right' as const;

export const HAND = {
  LEFT: HAND_LEFT,
  RIGHT: HAND_RIGHT,
} as const;

export type Hand = typeof HAND[keyof typeof HAND];

