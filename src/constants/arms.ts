// Arm extraction is limited to an upper–mid torso band (top-relative ratios)
export const ARM_BAND_TOP_RATIO = 0.58;   // near upper torso (below head)
export const ARM_BAND_BOTTOM_RATIO = 0.72; // above waist, narrower band

// X-direction uses per-row edge distance (ratio of row width)
// Prefer the outer edge (arm boundary, not ear)
export const ARM_THRESHOLD_MIN_RATIO = 0.0;  // include the very edge
export const ARM_THRESHOLD_MAX_RATIO = 0.12; // limit to ~2–3 columns from edge
export const ARM_MIN_CELLS_FOR_SWING = 8;
export const ARM_FALLBACK_WIDTH_COLS = 1;
export const ARM_MIN_EDGE_DELTA_MARGIN = 0.5;

export const ARM_SWING_AMP = 0.8;
export const ARM_SWING_SPEED = 0.007;
export const ARM_SWING_DASH_MULT = 1.4;

export const ENABLE_ARM_SWING = false;
export const ARM_SWING_Z_MULT = 0.25; // forearm outward roll factor

// Punch settings
export const PUNCH_ANGLE = 0.9; // radians, max forward extension
export const PUNCH_DURATION = 0.25; // seconds, out+back total time
export const PUNCH_COOLDOWN = 0.15; // seconds between punches
export const PUNCH_HALF_PHASE = 0.5; // normalized half phase for out/back split

// How many outermost columns per row count as arm voxels
// Width-based edge trimming is disabled to avoid losing pixels

// Restrict movement to hands only (outer/lower band of the arm)
export const ARM_SELECT_HAND_ONLY = true; // extract hands instead of full arms
export const ARM_HAND_CELLS_PER_SIDE = 2; // max cells per side (1–2 recommended)
