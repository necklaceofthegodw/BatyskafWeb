export interface V3 {
  x: number;
  y: number;
  z: number;
}
export const v = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V3, s: number): V3 => v(a.x * s, a.y * s, a.z * s);
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const dist = (a: V3, b: V3) => len(sub(a, b));
export const norm = (a: V3): V3 => mul(a, 1 / Math.max(1e-8, len(a)));
export const cross = (a: V3, b: V3) =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const direction = (yaw: number, pitch: number) =>
  v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function closestOnSegment(p: V3, a: V3, b: V3) {
  const d = sub(b, a),
    t = clamp(dot(sub(p, a), d) / Math.max(1e-8, dot(d, d)), 0, 1);
  const point = add(a, mul(d, t));
  return { point, t, distance: dist(p, point) };
}
export function pathLengths(path: V3[]) {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + dist(path[i], path[i - 1]));
  return lengths;
}
export function closestOnPath(p: V3, path: V3[], lengths = pathLengths(path)) {
  let best = { point: path[0], distance: Infinity, along: 0, index: 0, tangent: v(0, 0, 1) };
  for (let i = 1; i < path.length; i++) {
    const c = closestOnSegment(p, path[i - 1], path[i]);
    if (c.distance < best.distance)
      best = {
        ...c,
        along: lengths[i - 1] + c.t * (lengths[i] - lengths[i - 1]),
        index: i - 1,
        tangent: norm(sub(path[i], path[i - 1])),
      };
  }
  return best;
}
export function alongPath(path: V3[], lengths: number[], s: number) {
  s = clamp(s, 0, lengths[lengths.length - 1]);
  const i = Math.max(
    1,
    lengths.findIndex((n) => n >= s),
  );
  return mix(
    path[i - 1],
    path[i],
    (s - lengths[i - 1]) / Math.max(0.001, lengths[i] - lengths[i - 1]),
  );
}
export function hermite(a: V3, b: V3, ta: V3, tb: V3, t: number) {
  const t2 = t * t,
    t3 = t2 * t;
  return add(
    add(mul(a, 2 * t3 - 3 * t2 + 1), mul(ta, t3 - 2 * t2 + t)),
    add(mul(b, -2 * t3 + 3 * t2), mul(tb, t3 - t2)),
  );
}
export function smoothPath(points: V3[], samples = 6) {
  const out: V3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      ta = mul(sub(b, points[Math.max(0, i - 1)]), 0.5),
      tb = mul(sub(points[Math.min(points.length - 1, i + 2)], a), 0.5);
    for (let j = 0; j < samples; j++) out.push(hermite(a, b, ta, tb, j / samples));
  }
  return [...out, points[points.length - 1]];
}
