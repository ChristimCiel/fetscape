import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeTLE, propagator, norm, subtract } from '@orbit/core';
import { bundledDatasets } from '../apps/api/src/datasets';
import reference from '../tests/fixtures/sgp4-reference.json';
const input = readFileSync(new URL('../data/public-omm.json', import.meta.url));
if (createHash('sha256').update(input).digest('hex') !== reference.inputFileSha256)
  throw new Error('Reference input hash changed. Regenerate and review independent fixtures.');
const objects = [
  ...bundledDatasets()[0].objects,
  ...normalizeTLE(reference.tlePairs.flat().join('\n')),
];
const results = reference.cases.map((c) => {
  const o = objects.find((o) => o.catalogId === c.catalogId)!;
  const s = propagator(o)(Date.parse(c.utc));
  const positionDeltaM =
      norm(subtract(s.positionKm, c.positionKm as [number, number, number])) * 1000,
    velocityDeltaMS =
      norm(subtract(s.velocityKmS, c.velocityKmS as [number, number, number])) * 1000;
  const pass =
    positionDeltaM < (c.type === 'omm' ? 10 : 0.1) &&
    velocityDeltaMS < (c.type === 'omm' ? 0.02 : 0.001);
  return {
    type: c.type,
    catalogId: c.catalogId,
    utc: c.utc,
    positionDeltaM,
    velocityDeltaMS,
    pass,
  };
});
mkdirSync('.local', { recursive: true });
writeFileSync(
  '.local/reference-validation.json',
  JSON.stringify(
    {
      status: results.every((r) => r.pass) ? 'passed' : 'failed',
      reference: reference.library,
      version: reference.version,
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      states: results.length,
      maxPositionDeltaM: Math.max(...results.map((r) => r.positionDeltaM)),
      maxVelocityDeltaMS: Math.max(...results.map((r) => r.velocityDeltaMS)),
      allPassed: results.every((r) => r.pass),
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.pass)) process.exitCode = 1;
