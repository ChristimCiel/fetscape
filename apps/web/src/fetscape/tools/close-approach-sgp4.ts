/**
 * Node / test SGP4 geometric screening.
 * Do not import this from browser UI modules — satellite.js WASM breaks the Vite client build.
 */

import { json2satrec, propagate } from 'satellite.js';
import type { GPObject } from './celestrak';
import { calculateMeanAltitude, filterByAltitude } from './celestrak';
import type { CloseApproach } from '../types';
import type { CloseApproachSnapshot } from './close-approach-replay';

const DOCKED_NAME =
  /^(ISS\b|ZARYA|ZVEZDA|UNITY|DESTINY|HARMONY|TRANQUILITY|COLUMBUS|KIBO|POISK|PIRS|NAUKA|PRICHAL|PROGRESS|SOYUZ|CREW DRAGON|DRAGON)/i;

export function excludeDockedAndSameObject(
  objects: GPObject[],
  primary: GPObject,
): { kept: GPObject[]; excluded: GPObject[] } {
  const excluded: GPObject[] = [];
  const kept: GPObject[] = [];
  for (const obj of objects) {
    if (obj.NORAD_CAT_ID === primary.NORAD_CAT_ID) {
      excluded.push(obj);
      continue;
    }
    if (DOCKED_NAME.test(obj.OBJECT_NAME.trim())) {
      excluded.push(obj);
      continue;
    }
    if (
      obj.MEAN_MOTION === primary.MEAN_MOTION &&
      obj.INCLINATION === primary.INCLINATION &&
      obj.RA_OF_ASC_NODE === primary.RA_OF_ASC_NODE &&
      obj.ECCENTRICITY === primary.ECCENTRICITY &&
      obj.ARG_OF_PERICENTER === primary.ARG_OF_PERICENTER &&
      obj.MEAN_ANOMALY === primary.MEAN_ANOMALY
    ) {
      excluded.push(obj);
      continue;
    }
    kept.push(obj);
  }
  return { kept, excluded };
}

function gpToSatrec(gp: GPObject) {
  const satrec = json2satrec({
    OBJECT_NAME: gp.OBJECT_NAME,
    OBJECT_ID: gp.OBJECT_ID,
    NORAD_CAT_ID: gp.NORAD_CAT_ID,
    EPOCH: gp.EPOCH,
    MEAN_MOTION: gp.MEAN_MOTION,
    ECCENTRICITY: gp.ECCENTRICITY,
    INCLINATION: gp.INCLINATION,
    RA_OF_ASC_NODE: gp.RA_OF_ASC_NODE,
    ARG_OF_PERICENTER: gp.ARG_OF_PERICENTER,
    MEAN_ANOMALY: gp.MEAN_ANOMALY,
    BSTAR: gp.BSTAR,
    MEAN_MOTION_DOT: gp.MEAN_MOTION_DOT,
    MEAN_MOTION_DDOT: gp.MEAN_MOTION_DDOT,
    EPHEMERIS_TYPE: gp.EPHEMERIS_TYPE,
    CLASSIFICATION_TYPE: gp.CLASSIFICATION_TYPE,
    ELEMENT_SET_NO: gp.ELEMENT_SET_NO,
    REV_AT_EPOCH: gp.REV_AT_EPOCH,
  } as Parameters<typeof json2satrec>[0]);
  if (satrec.error !== 0) return null;
  return satrec;
}

function sampleMiss(
  primary: ReturnType<typeof json2satrec>,
  secondary: ReturnType<typeof json2satrec>,
  start: Date,
  hours: number,
  cadenceSeconds: number,
): { tcaUtc: string; missDistanceKm: number; relativeVelocityKmS: number } | null {
  const steps = Math.floor((hours * 3600) / cadenceSeconds);
  let minDistance = Infinity;
  let minTime: Date | null = null;
  let minVelocity = 0;

  for (let i = 0; i <= steps; i++) {
    const t = new Date(start.getTime() + i * cadenceSeconds * 1000);
    const p1 = propagate(primary, t);
    const p2 = propagate(secondary, t);
    if (!p1?.position || !p2?.position || !p1.velocity || !p2.velocity) continue;
    if (typeof p1.position === 'boolean' || typeof p2.position === 'boolean') continue;
    if (typeof p1.velocity === 'boolean' || typeof p2.velocity === 'boolean') continue;

    const dr = {
      x: p2.position.x - p1.position.x,
      y: p2.position.y - p1.position.y,
      z: p2.position.z - p1.position.z,
    };
    const dv = {
      x: p2.velocity.x - p1.velocity.x,
      y: p2.velocity.y - p1.velocity.y,
      z: p2.velocity.z - p1.velocity.z,
    };
    const distance = Math.sqrt(dr.x * dr.x + dr.y * dr.y + dr.z * dr.z);
    const velocity = Math.sqrt(dv.x * dv.x + dv.y * dv.y + dv.z * dv.z);
    if (distance < minDistance) {
      minDistance = distance;
      minTime = t;
      minVelocity = velocity;
    }
  }

  if (!minTime || !Number.isFinite(minDistance)) return null;
  return {
    tcaUtc: minTime.toISOString(),
    missDistanceKm: minDistance,
    relativeVelocityKmS: minVelocity,
  };
}

export function screenCloseApproachesFromCatalog(params: {
  primary: GPObject;
  catalog: GPObject[];
  startUtc: string;
  hours: number;
  cadenceSeconds?: number;
  thresholdKm?: number;
  maxSecondaries?: number;
}): CloseApproachSnapshot {
  const {
    primary,
    catalog,
    startUtc,
    hours,
    cadenceSeconds = 60,
    thresholdKm = 100,
    maxSecondaries = 40,
  } = params;

  const primaryAlt = calculateMeanAltitude(primary.MEAN_MOTION);
  const nearby = filterByAltitude(catalog, primaryAlt - 200, primaryAlt + 200);
  const { kept, excluded } = excludeDockedAndSameObject(nearby, primary);
  const primarySat = gpToSatrec(primary);
  if (!primarySat) {
    throw new Error(`SGP4 init failed for primary ${primary.OBJECT_NAME}`);
  }

  const approaches: CloseApproach[] = [];
  for (const secondary of kept.slice(0, maxSecondaries)) {
    const secondarySat = gpToSatrec(secondary);
    if (!secondarySat) continue;
    const tca = sampleMiss(primarySat, secondarySat, new Date(startUtc), hours, cadenceSeconds);
    if (!tca) continue;
    if (tca.missDistanceKm <= thresholdKm * 2) {
      approaches.push({
        targetName: secondary.OBJECT_NAME,
        targetId: `norad-${secondary.NORAD_CAT_ID}`,
        tcaUtc: tca.tcaUtc,
        missDistanceKm: Math.round(tca.missDistanceKm * 1000) / 1000,
        relativeVelocityKmS: Math.round(tca.relativeVelocityKmS * 1000) / 1000,
        isFiltered: tca.missDistanceKm <= thresholdKm,
        note: 'Geometric screening only. Not Pc.',
      });
    }
  }

  approaches.sort((a, b) => a.missDistanceKm - b.missDistanceKm);

  return {
    primaryName: primary.OBJECT_NAME,
    startUtc,
    hours,
    thresholdKm,
    approaches,
    dataSource: 'Local GP catalog + satellite.js SGP4 (geometric screening only)',
    acquiredAt: new Date().toISOString(),
    totalScreened: kept.length,
    excludedDocked: excluded.map((o) => o.OBJECT_NAME),
    disclaimer:
      'GEOMETRIC SCREENING ONLY. Not probability of collision (Pc). Requires covariance data and licensed SSA provider for operational conjunction assessment.',
  };
}
