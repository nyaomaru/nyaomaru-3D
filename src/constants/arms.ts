// 腕の抽出は胴体の上〜中段の帯域に限定（上からの比率）
export const ARM_BAND_TOP_RATIO = 0.58;   // 胴体上部付近（頭より下）
export const ARM_BAND_BOTTOM_RATIO = 0.72; // 腰より上で狭めに

// X 方向は各行の外縁からの距離（行幅ベースの割合）
// より外側（耳ではなく腕の縁）だけ拾う
export const ARM_THRESHOLD_MIN_RATIO = 0.0;  // 端そのものを含める
export const ARM_THRESHOLD_MAX_RATIO = 0.12; // 端から2〜3列程度に限定
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

// 手先だけを動かしたい場合の絞り込み
export const ARM_SELECT_HAND_ONLY = true; // 腕ではなく手（外縁の下側）だけ抽出
export const ARM_HAND_CELLS_PER_SIDE = 2; // 片側あたり最大セル数（1〜2 推奨）
