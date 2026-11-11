import { fingerprint } from './catalog.js';
import { geometry, propagator, PropagationError } from './propagation.js';
import type { Analysis, Dataset, Encounter, Failure, ScreeningParameters, State } from './types.js';

export const ENGINE_VERSION = 'orbit-core/0.1.0 + satellite.js/7.1.0';
export const LIMITATIONS = [
  'Geometric screening of selected catalog objects only. A distance threshold is not a collision-risk threshold.',
  'No covariance or hard-body radii: Probability of Collision is unavailable. No maneuver recommendation.',
  'GP element accuracy varies by object, epoch age, tracking, drag and unmodeled maneuvers; no universal error bar is inferred.',
  'Cadence-limited search of range-rate crossings. Multiple extrema within one step can be missed; endpoints are not accepted TCAs.',
  'TEME position in km and velocity in km/s; UTC timestamps use JavaScript millisecond resolution. Numerical tolerance is not observation accuracy.',
  'Plot interpolation is for display only. Alerts are visible in this local workspace, without background monitoring or external delivery.',
];
export function findMinima(
  a: (t: number) => State,
  b: (t: number) => State,
  start: number,
  end: number,
  step: number,
  toleranceMs = 20,
) {
  if (
    ![start, end, step, toleranceMs].every(Number.isFinite) ||
    end <= start ||
    step <= 0 ||
    toleranceMs < 1
  )
    throw new Error('Invalid search window');
  let evaluations = 0;
  const failures: Failure[] = [];
  const at = (t: number) => {
    evaluations++;
    try {
      return geometry(a(t), b(t));
    } catch (e) {
      if (!(e instanceof PropagationError)) throw e;
      failures.push({ objectId: e.objectId, utc: e.utc, reason: e.message });
      return null;
    }
  };
  const events: {
    time: number;
    value: ReturnType<typeof geometry>;
    before: number;
    after: number;
    bracket: [number, number];
  }[] = [];
  let previousTime = start,
    previous = at(start);
  while (previousTime < end) {
    const t = Math.min(previousTime + step, end),
      current = at(t);
    if (
      previous &&
      current &&
      previous.derivativeHalfSquaredRange < 0 &&
      current.derivativeHalfSquaredRange >= 0
    ) {
      let l = previousTime,
        r = t,
        valid = true;
      while (r - l > toleranceMs) {
        const m = Math.floor((l + r) / 2),
          v = at(m);
        if (!v) {
          valid = false;
          break;
        }
        if (v.derivativeHalfSquaredRange < 0) l = m;
        else r = m;
      }
      const time = Math.round((l + r) / 2),
        probe = Math.min(1000, time - start, end - time);
      if (valid && time > start && time < end && probe > 0) {
        const v = at(time),
          before = at(time - probe),
          after = at(time + probe);
        if (
          v &&
          before &&
          after &&
          before.derivativeHalfSquaredRange < 0 &&
          after.derivativeHalfSquaredRange > 0 &&
          before.distanceKm > v.distanceKm &&
          after.distanceKm > v.distanceKm
        ) {
          if (!events.length || time - events.at(-1)!.time > toleranceMs * 2)
            events.push({
              time,
              value: v,
              before: before.rangeRateKmS,
              after: after.rangeRateKmS,
              bracket: [previousTime, t],
            });
        }
      }
    }
    previousTime = t;
    previous = current;
  }
  return { events, failures, evaluations };
}
export function screen(
  dataset: Dataset,
  parameters: ScreeningParameters,
  id: string,
  createdAt: string,
): Analysis {
  const primary = dataset.objects.find((o) => o.id === parameters.primaryId);
  if (!primary) throw new Error('Primary object not found');
  const start = Date.parse(parameters.startUtc),
    end = start + parameters.hours * 3600000;
  const pa = propagator(primary),
    events: Encounter[] = [],
    failures: Failure[] = [];
  const exclusions: { objectId: string; reason: string }[] = [],
    seen = new Set([fingerprint(primary)]);
  let evaluations = 0,
    pairsScreened = 0;
  for (const secondary of dataset.objects) {
    if (secondary.id === primary.id) continue;
    const fp = fingerprint(secondary);
    if (seen.has(fp)) {
      exclusions.push({
        objectId: secondary.id,
        reason:
          'Identical mean-element representation already screened; not an independent encounter',
      });
      continue;
    }
    seen.add(fp);
    pairsScreened++;
    const found = findMinima(
      pa,
      propagator(secondary),
      start,
      end,
      parameters.cadenceSeconds * 1000,
    );
    evaluations += found.evaluations;
    failures.push(...found.failures);
    for (const e of found.events)
      events.push({
        id: `${primary.id}:${secondary.id}:${e.time}`,
        primaryId: primary.id,
        secondaryId: secondary.id,
        tcaUtc: new Date(e.time).toISOString(),
        missDistanceKm: e.value.distanceKm,
        relativeVelocityKmS: e.value.relativeVelocityKmS,
        rangeRateBeforeKmS: e.before,
        rangeRateAfterKmS: e.after,
        bracketUtc: e.bracket.map((t) => new Date(t).toISOString()) as [string, string],
        primaryEpochOffsetHours: (e.time - Date.parse(primary.gp.EPOCH)) / 3600000,
        secondaryEpochOffsetHours: (e.time - Date.parse(secondary.gp.EPOCH)) / 3600000,
        matchesGeometryThreshold: e.value.distanceKm <= parameters.thresholdKm,
      });
  }
  events.sort((a, b) => a.missDistanceKm - b.missDistanceKm);
  const trajectories: Analysis['trajectories'] = {};
  const sampleStep = 120000;
  for (const o of dataset.objects) {
    const p = propagator(o);
    trajectories[o.id] = [];
    for (let t = start; t <= end; t = Math.min(t + sampleStep, end)) {
      try {
        const s = p(t);
        trajectories[o.id].push({ utc: new Date(t).toISOString(), ...s });
      } catch (e) {
        if (!(e instanceof PropagationError)) throw e;
        failures.push({ objectId: o.id, utc: e.utc, reason: e.message });
      }
      if (t === end) break;
    }
  }
  return {
    id,
    createdAt,
    engineVersion: ENGINE_VERSION,
    dataset,
    parameters,
    endUtc: new Date(end).toISOString(),
    frame: 'TEME',
    timeSystem: 'UTC',
    events,
    trajectories,
    coverage: {
      status: failures.length ? 'partial' : 'sampled',
      pairsScreened,
      evaluations,
      failures,
      exclusions,
    },
    limitations: LIMITATIONS,
  };
}
