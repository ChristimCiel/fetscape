/**
 * Fetscape v1 MVP - Deorbit Lifetime Estimator
 * Simplified atmospheric drag model for compliance screening
 */

export interface DeorbitEstimate {
  estimatedLifetimeYears: number;
  complies25Year: boolean;
  complies5Year: boolean;
  method: string;
  assumptions: string[];
  uncertainties: string[];
  dataInputs: {
    altitudeKm: number;
    ballisticCoefficient?: number;
    inclination?: number;
    eccentricity?: number;
  };
}

const EARTH_RADIUS_KM = 6378.137;

/**
 * Simplified King-Hele approximation for circular orbits
 * Based on atmospheric density and ballistic coefficient
 * NOT A VALIDATED OPERATIONAL MODEL
 */
function kingHeleLifetime(
  altitudeKm: number,
  ballisticCoeff: number, // kg/m^2 (mass / (Cd * area))
  inclination: number = 0,
): number {
  if (altitudeKm < 200) return 0.01; // weeks
  if (altitudeKm > 2000) return 1000; // centuries+

  // Very simplified empirical model for quick estimates
  // Real models need solar flux, atmospheric models, etc.

  // At ~400km, typical small sat with B~100 decays in 1-3 years
  // At ~500km, typical small sat decays in 5-10 years
  // At ~600km, typical small sat decays in 10-25 years
  // At ~800km+, can exceed 25 years

  const referenceAlt = 500;
  const referenceLifetime = 7; // years at 500km for B=100
  const scaleHeight = 50; // km (decay timescale doubles roughly every 50km)

  // Adjust for ballistic coefficient (higher B = slower decay)
  const ballisticFactor = ballisticCoeff / 100.0;

  // Exponential scaling with altitude
  const altitudeFactor = Math.exp((altitudeKm - referenceAlt) / scaleHeight);

  const lifetime = referenceLifetime * altitudeFactor * ballisticFactor;

  return Math.max(0.01, Math.min(1000, lifetime));
}

export function estimateDeorbitLifetime(params: {
  altitudeKm: number;
  massKg?: number;
  areaM2?: number;
  Cd?: number;
  inclination?: number;
  eccentricity?: number;
}): DeorbitEstimate {
  const assumptions: string[] = [];
  const uncertainties: string[] = [];

  let ballisticCoeff: number;

  if (params.massKg && params.areaM2) {
    const Cd = params.Cd ?? 2.2; // Typical drag coefficient
    ballisticCoeff = params.massKg / (params.areaM2 * Cd);
    assumptions.push(`Drag coefficient Cd = ${Cd.toFixed(1)}`);
  } else {
    // Default for small satellites without known properties
    ballisticCoeff = 100; // Typical for small sats
    assumptions.push('Assumed ballistic coefficient B = 100 kg/m² (typical small satellite)');
    uncertainties.push('Actual mass and cross-sectional area unknown');
  }

  assumptions.push('Circular orbit approximation');
  assumptions.push('No propulsion or active deorbit');
  assumptions.push('Solar activity at moderate levels');
  assumptions.push('No atmospheric perturbations from solar storms');

  if (params.eccentricity && params.eccentricity > 0.01) {
    uncertainties.push(
      `Eccentricity ${params.eccentricity.toFixed(4)} may significantly affect decay`,
    );
  }

  uncertainties.push('Atmospheric density model is simplified');
  uncertainties.push('Solar activity variations not modeled');
  uncertainties.push('Actual lifetime may vary by factor of 2-5×');

  const lifetime = kingHeleLifetime(params.altitudeKm, ballisticCoeff, params.inclination ?? 0);

  return {
    estimatedLifetimeYears: Math.round(lifetime * 10) / 10,
    complies25Year: lifetime <= 25,
    complies5Year: lifetime <= 5,
    method: 'Simplified empirical atmospheric drag model (screening estimate only)',
    assumptions,
    uncertainties,
    dataInputs: {
      altitudeKm: params.altitudeKm,
      ballisticCoefficient: ballisticCoeff,
      inclination: params.inclination,
      eccentricity: params.eccentricity,
    },
  };
}

export function getComplianceStatus(estimate: DeorbitEstimate): {
  status: 'compliant' | 'marginal' | 'non-compliant';
  message: string;
  applicableRules: string[];
} {
  const applicableRules: string[] = [];

  if (estimate.complies5Year) {
    applicableRules.push('FCC 5-year post-mission disposal (PMD) requirement');
    applicableRules.push('台灣 NSTC 25-year LEO removal guideline');
    return {
      status: 'compliant',
      message:
        'Mission profile appears to comply with both FCC 5-year and NSTC 25-year requirements based on simplified analysis.',
      applicableRules,
    };
  }

  if (estimate.complies25Year) {
    applicableRules.push('台灣 NSTC 25-year LEO removal guideline');
    return {
      status: 'marginal',
      message:
        'Mission profile may comply with NSTC 25-year requirement but exceeds FCC 5-year limit. Detailed analysis and active deorbit plan required.',
      applicableRules,
    };
  }

  return {
    status: 'non-compliant',
    message:
      'Estimated lifetime exceeds both FCC 5-year and NSTC 25-year limits. Active propulsion system or deployment at lower altitude required.',
    applicableRules: ['FCC 5-year PMD', 'NSTC 25-year LEO removal'],
  };
}
