import { estimateDeorbitLifetime } from './deorbit';

export interface RuleAltitudeProfile {
  massKg?: number;
  areaM2?: number;
  inclination?: number;
}

export interface RuleAltitudes {
  h5: number;
  h25: number;
}

/**
 * Bisect altitude (km) where estimated lifetime crosses a target year threshold.
 * Returns altitude rounded to the nearest km (±1 km tolerance).
 */
function bisectAltitudeForYears(
  targetYears: number,
  profile: RuleAltitudeProfile,
  lo = 200,
  hi = 2000,
): number {
  let low = lo;
  let high = hi;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const years = estimateDeorbitLifetime({
      altitudeKm: mid,
      massKg: profile.massKg,
      areaM2: profile.areaM2,
      inclination: profile.inclination,
    }).estimatedLifetimeYears;
    if (years <= targetYears) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const lowYears = estimateDeorbitLifetime({
    altitudeKm: low,
    massKg: profile.massKg,
    areaM2: profile.areaM2,
    inclination: profile.inclination,
  }).estimatedLifetimeYears;
  return lowYears <= targetYears ? low : high;
}

/** Compute FCC 5-yr and NSTC 25-yr altitude thresholds for a mission profile. */
export function ruleAltitudes(profile: RuleAltitudeProfile = {}): RuleAltitudes {
  return {
    h5: bisectAltitudeForYears(5, profile),
    h25: bisectAltitudeForYears(25, profile),
  };
}

export type VerdictState = 'pass' | 'watch' | 'miss';

export function mapVerdict(complies5Year: boolean, complies25Year: boolean): VerdictState {
  if (complies5Year) return 'pass';
  if (complies25Year) return 'watch';
  return 'miss';
}

export function formatLifetimeYears(years: number): string {
  return years >= 1000 ? '1000+' : String(years);
}
