/**
 * Opt-in live CelesTrak + SGP4 worker.
 * Uses pure-JS satellite.js (no WASM barrel) so the main Vite client bundle stays clean.
 */

import { json2satrec, propagate } from '../lib/satellite-pure';

export type WorkerRequest =
  | {
      id: string;
      type: 'fetch_and_screen';
      primaryNorad?: number;
      hours?: number;
      thresholdKm?: number;
    }
  | { id: string; type: 'ping' };

export type ApproachRow = {
  targetName: string;
  targetId: string;
  tcaUtc: string;
  missDistanceKm: number;
  relativeVelocityKmS: number;
  isFiltered: boolean;
  note: string;
};

export type LiveSnapshot = {
  primaryName: string;
  startUtc: string;
  hours: number;
  thresholdKm: number;
  approaches: ApproachRow[];
  dataSource: string;
  acquiredAt: string;
  totalScreened: number;
  excludedDocked: string[];
  disclaimer: string;
};

export type WorkerResponse =
  | { id: string; type: 'screen_result'; ok: true; mode: 'live'; snapshot: LiveSnapshot }
  | { id: string; type: 'screen_result'; ok: false; error: string; fallback: 'replay' }
  | { id: string; type: 'pong' };

type GP = {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
};

const DOCKED =
  /^(ISS\b|ZARYA|ZVEZDA|UNITY|DESTINY|HARMONY|TRANQUILITY|COLUMBUS|KIBO|POISK|PIRS|NAUKA|PRICHAL|PROGRESS|SOYUZ|CREW DRAGON|DRAGON)/i;

function meanAltitude(meanMotion: number): number {
  const mu = 398600.4418;
  const n = (meanMotion * 2 * Math.PI) / 86400;
  const a = Math.pow(mu / (n * n), 1 / 3);
  return a - 6378.137;
}

async function fetchGroup(group: string): Promise<GP[]> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`);
  return (await res.json()) as GP[];
}

function toSat(gp: GP) {
  const sat = json2satrec(gp as Parameters<typeof json2satrec>[0]);
  return sat.error === 0 ? sat : null;
}

function sampleMiss(
  a: NonNullable<ReturnType<typeof toSat>>,
  b: NonNullable<ReturnType<typeof toSat>>,
  start: Date,
  hours: number,
  stepSec: number,
) {
  let minD = Infinity;
  let minT: Date | null = null;
  let minV = 0;
  const steps = Math.floor((hours * 3600) / stepSec);
  for (let i = 0; i <= steps; i++) {
    const t = new Date(start.getTime() + i * stepSec * 1000);
    const p1 = propagate(a, t);
    const p2 = propagate(b, t);
    if (!p1?.position || !p2?.position || !p1.velocity || !p2.velocity) continue;
    if (typeof p1.position === 'boolean' || typeof p2.position === 'boolean') continue;
    if (typeof p1.velocity === 'boolean' || typeof p2.velocity === 'boolean') continue;
    const dx = p2.position.x - p1.position.x;
    const dy = p2.position.y - p1.position.y;
    const dz = p2.position.z - p1.position.z;
    const vx = p2.velocity.x - p1.velocity.x;
    const vy = p2.velocity.y - p1.velocity.y;
    const vz = p2.velocity.z - p1.velocity.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (d < minD) {
      minD = d;
      minT = t;
      minV = v;
    }
  }
  if (!minT) return null;
  return { tcaUtc: minT.toISOString(), missDistanceKm: minD, relativeVelocityKmS: minV };
}

async function fetchAndScreen(
  req: Extract<WorkerRequest, { type: 'fetch_and_screen' }>,
): Promise<LiveSnapshot> {
  const catalog = await fetchGroup('stations');
  if (!catalog.length) throw new Error('Empty CelesTrak catalog');

  const primary = catalog.find((o) => o.NORAD_CAT_ID === (req.primaryNorad ?? 25544)) ?? catalog[0];
  const primaryAlt = meanAltitude(primary.MEAN_MOTION);
  const primarySat = toSat(primary);
  if (!primarySat) throw new Error('Primary SGP4 init failed');

  const hours = req.hours ?? 6;
  const thresholdKm = req.thresholdKm ?? 100;
  const start = new Date();
  const excluded: string[] = [];
  const approaches: ApproachRow[] = [];

  const candidates = catalog.filter((o) => {
    if (o.NORAD_CAT_ID === primary.NORAD_CAT_ID) return false;
    if (DOCKED.test(o.OBJECT_NAME.trim())) {
      excluded.push(o.OBJECT_NAME);
      return false;
    }
    if (
      o.MEAN_MOTION === primary.MEAN_MOTION &&
      o.INCLINATION === primary.INCLINATION &&
      o.RA_OF_ASC_NODE === primary.RA_OF_ASC_NODE
    ) {
      excluded.push(o.OBJECT_NAME);
      return false;
    }
    return Math.abs(meanAltitude(o.MEAN_MOTION) - primaryAlt) <= 250;
  });

  for (const secondary of candidates.slice(0, 25)) {
    const sat = toSat(secondary);
    if (!sat) continue;
    const miss = sampleMiss(primarySat, sat, start, hours, 120);
    if (!miss) continue;
    if (miss.missDistanceKm <= thresholdKm * 2) {
      approaches.push({
        targetName: secondary.OBJECT_NAME,
        targetId: `norad-${secondary.NORAD_CAT_ID}`,
        tcaUtc: miss.tcaUtc,
        missDistanceKm: Math.round(miss.missDistanceKm * 1000) / 1000,
        relativeVelocityKmS: Math.round(miss.relativeVelocityKmS * 1000) / 1000,
        isFiltered: miss.missDistanceKm <= thresholdKm,
        note: 'Geometric proximity only. Not Pc.',
      });
    }
  }

  approaches.sort((a, b) => a.missDistanceKm - b.missDistanceKm);

  return {
    primaryName: primary.OBJECT_NAME,
    startUtc: start.toISOString(),
    hours,
    thresholdKm,
    approaches,
    dataSource: 'Live CelesTrak stations + satellite.js SGP4 (Web Worker)',
    acquiredAt: new Date().toISOString(),
    totalScreened: candidates.length,
    excludedDocked: excluded,
    disclaimer:
      'GEOMETRIC PROXIMITY ONLY. Not probability of collision (Pc). Decision support for a qualified operator. No maneuver advice. No commanding.',
  };
}

function reply(message: WorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'ping') {
    reply({ id: msg.id, type: 'pong' });
    return;
  }
  if (msg.type === 'fetch_and_screen') {
    try {
      const snapshot = await fetchAndScreen(msg);
      reply({
        id: msg.id,
        type: 'screen_result',
        ok: true,
        mode: 'live',
        snapshot,
      });
    } catch (error) {
      reply({
        id: msg.id,
        type: 'screen_result',
        ok: false,
        error: (error as Error).message,
        fallback: 'replay',
      });
    }
  }
};
