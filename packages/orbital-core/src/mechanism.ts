/** Authored kinematic rig: scene coordinates, never measured spacecraft geometry. */
export type Point3 = [number, number, number];
export const ARM_RIG = {
  base: [0, -0.77, -0.76] as Point3,
  shoulder: [0, -0.27, -0.73] as Point3,
  elbow: [0, 0.65, -0.24] as Point3,
  wrist: [0, 0.31, 0.65] as Point3,
  upperJaw: [0, 0.4, 0.73] as Point3,
  lowerJaw: [0, 0.2, 0.73] as Point3,
  contact: [0, 0.3, 0.92] as Point3,
  source: 'caging-arm / Mesh_0',
  basis: 'authored pivots and weights from visual inspection; not CAD or hardware calibration',
};
export const COLLECTOR_RIG = [
  { name: 'model_part3', pivot: [-0.28, 0.14, 0.24] as Point3, sign: -1 },
  { name: 'model_part4', pivot: [0.29, 0.14, 0.24] as Point3, sign: 1 },
];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, t: number) => {
  const f = clamp((t - a) / (b - a));
  return f * f * (3 - 2 * f);
};
export function mechanismCycle(progress: number) {
  const p = clamp(progress);
  return {
    stage:
      p >= 1
        ? 'secured'
        : p >= 0.88
          ? 'verify latch'
          : p >= 0.7
            ? 'close collector'
            : p >= 0.48
              ? 'retract to cradle'
              : p >= 0.28
                ? 'track & grasp'
                : 'deploy arms',
    deploy: smooth(0, 0.2, p),
    tracking: smooth(0.12, 0.29, p),
    fingerClosure: smooth(0.28, 0.48, p),
    attached: p >= 0.48,
    retraction: smooth(0.48, 0.72, p),
    collectorClosure: smooth(0.7, 0.9, p),
    latch: smooth(0.9, 1, p),
  };
}
/** Angles measured from +Z toward +Y, elbow-up solution. Returns a reachability flag. */
export function solvePlanarArm(y: number, z: number, upper: number, lower: number) {
  if (![y, z, upper, lower].every(Number.isFinite) || upper <= 0 || lower <= 0)
    throw new Error('Invalid arm geometry');
  const actualDistance = Math.hypot(y, z),
    minimum = Math.abs(upper - lower) + 1e-6,
    maximum = upper + lower - 1e-6;
  const distance = clamp(actualDistance, minimum, maximum);
  const factor = distance / Math.max(actualDistance, 1e-12);
  y *= factor;
  z *= factor;
  const elbow = -Math.acos(
    clamp((distance * distance - upper * upper - lower * lower) / (2 * upper * lower), -1, 1),
  );
  const shoulder =
    Math.atan2(y, z) - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
  return {
    shoulder,
    elbow,
    reachable: actualDistance >= minimum && actualDistance <= maximum,
    reachError: Math.abs(actualDistance - distance),
  };
}
export function armEndpoint(shoulder: number, elbow: number, upper: number, lower: number) {
  return {
    y: upper * Math.sin(shoulder) + lower * Math.sin(shoulder + elbow),
    z: upper * Math.cos(shoulder) + lower * Math.cos(shoulder + elbow),
  };
}
export function graspPointVelocity(linear: Point3, omegaRadS: Point3, offset: Point3): Point3 {
  return [
    linear[0] + omegaRadS[1] * offset[2] - omegaRadS[2] * offset[1],
    linear[1] + omegaRadS[2] * offset[0] - omegaRadS[0] * offset[2],
    linear[2] + omegaRadS[0] * offset[1] - omegaRadS[1] * offset[0],
  ];
}
