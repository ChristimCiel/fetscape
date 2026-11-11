import { beforeAll, describe, expect, it } from 'vitest';
import type { Analysis, Dataset } from '@orbit/core';
import { createApp } from '../apps/api/src/app';
import { resolvePublicRequest } from '../apps/web/src/demo/public-api';
import type { PublicDemo } from '../apps/web/src/demo/public-api';

let demo: PublicDemo;
beforeAll(async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    const datasets = (await app.inject('/api/datasets')).json<Dataset[]>();
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        datasetId: 'public-replay',
        primaryId: 'norad-25544',
        startUtc: datasets[0].referenceStart,
        hours: 24,
        cadenceSeconds: 30,
        thresholdKm: 100,
      },
    });
    expect(response.statusCode).toBe(201);
    demo = {
      schemaVersion: 1,
      mode: 'public_readonly',
      datasets,
      analyses: [response.json<Analysis>()],
    };
  } finally {
    await app.close();
  }
});

describe('Public read-only replay boundary', () => {
  it('returns the API-calculated reference only for exactly matching inputs', () => {
    const run = demo.analyses[0];
    expect(resolvePublicRequest(demo, '/api/analyses', run.parameters)).toBe(run);
    const equivalentUtc = {
      ...run.parameters,
      startUtc: new Date(run.parameters.startUtc).toISOString(),
    };
    expect(resolvePublicRequest(demo, '/api/analyses', equivalentUtc)).toBe(run);
    expect(run.events.find((e) => e.secondaryId === 'norad-66906')?.missDistanceKm).toBeCloseTo(
      80.8,
      0,
    );
  });
  it('rejects changed parameters and additional fields instead of substituting a canned result', () => {
    const parameters = demo.analyses[0].parameters;
    for (const changes of [
      { hours: 1 },
      { primaryId: 'norad-66906' },
      { thresholdKm: 10 },
      { cadenceSeconds: 15 },
      { startUtc: 'invalid' },
      { datasetId: 'unknown' },
      { covariance: [1, 2, 3] },
    ])
      expect(() =>
        resolvePublicRequest(demo, '/api/analyses', { ...parameters, ...changes }),
      ).toThrow(/local edition/);
  });
  it('exposes bundled history without pretending visitor reviews were persisted', () => {
    const run = demo.analyses[0];
    const history = resolvePublicRequest(demo, '/api/analyses') as { id: string }[];
    expect(history[0].id).toBe(run.id);
    expect(resolvePublicRequest(demo, `/api/analyses/${run.id}`)).toBe(run);
    expect(resolvePublicRequest(demo, `/api/analyses/${run.id}/decisions`)).toEqual([]);
    expect(() => resolvePublicRequest(demo, '/api/analyses/unknown')).toThrow(/not found/);
    expect(() =>
      resolvePublicRequest(demo, `/api/analyses/${run.id}/decisions`, {
        author: 'Visitor',
        note: 'This must not be saved.',
      }),
    ).toThrow(/local edition/);
    expect(() => resolvePublicRequest(demo, '/api/datasets/import', {})).toThrow(/local edition/);
  });
});
