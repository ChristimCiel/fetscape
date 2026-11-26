/**
 * Derive readiness tiles from deterministic tools for a mission profile.
 */

import type { MissionProfile } from './types';
import { estimateDeorbitLifetime } from './tools/deorbit';
import { getBundledDerelictCatalog } from './tools/debris-ranking';
import { calculateMeanAltitude } from './tools/celestrak';

export interface ReadinessResult {
  lifetimeYears: number;
  lifetimeRange: [number, number];
  complies25Year: boolean;
  complies5Year: boolean;
  shellObjects: number;
  shellAltitudeKm: number;
  shellSnapshotDate: string;
  shellSource: string;
  method: string;
  assumptions: string[];
  uncertainties: string[];
}

/** Approximate shell count from bundled derelict snapshot near the mission altitude. */
function shellCountNear(
  altitudeKm: number,
  halfWidthKm = 25,
): {
  count: number;
  source: string;
  acquiredAt: string;
} {
  const { objects, meta } = getBundledDerelictCatalog();
  const count = objects.filter((o) => {
    const alt = calculateMeanAltitude(o.MEAN_MOTION);
    return Math.abs(alt - altitudeKm) <= halfWidthKm;
  }).length;
  // Scale illustration: snapshot is sparse; report catalog-relative count honestly.
  return {
    count,
    source: meta.source,
    acquiredAt: meta.acquiredAt,
  };
}

export function computeReadiness(profile: MissionProfile): ReadinessResult {
  const altitude = profile.orbit.altitude ?? 500;
  const deorbit = estimateDeorbitLifetime({
    altitudeKm: altitude,
    massKg: profile.mass,
    inclination: profile.orbit.inclination,
    eccentricity: profile.orbit.eccentricity,
  });
  const shell = shellCountNear(altitude);
  const years = deorbit.estimatedLifetimeYears;
  return {
    lifetimeYears: years,
    lifetimeRange: [
      Math.max(0.01, Math.round((years / 3) * 10) / 10),
      Math.min(1000, Math.round(years * 3 * 10) / 10),
    ],
    complies25Year: deorbit.complies25Year,
    complies5Year: deorbit.complies5Year,
    shellObjects: shell.count,
    shellAltitudeKm: altitude,
    shellSnapshotDate: shell.acquiredAt.slice(0, 10),
    shellSource: shell.source,
    method: deorbit.method,
    assumptions: deorbit.assumptions,
    uncertainties: deorbit.uncertainties,
  };
}
