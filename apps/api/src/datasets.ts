import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeOMM } from '@orbit/core';
import type { Dataset } from '@orbit/core';
export const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function bundledDatasets(): Dataset[] {
  const rows = JSON.parse(
    readFileSync(new URL('../../../data/public-omm.json', import.meta.url), 'utf8'),
  );
  const meta = JSON.parse(
    readFileSync(new URL('../../../data/provenance.json', import.meta.url), 'utf8'),
  );
  const base = {
    OBJECT_NAME: 'SIM-SERVICER',
    OBJECT_ID: '',
    NORAD_CAT_ID: 0,
    EPOCH: '2026-11-11T12:00:00Z',
    MEAN_MOTION: 15.3,
    ECCENTRICITY: 0.0001,
    INCLINATION: 51.6,
    RA_OF_ASC_NODE: 20,
    ARG_OF_PERICENTER: 0,
    MEAN_ANOMALY: 0,
    BSTAR: 0,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  };
  const simulated = [
    base,
    { ...base, OBJECT_NAME: 'SIM-CROSSING', MEAN_MOTION: 15.29, INCLINATION: 61.6 },
    {
      ...base,
      OBJECT_NAME: 'SIM-NEAR-PLANE',
      MEAN_MOTION: 15.1,
      RA_OF_ASC_NODE: 20.5,
      MEAN_ANOMALY: 70,
    },
    {
      ...base,
      OBJECT_NAME: 'SIM-POLAR',
      MEAN_MOTION: 14.8,
      INCLINATION: 98,
      RA_OF_ASC_NODE: 100,
      MEAN_ANOMALY: 120,
    },
  ];
  return [
    {
      id: 'public-replay',
      name: 'Public elements · frozen replay',
      kind: 'public_elements',
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      acquiredAt: meta.acquiredAt,
      referenceStart: meta.referenceStart,
      contentSha256: digest(rows),
      inputFormat: 'omm',
      rawInput: rows,
      objects: normalizeOMM(rows),
    },
    {
      id: 'synthetic-lab',
      name: 'Synthetic orbital laboratory',
      kind: 'synthetic',
      source:
        'Constructed fictional GP-compatible elements; no observations or real catalog identities',
      sourceUrl: null,
      acquiredAt: base.EPOCH,
      referenceStart: base.EPOCH,
      contentSha256: digest(simulated),
      inputFormat: 'omm',
      rawInput: simulated,
      objects: normalizeOMM(simulated, [
        'SIM-SERVICER',
        'SIM-CROSSING',
        'SIM-NEAR-PLANE',
        'SIM-POLAR',
      ]),
    },
  ];
}
