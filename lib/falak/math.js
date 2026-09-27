export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function toRad(value) {
  return value * DEG;
}

export function toDeg(value) {
  return value * RAD;
}

export function normalize360(value) {
  return ((value % 360) + 360) % 360;
}

export function normalize180(value) {
  const n = normalize360(value);
  return n > 180 ? n - 360 : n;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
