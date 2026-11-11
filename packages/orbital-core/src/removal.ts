import type { OrbitalObject } from './types.js';
const MU = 398600.4418;
export const semiMajorAxisKm = (meanMotionRevDay: number) =>
  Math.cbrt(MU / ((meanMotionRevDay * 2 * Math.PI) / 86400) ** 2);
export function planeAngleDeg(a: OrbitalObject, b: OrbitalObject): number {
  const rad = Math.PI / 180,
    i = a.gp.INCLINATION * rad,
    j = b.gp.INCLINATION * rad,
    d = (a.gp.RA_OF_ASC_NODE - b.gp.RA_OF_ASC_NODE) * rad;
  return (
    Math.acos(
      Math.max(
        -1,
        Math.min(1, Math.cos(i) * Math.cos(j) + Math.sin(i) * Math.sin(j) * Math.cos(d)),
      ),
    ) / rad
  );
}
export function evaluateTarget(servicer: OrbitalObject, target: OrbitalObject) {
  const r1 = semiMajorAxisKm(servicer.gp.MEAN_MOTION),
    r2 = semiMajorAxisKm(target.gp.MEAN_MOTION);
  const angle = planeAngleDeg(servicer, target),
    supported = Math.max(servicer.gp.ECCENTRICITY, target.gp.ECCENTRICITY) <= 0.02;
  const transferA = (r1 + r2) / 2;
  const hohmann = supported
    ? Math.abs(Math.sqrt(MU / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1)) +
      Math.abs(Math.sqrt(MU / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2))))
    : null;
  const planeProxy = supported ? 2 * Math.sqrt(MU / r1) * Math.sin((angle * Math.PI) / 360) : null;
  return {
    targetId: target.id,
    semiMajorAxisKm: r2,
    meanAltitudeProxyKm: r2 - 6378.137,
    planeAngleDeg: angle,
    circularHohmannDeltaVKmS: hohmann,
    standalonePlaneChangeDeltaVKmS: planeProxy,
    halfTransferTimeSeconds: supported ? Math.PI * Math.sqrt(transferA ** 3 / MU) : null,
    model: supported ? 'circular_impulsive_educational_proxy' : 'unsupported_eccentricity',
    missing: [
      'Target mass, geometry and inertia',
      'Rotation / tumble and capture interface',
      'Owner permission and removal authorization',
      'Servicer thrust, propulsion, navigation and capture envelope',
      'Phasing, launch epoch, finite thrust, power and communications',
      'Post-capture coupled dynamics and verified disposal trajectory',
    ],
    caveat:
      'Separate idealized circular two-body proxies, not a rendezvous solution, total mission delta-v, target ranking score, or proof of reachability. SGP4 mean elements at their respective epochs are approximate inputs; they are not aligned to a common epoch.',
  };
}
