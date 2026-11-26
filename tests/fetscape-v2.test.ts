/**
 * Fetscape v2 — Orbit Instrument helpers
 */

import { describe, it, expect } from 'vitest';
import {
  ruleAltitudes,
  mapVerdict,
  formatLifetimeYears,
} from '../apps/web/src/fetscape/tools/ruleAltitudes';
import { estimateDeorbitLifetime } from '../apps/web/src/fetscape/tools/deorbit';
import { computeReadiness } from '../apps/web/src/fetscape/readiness';
import { DEMO_MISSIONS } from '../apps/web/src/fetscape/demo-data';
import { SafetyLinter } from '../apps/web/src/fetscape/safety/linter';
import { allSuiteStrings } from '../apps/web/src/suite/i18n';

describe('ruleAltitudes', () => {
  it('returns FCC 5-yr ≈483 km and NSTC 25-yr ≈564 km for default profile (±1)', () => {
    const { h5, h25 } = ruleAltitudes({
      massKg: DEMO_MISSIONS[0].mass,
      inclination: DEMO_MISSIONS[0].orbit.inclination,
    });
    expect(h5).toBeGreaterThanOrEqual(482);
    expect(h5).toBeLessThanOrEqual(484);
    expect(h25).toBeGreaterThanOrEqual(563);
    expect(h25).toBeLessThanOrEqual(565);
  });

  it('is monotonic with lifetime (higher altitude → longer years)', () => {
    const { h5, h25 } = ruleAltitudes({ massKg: 10, inclination: 97.5 });
    const y5 = estimateDeorbitLifetime({
      altitudeKm: h5,
      massKg: 10,
      inclination: 97.5,
    }).estimatedLifetimeYears;
    const y25 = estimateDeorbitLifetime({
      altitudeKm: h25,
      massKg: 10,
      inclination: 97.5,
    }).estimatedLifetimeYears;
    expect(y5).toBeLessThanOrEqual(5);
    expect(y25).toBeLessThanOrEqual(25);
    expect(h25).toBeGreaterThan(h5);
    expect(y25).toBeGreaterThan(y5);
  });
});

describe('verdict mapper', () => {
  it('returns pass / watch / miss by altitude for default inclination', () => {
    const base = DEMO_MISSIONS[0];
    const at = (alt: number) => {
      const r = computeReadiness({ ...base, orbit: { ...base.orbit, altitude: alt } });
      return mapVerdict(r.complies5Year, r.complies25Year);
    };
    expect(at(450)).toBe('pass');
    expect(at(510)).toBe('watch');
    expect(at(620)).toBe('miss');
  });
});

describe('lifetime formatter', () => {
  it('returns 1000+ at the model cap', () => {
    expect(formatLifetimeYears(1000)).toBe('1000+');
    expect(formatLifetimeYears(8.5)).toBe('8.5');
  });
});

describe('SafetyLinter over v2.* strings', () => {
  it('reports zero violations', () => {
    const linter = new SafetyLinter();
    const v2 = allSuiteStrings().filter((s) => s.key.startsWith('v2.'));
    expect(v2.length).toBeGreaterThan(40);
    for (const s of v2) {
      expect(linter.lint(s.value), `${s.lang}.${s.key}: ${s.value}`).toEqual([]);
    }
  });
});
