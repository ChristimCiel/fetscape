import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analysisReport,
  ENGINE_VERSION,
  evaluateTarget,
  normalizeOMM,
  normalizeTLE,
  propagator,
  screen,
  utcEpoch,
} from '@orbit/core';
import type { Dataset } from '@orbit/core';
import { bundledDatasets, digest } from './datasets.js';
import { Store } from './store.js';

const parameterSchema = z
  .object({
    datasetId: z.string().max(100),
    primaryId: z.string().max(100),
    startUtc: z.iso.datetime(),
    hours: z.number().int().min(1).max(24),
    cadenceSeconds: z.number().int().min(15).max(120).default(30),
    thresholdKm: z.number().finite().min(0.1).max(2000).default(100),
  })
  .strict();
const importSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    source: z.string().trim().min(1).max(250),
    format: z.enum(['omm', 'tle']),
    data: z.union([z.string().max(500000), z.array(z.unknown()).max(24)]),
  })
  .strict();
const decisionSchema = z
  .object({
    eventId: z.string().min(1).max(250),
    action: z.enum(['review', 'request_data', 'coordinate']),
    author: z.string().trim().min(1).max(80),
    note: z.string().trim().min(1).max(4000),
  })
  .strict();
export function createApp(options: { dbPath?: string; logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1024 * 1024,
    requestTimeout: 15000,
  });
  const store = new Store(options.dbPath ?? '.local/orbit.sqlite');
  for (const d of bundledDatasets()) store.seed(d);
  app.addHook('onClose', async () => {
    store.close();
  });
  // Local browser writes only. No permissive CORS, remote bind, credentials, or external fetch endpoint.
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))
      return reply.code(403).send({ error: 'Only loopback browser origins are allowed' });
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Input validation failed',
        details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    const e = error as Error & { statusCode?: number };
    if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message });
    app.log.error(error);
    return reply
      .code(500)
      .send({ error: 'Analysis failed. Review the input or server log; no result was saved.' });
  });
  const getRun = (id: string) => store.analysis(id);
  app.get('/api/health', async () => ({
    status: 'ok',
    engine: ENGINE_VERSION,
    mode: 'local_research',
    liveMonitoring: false,
  }));
  app.get('/api/datasets', async () => store.datasets());
  app.post('/api/datasets/import', async (req, reply) => {
    const input = importSchema.parse(req.body);
    let objects;
    try {
      const rows =
        typeof input.data === 'string' && input.format === 'omm'
          ? JSON.parse(input.data)
          : input.data;
      objects =
        input.format === 'omm' ? normalizeOMM(rows) : normalizeTLE(z.string().parse(input.data));
      for (const o of objects) propagator(o)(Date.parse(o.gp.EPOCH));
    } catch (e) {
      return reply.code(422).send({
        error:
          e instanceof ZodError
            ? 'Invalid OMM fields or unsupported metadata'
            : (e as Error).message,
      });
    }
    const d: Dataset = {
      id: `import-${randomUUID()}`,
      name: input.name,
      source: input.source,
      sourceUrl: null,
      kind: 'user_import',
      acquiredAt: new Date().toISOString(),
      referenceStart: new Date(
        Math.max(...objects.map((o) => Date.parse(o.gp.EPOCH))),
      ).toISOString(),
      contentSha256: digest(input.data),
      inputFormat: input.format,
      rawInput: input.data,
      objects,
    };
    store.seed(d);
    return reply.code(201).send(d);
  });
  app.post('/api/analyses', async (req, reply) => {
    const p = parameterSchema.parse(req.body),
      dataset = store.dataset(p.datasetId);
    if (!dataset) return reply.code(404).send({ error: 'Dataset not found' });
    const primary = dataset.objects.find((o) => o.id === p.primaryId);
    if (!primary) return reply.code(404).send({ error: 'Primary object not found' });
    utcEpoch(p.startUtc);
    const start = Date.parse(p.startUtc),
      epoch = Date.parse(primary.gp.EPOCH);
    if (
      Math.max(Math.abs(start - epoch), Math.abs(start + p.hours * 3600000 - epoch)) >
      7 * 86400000
    )
      return reply.code(422).send({
        error:
          'This prototype limits analysis to ±7 days of the primary epoch. This limit is not an accuracy guarantee.',
      });
    const run = screen(dataset, p, randomUUID(), new Date().toISOString());
    store.saveAnalysis(run);
    return reply.code(201).send(run);
  });
  app.get('/api/analyses', async () => store.history());
  app.get<{ Params: { id: string } }>(
    '/api/analyses/:id',
    async (req, reply) =>
      getRun(req.params.id) ?? reply.code(404).send({ error: 'Analysis not found' }),
  );
  app.get<{ Params: { id: string } }>('/api/analyses/:id/decisions', async (req, reply) =>
    getRun(req.params.id)
      ? store.decisions(req.params.id)
      : reply.code(404).send({ error: 'Analysis not found' }),
  );
  app.post<{ Params: { id: string } }>('/api/analyses/:id/decisions', async (req, reply) => {
    const input = decisionSchema.parse(req.body),
      run = getRun(req.params.id);
    if (!run) return reply.code(404).send({ error: 'Analysis not found' });
    if (!run.events.some((e) => e.id === input.eventId))
      return reply.code(422).send({ error: 'Event does not belong to this analysis' });
    const d = {
      ...input,
      id: randomUUID(),
      analysisId: run.id,
      createdAt: new Date().toISOString(),
    };
    store.saveDecision(d);
    return reply.code(201).send(d);
  });
  app.get<{ Params: { id: string } }>('/api/analyses/:id/report', async (req, reply) => {
    const run = getRun(req.params.id);
    if (!run) return reply.code(404).send({ error: 'Analysis not found' });
    return reply
      .type('text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="orbit-${run.id}.txt"`)
      .send(analysisReport(run, store.decisions(run.id)));
  });
  app.get<{ Params: { id: string } }>('/api/analyses/:id/export', async (req, reply) => {
    const run = getRun(req.params.id);
    if (!run) return reply.code(404).send({ error: 'Analysis not found' });
    return reply
      .header('Content-Disposition', `attachment; filename="orbit-${run.id}.json"`)
      .send({ schemaVersion: 1, analysis: run, decisions: store.decisions(run.id) });
  });
  app.get<{ Querystring: { datasetId?: string; servicerId?: string } }>(
    '/api/targets',
    async (req, reply) => {
      const d = store.dataset(req.query.datasetId ?? '');
      const s = d?.objects.find((o) => o.id === req.query.servicerId);
      if (!d || !s) return reply.code(404).send({ error: 'Dataset or reference object not found' });
      return {
        datasetId: d.id,
        kind: d.kind,
        targets: d.objects.filter((o) => o.id !== s.id).map((o) => evaluateTarget(s, o)),
      };
    },
  );
  app.get<{ Querystring: { datasetId?: string; servicerId?: string; targetId?: string } }>(
    '/api/targets/report',
    async (req, reply) => {
      const d = store.dataset(req.query.datasetId ?? ''),
        s = d?.objects.find((o) => o.id === req.query.servicerId),
        t = d?.objects.find((o) => o.id === req.query.targetId);
      if (!d || !s || !t || s.id === t.id)
        return reply.code(404).send({ error: 'Dataset or distinct object pair not found' });
      const result = evaluateTarget(s, t);
      return reply
        .type('text/plain; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="orbit-target-brief.txt"')
        .send(
          [
            'Fetscape — Preliminary target geometry brief',
            `Generated: ${new Date().toISOString()}`,
            `Engine: ${ENGINE_VERSION}`,
            `Source: ${d.source}`,
            `Data classification: ${d.kind}`,
            `Input SHA-256: ${d.contentSha256}`,
            `Reference: ${s.name} (${s.id}); epoch ${s.gp.EPOCH}`,
            `Candidate: ${t.name} (${t.id}); epoch ${t.gp.EPOCH}`,
            `Epoch difference: ${((Date.parse(t.gp.EPOCH) - Date.parse(s.gp.EPOCH)) / 3600000).toFixed(2)} h; elements are not transported to a common epoch for these proxies.`,
            JSON.stringify(result, null, 2),
            '\nExact normalized pair inputs:',
            JSON.stringify({ reference: s, target: t }, null, 2),
            '\nMass, size, rotation and removal eligibility are unknown. No capture, disposal or rendezvous feasibility has been established.',
          ].join('\n'),
        );
    },
  );
  const root = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(root)) {
    app.register(staticPlugin, { root });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'API route not found' })
        : reply.type('text/html').sendFile('index.html'),
    );
  }
  return app;
}
