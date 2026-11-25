/**
 * Fetscape v1 MVP - Close Approach Screening
 * End-to-end: CelesTrak → SGP4 → Geometric screening → Filtering
 */

import * as satellite from 'satellite.js';
import type { GPObject } from './celestrak';
import { fetchGPData, filterByAltitude } from './celestrak';
import { filterDocked } from '../safety/linter';
import type { CloseApproach } from '../types';

interface ScreeningParams {
  primaryName: string;
  primaryGP: GPObject;
  startUtc: string;
  hours: number;
  cadenceSeconds?: number;
  thresholdKm?: number;
}

interface TCAResult {
  tcaUtc: string;
  missDistanceKm: number;
  relativeVelocityKmS: number;
}

export async function screenCloseApproaches(params: ScreeningParams): Promise<CloseApproach[]> {
  const {
    primaryName,
    primaryGP,
    startUtc,
    hours,
    cadenceSeconds = 60,
    thresholdKm = 100,
  } = params;

  // Fetch active satellites in nearby altitude range
  const primaryAlt = calculateMeanAltitude(primaryGP.MEAN_MOTION);
  const objects = await fetchGPData({ group: 'active' });

  // Filter to objects in relevant altitude range (±200 km)
  const nearby = filterByAltitude(objects, primaryAlt - 200, primaryAlt + 200);

  // Filter out ISS docked modules and same-object artifacts
  const filtered = filterDocked(
    nearby.map((o) => ({
      name: o.OBJECT_NAME,
      catalogId: o.NORAD_CAT_ID.toString(),
    })),
  );
  const filteredIds = new Set(filtered.map((f) => f.catalogId ?? f.name));
  const secondaries = nearby.filter((o) => filteredIds.has(o.NORAD_CAT_ID.toString()));

  // Exclude primary from secondaries
  const candidates = secondaries.filter((o) => o.NORAD_CAT_ID !== primaryGP.NORAD_CAT_ID);

  console.log(`[CloseApproach] Screening ${candidates.length} objects against ${primaryName}`);

  // Convert to satrec objects
  const primarySatrec = gpToSatrec(primaryGP);
  if (!primarySatrec) {
    throw new Error('Failed to initialize primary satellite SGP4');
  }

  const approaches: CloseApproach[] = [];

  // Screen each candidate
  for (const secondary of candidates.slice(0, 50)) {
    // Limit to 50 for performance
    const secondarySatrec = gpToSatrec(secondary);
    if (!secondarySatrec) continue;

    const tca = findTCA(primarySatrec, secondarySatrec, new Date(startUtc), hours, cadenceSeconds);

    if (tca && tca.missDistanceKm <= thresholdKm * 2) {
      // Include 2x threshold for context
      approaches.push({
        targetName: secondary.OBJECT_NAME,
        targetId: `norad-${secondary.NORAD_CAT_ID}`,
        tcaUtc: tca.tcaUtc,
        missDistanceKm: tca.missDistanceKm,
        relativeVelocityKmS: tca.relativeVelocityKmS,
        isFiltered: tca.missDistanceKm <= thresholdKm,
        note: 'Geometric screening only. Not Pc.',
      });
    }
  }

  // Sort by miss distance
  approaches.sort((a, b) => a.missDistanceKm - b.missDistanceKm);

  return approaches;
}

function calculateMeanAltitude(meanMotion: number): number {
  const mu = 398600.4418; // km^3/s^2
  const n = (meanMotion * 2 * Math.PI) / 86400; // rad/s
  const a = Math.pow(mu / (n * n), 1 / 3);
  return a - 6378.137; // Earth radius
}

function gpToSatrec(gp: GPObject): satellite.SatRec | null {
  try {
    const satrec = satellite.twoline2satrec(
      gp.OBJECT_NAME,
      `1 ${gp.NORAD_CAT_ID}U ${gp.OBJECT_ID} ${gp.EPOCH} ${gp.MEAN_MOTION_DOT} ${gp.MEAN_MOTION_DDOT} ${gp.BSTAR} 0 ${gp.ELEMENT_SET_NO}`,
      `2 ${gp.NORAD_CAT_ID} ${gp.INCLINATION} ${gp.RA_OF_ASC_NODE} ${gp.ECCENTRICITY} ${gp.ARG_OF_PERICENTER} ${gp.MEAN_ANOMALY} ${gp.MEAN_MOTION}${gp.REV_AT_EPOCH}`,
    );

    if (satrec.error) {
      console.warn(`SGP4 init error for ${gp.OBJECT_NAME}:`, satrec.error);
      return null;
    }

    return satrec;
  } catch (error) {
    console.warn(`Failed to initialize ${gp.OBJECT_NAME}:`, error);
    return null;
  }
}

function findTCA(
  primary: satellite.SatRec,
  secondary: satellite.SatRec,
  startDate: Date,
  hours: number,
  cadenceSeconds: number,
): TCAResult | null {
  const steps = Math.floor((hours * 3600) / cadenceSeconds);
  let minDistance = Infinity;
  let minTime: Date | null = null;
  let minVelocity = 0;

  for (let i = 0; i <= steps; i++) {
    const t = new Date(startDate.getTime() + i * cadenceSeconds * 1000);

    const p1 = satellite.propagate(primary, t);
    const p2 = satellite.propagate(secondary, t);

    if (
      p1.error ||
      p2.error ||
      !p1.position ||
      !p2.position ||
      typeof p1.position === 'boolean' ||
      typeof p2.position === 'boolean' ||
      !p1.velocity ||
      !p2.velocity ||
      typeof p1.velocity === 'boolean' ||
      typeof p2.velocity === 'boolean'
    ) {
      continue;
    }

    const r1 = p1.position;
    const r2 = p2.position;
    const v1 = p1.velocity;
    const v2 = p2.velocity;

    const dr = {
      x: r2.x - r1.x,
      y: r2.y - r1.y,
      z: r2.z - r1.z,
    };

    const dv = {
      x: v2.x - v1.x,
      y: v2.y - v1.y,
      z: v2.z - v1.z,
    };

    const distance = Math.sqrt(dr.x * dr.x + dr.y * dr.y + dr.z * dr.z);
    const velocity = Math.sqrt(dv.x * dv.x + dv.y * dv.y + dv.z * dv.z);

    if (distance < minDistance) {
      minDistance = distance;
      minTime = t;
      minVelocity = velocity;
    }
  }

  if (minTime && minDistance < Infinity) {
    return {
      tcaUtc: minTime.toISOString(),
      missDistanceKm: minDistance,
      relativeVelocityKmS: minVelocity,
    };
  }

  return null;
}

export interface CloseApproachSnapshot {
  primaryName: string;
  startUtc: string;
  hours: number;
  thresholdKm: number;
  approaches: CloseApproach[];
  dataSource: string;
  acquiredAt: string;
  totalScreened: number;
  disclaimer: string;
}

export async function createSnapshot(params: ScreeningParams): Promise<CloseApproachSnapshot> {
  const approaches = await screenCloseApproaches(params);

  return {
    primaryName: params.primaryName,
    startUtc: params.startUtc,
    hours: params.hours,
    thresholdKm: params.thresholdKm ?? 100,
    approaches,
    dataSource: 'CelesTrak active satellites + satellite.js SGP4',
    acquiredAt: new Date().toISOString(),
    totalScreened: approaches.length,
    disclaimer:
      'GEOMETRIC SCREENING ONLY. Not probability of collision (Pc). Requires covariance data and licensed SSA provider for operational conjunction assessment.',
  };
}
