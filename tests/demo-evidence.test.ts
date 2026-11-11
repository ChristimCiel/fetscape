import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import evidence from '../data/verification/weak-thrust-seed7.json';
import script from '../docs/pitch/SOURCE.json';
it('matches the selected Fetscape script, source provenance and exact final endpoints', () => {
  expect(script.selected).toContain('Fetscape');
  expect(evidence.scenario).toBe('weak_thrust');
  expect(evidence.seed).toBe(7);
  expect(evidence.sourceSha256).toBe(script.frozenModelSourceSha256);
  expect(evidence.baseline.final_range_m).toBeCloseTo(59.52010643477721, 10);
  expect(evidence.revised.final_range_m).toBeCloseTo(129.76978101130004, 10);
  expect(evidence.baseline.samples.at(-1)?.t).toBe(650);
  expect(evidence.revised.samples.at(-1)?.t).toBe(650);
  expect(
    readFileSync('data/verification/weak-thrust-seed7.json').equals(
      readFileSync('apps/web/public/verification/weak-thrust-seed7.json'),
    ),
  ).toBe(true);
});
