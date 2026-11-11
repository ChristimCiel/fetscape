import type { State, Vector } from './types.js';
export const norm = (v: Vector) => Math.hypot(...v);
export const subtract = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vector): Vector => a.map((x) => x / norm(a)) as Vector;
/** Radial / along-track / orbit-normal coordinates; no contact or navigation sensor model. */
export function relativeRIC(a: State, b: State): State {
  const r = unit(a.positionKm),
    n = unit(cross(a.positionKm, a.velocityKmS)),
    t = cross(n, r);
  const dr = subtract(b.positionKm, a.positionKm),
    dv = subtract(b.velocityKmS, a.velocityKmS);
  const angularRate = norm(cross(a.positionKm, a.velocityKmS)) / norm(a.positionKm) ** 2;
  const p: Vector = [dot(dr, r), dot(dr, t), dot(dr, n)];
  return {
    positionKm: p,
    velocityKmS: [dot(dv, r) + angularRate * p[1], dot(dv, t) - angularRate * p[0], dot(dv, n)],
  };
}
