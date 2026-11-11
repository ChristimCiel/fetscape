import type { Analysis, Dataset } from '@orbit/core';
import { assetUrl } from '../deployment';

export interface PublicDemo {
  schemaVersion: 1;
  mode: 'public_readonly';
  datasets: Dataset[];
  analyses: Analysis[];
}

const readonlyMessage =
  'The public demo replays bundled analyses. Run the local edition for new calculations, imports and saved reviews.';

export function resolvePublicRequest(demo: PublicDemo, path: string, body?: unknown): unknown {
  const url = new URL(path, 'https://demo.invalid');
  if (url.search) throw new Error('This request is unavailable in the public demo.');
  if (url.pathname === '/api/datasets' && body === undefined) return demo.datasets;
  if (url.pathname === '/api/analyses') {
    if (body === undefined)
      return demo.analyses.map((run) => ({
        id: run.id,
        createdAt: run.createdAt,
        datasetName: run.dataset.name,
        kind: run.dataset.kind,
        parameters: run.parameters,
        eventCount: run.events.length,
        status: run.coverage.status,
      }));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(readonlyMessage);
    const input = body as Record<string, unknown>;
    const keys = [
      'datasetId',
      'primaryId',
      'startUtc',
      'hours',
      'cadenceSeconds',
      'thresholdKm',
    ] as const;
    if (Object.keys(input).some((key) => !keys.includes(key as (typeof keys)[number])))
      throw new Error(readonlyMessage);
    const selected = demo.analyses.find((run) =>
      keys.every((key) =>
        key === 'startUtc'
          ? typeof input.startUtc === 'string' &&
            Date.parse(input.startUtc) === Date.parse(run.parameters.startUtc)
          : input[key] === run.parameters[key],
      ),
    );
    if (!selected) throw new Error(readonlyMessage);
    return selected;
  }
  if (body !== undefined) throw new Error(readonlyMessage);
  const match = /^\/api\/analyses\/([^/]+)(\/decisions)?$/.exec(url.pathname);
  if (match) {
    const run = demo.analyses.find((run) => run.id === decodeURIComponent(match[1]));
    if (!run) throw new Error('Bundled analysis not found.');
    return match[2] ? [] : run;
  }
  throw new Error(readonlyMessage);
}

let manifest: Promise<PublicDemo> | undefined;
export async function publicApi<T>(path: string, body?: unknown): Promise<T> {
  manifest ??= fetch(assetUrl('demo/manifest.json'))
    .then(async (response) => {
      if (!response.ok) throw new Error('The bundled demo data could not be loaded.');
      const data = (await response.json()) as PublicDemo;
      if (data.schemaVersion !== 1 || data.mode !== 'public_readonly')
        throw new Error('Unsupported public demo data.');
      return data;
    })
    .catch((error) => {
      manifest = undefined;
      throw error;
    });
  return resolvePublicRequest(await manifest, path, body) as T;
}
