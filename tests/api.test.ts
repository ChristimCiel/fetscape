import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/src/app';
import { createHash } from 'node:crypto';
const input = {
  datasetId: 'synthetic-lab',
  primaryId: 'SIM-SERVICER',
  startUtc: '2026-11-11T11:15:00Z',
  hours: 1,
  cadenceSeconds: 30,
  thresholdKm: 10,
};
describe('Local API and persisted evidence', () => {
  it('saves analysis and review, exports full evidence and survives reopening SQLite', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbit-test-')),
      path = join(dir, 'test.sqlite');
    let app = createApp({ dbPath: path });
    try {
      const result = await app.inject({ method: 'POST', url: '/api/analyses', payload: input });
      expect(result.statusCode).toBe(201);
      const r = result.json();
      expect(r.events.length).toBeGreaterThan(0);
      expect(r.dataset.kind).toBe('synthetic');
      const decision = await app.inject({
        method: 'POST',
        url: `/api/analyses/${r.id}/decisions`,
        payload: {
          eventId: r.events[0].id,
          author: 'Test analyst',
          note: 'Need covariance before assessing collision probability.',
          action: 'request_data',
        },
      });
      expect(decision.statusCode).toBe(201);
      const wrong = await app.inject({
        method: 'POST',
        url: `/api/analyses/${r.id}/decisions`,
        payload: { eventId: 'fabricated-event', author: 'Test', note: 'invalid', action: 'review' },
      });
      expect(wrong.statusCode).toBe(422);
      const exported = (await app.inject(`/api/analyses/${r.id}/export`)).json();
      expect(exported.analysis.dataset.contentSha256).toHaveLength(64);
      expect(
        createHash('sha256')
          .update(JSON.stringify(exported.analysis.dataset.rawInput))
          .digest('hex'),
      ).toBe(exported.analysis.dataset.contentSha256);
      expect(exported.decisions).toHaveLength(1);
      const report = (await app.inject(`/api/analyses/${r.id}/report`)).body;
      expect(report).toContain('PROBABILITY OF COLLISION: UNAVAILABLE');
      expect(report).toContain('Need covariance');
      expect(report).toContain('synthetic');
      await app.close();
      app = createApp({ dbPath: path });
      expect((await app.inject('/api/analyses')).json()[0].id).toBe(r.id);
      expect((await app.inject(`/api/analyses/${r.id}/decisions`)).json()).toHaveLength(1);
    } finally {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('rejects invalid parameters, unsupported Pc fields, hostile origins and unknown objects', async () => {
    const app = createApp({ dbPath: ':memory:' });
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/analyses',
            payload: { ...input, hours: 100 },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/analyses',
            payload: { ...input, computePc: true },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/analyses',
            headers: { origin: 'https://untrusted.example' },
            payload: input,
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/analyses',
            payload: { ...input, primaryId: 'missing' },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/analyses',
            payload: { ...input, startUtc: '2027-01-01T00:00:00Z' },
          })
        ).statusCode,
      ).toBe(422);
    } finally {
      await app.close();
    }
  });
  it('imports GP JSON, keeps source metadata, refuses unsupported frames and invalid TLE', async () => {
    const app = createApp({ dbPath: ':memory:' });
    try {
      const d = (await app.inject('/api/datasets'))
        .json()
        .find((d: { id: string }) => d.id === 'public-replay');
      const rows = d.objects.slice(0, 2).map((o: { gp: unknown }) => o.gp);
      const payload = {
        name: 'Test import',
        source: 'Analyst supplied fixture',
        format: 'omm',
        data: JSON.stringify(rows),
      };
      const imported = await app.inject({ method: 'POST', url: '/api/datasets/import', payload });
      expect(imported.statusCode).toBe(201);
      expect(imported.json().kind).toBe('user_import');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/datasets/import',
            payload: {
              ...payload,
              data: JSON.stringify([{ ...rows[0], REF_FRAME: 'GCRF' }, rows[1]]),
            },
          })
        ).statusCode,
      ).toBe(422);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/datasets/import',
            payload: { ...payload, format: 'tle', data: 'invalid' },
          })
        ).statusCode,
      ).toBe(422);
    } finally {
      await app.close();
    }
  });
  it('exports target evaluation with exact pair inputs and unknown capture properties', async () => {
    const app = createApp({ dbPath: ':memory:' });
    try {
      const r = await app.inject(
        '/api/targets/report?datasetId=synthetic-lab&servicerId=SIM-SERVICER&targetId=SIM-CROSSING',
      );
      expect(r.statusCode).toBe(200);
      expect(r.body).toContain('Exact normalized pair inputs');
      expect(r.body).toContain('unknown');
    } finally {
      await app.close();
    }
  });
});
