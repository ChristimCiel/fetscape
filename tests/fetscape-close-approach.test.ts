/**
 * Close-approach geometric screening + docked/same-object exclusion
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getReplayCloseApproachSnapshot } from '../apps/web/src/fetscape/tools/close-approach-replay';
import {
  excludeDockedAndSameObject,
  screenCloseApproachesFromCatalog,
} from '../apps/web/src/fetscape/tools/close-approach-sgp4';
import type { GPObject } from '../apps/web/src/fetscape/tools/celestrak';

const publicOmm = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/public-omm.json', import.meta.url)), 'utf8'),
) as GPObject[];

describe('excludeDockedAndSameObject', () => {
  it('excludes ISS modules and identical-element copies', () => {
    const primary = publicOmm.find((o) => o.OBJECT_NAME.includes('DUPLEX')) ?? publicOmm[0];
    const { kept, excluded } = excludeDockedAndSameObject(publicOmm, primary);
    expect(excluded.some((o) => /ISS|POISK|ZARYA/i.test(o.OBJECT_NAME))).toBe(true);
    expect(kept.every((o) => o.NORAD_CAT_ID !== primary.NORAD_CAT_ID)).toBe(true);
    expect(kept.every((o) => !/^ISS\b/i.test(o.OBJECT_NAME))).toBe(true);
  });
});

describe('screenCloseApproachesFromCatalog', () => {
  it('runs SGP4 geometric screening and labels output as geometric only', () => {
    const primary = publicOmm.find((o) => o.OBJECT_NAME.includes('ISS')) ?? publicOmm[0];
    const snapshot = screenCloseApproachesFromCatalog({
      primary,
      catalog: publicOmm,
      startUtc: '2026-11-11T12:00:00.000Z',
      hours: 1,
      cadenceSeconds: 120,
      thresholdKm: 2000,
      maxSecondaries: 10,
    });

    expect(snapshot.disclaimer).toMatch(/GEOMETRIC SCREENING ONLY/i);
    expect(snapshot.disclaimer).toMatch(/Not probability of collision/);
    expect(snapshot.excludedDocked?.length).toBeGreaterThan(0);
    for (const a of snapshot.approaches) {
      expect(a.note).toContain('Geometric screening only');
      expect(a.note).not.toMatch(/collision risk/i);
      expect(Number.isFinite(a.missDistanceKm)).toBe(true);
    }
  });
});

describe('getReplayCloseApproachSnapshot', () => {
  it('returns bundled replay without network', () => {
    const snap = getReplayCloseApproachSnapshot();
    expect(snap.approaches.length).toBeGreaterThan(0);
    expect(snap.disclaimer).toContain('GEOMETRIC SCREENING ONLY');
  });
});
