export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function normalizeAngle(a: number) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

