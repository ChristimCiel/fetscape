import type { Analysis, Decision } from './types.js';
export function analysisReport(run: Analysis, decisions: Decision[]): string {
  const names = new Map(run.dataset.objects.map((o) => [o.id, o.name]));
  return [
    'Fetscape — Geometric analysis record',
    `Run: ${run.id}`,
    `Created: ${run.createdAt}`,
    `Engine: ${run.engineVersion}`,
    `Data classification: ${run.dataset.kind}`,
    `Source: ${run.dataset.source}`,
    `Source URL: ${run.dataset.sourceUrl ?? 'none (local/synthetic)'}`,
    `Acquired: ${run.dataset.acquiredAt}`,
    `Input SHA-256: ${run.dataset.contentSha256}`,
    `Window: ${run.parameters.startUtc} → ${run.endUtc}`,
    `Frame / time: TEME / UTC`,
    `Cadence: ${run.parameters.cadenceSeconds} s; numerical bracket tolerance: 20 ms (not observational accuracy)`,
    `User geometry threshold: ${run.parameters.thresholdKm} km; not a collision-risk threshold`,
    `Coverage: ${run.coverage.status}; pairs: ${run.coverage.pairsScreened}; failed samples: ${run.coverage.failures.length}; exclusions: ${run.coverage.exclusions.length}`,
    '\nLOCAL MINIMA (up to 30 shown; complete results in JSON)',
    ...run.events
      .slice(0, 30)
      .map(
        (e) =>
          `${e.tcaUtc} | ${names.get(e.secondaryId)} | miss ${e.missDistanceKm.toFixed(1)} km | relative speed ${e.relativeVelocityKmS.toFixed(3)} km/s | epoch offsets ${e.primaryEpochOffsetHours.toFixed(1)} / ${e.secondaryEpochOffsetHours.toFixed(1)} h`,
      ),
    '\nPROBABILITY OF COLLISION: UNAVAILABLE — covariance and hard-body radii are absent.',
    'PHYSICAL PROPERTIES: mass, dimensions and tumble are unknown from these elements.',
    '\nHUMAN REVIEW RECORDS (local author labels are not authenticated identities)',
    ...decisions.map(
      (d) => `${d.createdAt} | ${d.author} | ${d.action} | event ${d.eventId}\n${d.note}`,
    ),
    '\nLIMITATIONS',
    ...run.limitations.map((x) => `- ${x}`),
    '\nThis local research prototype does not issue spacecraft commands or operational safety determinations.',
  ].join('\n');
}
