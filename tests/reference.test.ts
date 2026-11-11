import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeTLE, propagator, norm, subtract } from '@orbit/core';
import { bundledDatasets } from '../apps/api/src/datasets';
import reference from './fixtures/sgp4-reference.json';
it('agrees with 18 independent python-sgp4 states at declared precision limits', () => {
  const bytes = readFileSync(new URL('../data/public-omm.json', import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(reference.inputFileSha256);
  const objects = [
    ...bundledDatasets()[0].objects,
    ...normalizeTLE(reference.tlePairs.flat().join('\n')),
  ];
  expect(reference.cases).toHaveLength(18);
  for (const c of reference.cases) {
    const state = propagator(objects.find((o) => o.catalogId === c.catalogId)!)(Date.parse(c.utc));
    const expectedPosition = c.positionKm as [number, number, number],
      expectedVelocity = c.velocityKmS as [number, number, number];
    expect(
      norm(subtract(state.positionKm, expectedPosition)) * 1000,
      `${c.catalogId} position`,
    ).toBeLessThan(c.type === 'omm' ? 10 : 0.1);
    expect(
      norm(subtract(state.velocityKmS, expectedVelocity)) * 1000,
      `${c.catalogId} velocity`,
    ).toBeLessThan(c.type === 'omm' ? 0.02 : 0.001);
  }
});
