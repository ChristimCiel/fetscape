import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Analysis, Dataset } from '@orbit/core';
import { createApp } from '../apps/api/src/app';

const root = fileURLToPath(new URL('../apps/web/public/demo/', import.meta.url));
rmSync(root, { recursive: true, force: true });
mkdirSync(`${root}/reports`, { recursive: true });
mkdirSync(`${root}/targets`, { recursive: true });
const app = createApp({ dbPath: ':memory:' });
try {
  const datasets = (await app.inject('/api/datasets')).json<Dataset[]>();
  const analyses: Analysis[] = [];
  for (const dataset of datasets) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        datasetId: dataset.id,
        primaryId: dataset.objects[0].id,
        startUtc: new Date(dataset.referenceStart).toISOString(),
        hours: 24,
        cadenceSeconds: 30,
        thresholdKm: 100,
      },
    });
    if (response.statusCode !== 201) throw new Error(response.body);
    const run = response.json<Analysis>();
    if (run.coverage.status === 'partial')
      throw new Error(`Cannot publish a partial reference replay: ${dataset.id}`);
    analyses.push(run);
    for (const suffix of ['report', 'export']) {
      const download = await app.inject(`/api/analyses/${run.id}/${suffix}`);
      if (download.statusCode !== 200) throw new Error(download.body);
      writeFileSync(
        `${root}/reports/${run.id}.${suffix === 'report' ? 'txt' : 'json'}`,
        download.body,
      );
    }
    for (const target of dataset.objects.slice(1)) {
      const query = new URLSearchParams({
        datasetId: dataset.id,
        servicerId: run.parameters.primaryId,
        targetId: target.id,
      });
      const response = await app.inject(`/api/targets/report?${query}`);
      if (response.statusCode !== 200) throw new Error(response.body);
      const filename = [dataset.id, run.parameters.primaryId, target.id]
        .map(encodeURIComponent)
        .join('--');
      writeFileSync(`${root}/targets/${filename}.txt`, response.body);
    }
  }
  writeFileSync(
    `${root}/manifest.json`,
    JSON.stringify({ schemaVersion: 1, mode: 'public_readonly', datasets, analyses }),
  );
  console.log(
    `Exported ${analyses.length} API-calculated reference replays with sampled coverage.`,
  );
} finally {
  await app.close();
}
