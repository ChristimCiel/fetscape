/**
 * Fetscape v1 MVP - CelesTrak GP Data Fetcher
 * Browser-based fetch with CORS support
 * Respects usage policy: same GROUP at most once per 2h
 */

export interface GPObject {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

interface FetchOptions {
  group: 'stations' | 'active' | 'analyst' | 'starlink';
  format?: 'json' | 'tle';
}

const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const cache = new Map<string, { data: GPObject[]; timestamp: number }>();

export async function fetchGPData(options: FetchOptions): Promise<GPObject[]> {
  const cacheKey = `${options.group}-${options.format ?? 'json'}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[CelesTrak] Using cached data for ${cacheKey}`);
    return cached.data;
  }

  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${options.group}&FORMAT=json`;

  try {
    console.log(`[CelesTrak] Fetching ${options.group}...`);
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('CelesTrak rate limit exceeded. Wait at least 2 hours before retry.');
      }
      throw new Error(`CelesTrak fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GPObject[];

    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    console.log(`[CelesTrak] Fetched ${data.length} objects from ${options.group}`);
    return data;
  } catch (error) {
    console.error(`[CelesTrak] Fetch error:`, error);
    throw error;
  }
}

export function calculateMeanAltitude(meanMotion: number): number {
  const mu = 398600.4418; // Earth gravitational parameter km^3/s^2
  const n = (meanMotion * (2 * Math.PI)) / 86400; // Convert rev/day to rad/s
  const a = Math.pow(mu / (n * n), 1 / 3); // Semi-major axis
  return a - 6378.137; // Subtract Earth radius
}

export function filterByAltitude(
  objects: GPObject[],
  minAltKm: number,
  maxAltKm: number,
): GPObject[] {
  return objects.filter((obj) => {
    const alt = calculateMeanAltitude(obj.MEAN_MOTION);
    return alt >= minAltKm && alt <= maxAltKm;
  });
}

export function countByAltitudeBin(
  objects: GPObject[],
  binSizeKm: number = 50,
): { altitudeKm: number; count: number }[] {
  const bins = new Map<number, number>();

  for (const obj of objects) {
    const alt = calculateMeanAltitude(obj.MEAN_MOTION);
    const binKey = Math.floor(alt / binSizeKm) * binSizeKm;
    bins.set(binKey, (bins.get(binKey) ?? 0) + 1);
  }

  return Array.from(bins.entries())
    .map(([altitudeKm, count]) => ({ altitudeKm, count }))
    .sort((a, b) => a.altitudeKm - b.altitudeKm);
}

export interface DensityAnalysis {
  targetAltitudeKm: number;
  objectsInShell: number;
  shellRangeKm: [number, number];
  nearbyBins: { altitudeKm: number; count: number }[];
  totalActive: number;
  dataSource: string;
  acquiredAt: string;
}

export async function analyzeShellDensity(
  targetAltitudeKm: number,
  shellThicknessKm: number = 50,
): Promise<DensityAnalysis> {
  const objects = await fetchGPData({ group: 'active' });

  const minAlt = targetAltitudeKm - shellThicknessKm / 2;
  const maxAlt = targetAltitudeKm + shellThicknessKm / 2;

  const inShell = filterByAltitude(objects, minAlt, maxAlt);
  const bins = countByAltitudeBin(objects, 50);

  const nearbyBins = bins.filter(
    (b) => b.altitudeKm >= targetAltitudeKm - 200 && b.altitudeKm <= targetAltitudeKm + 200,
  );

  return {
    targetAltitudeKm,
    objectsInShell: inShell.length,
    shellRangeKm: [minAlt, maxAlt],
    nearbyBins,
    totalActive: objects.length,
    dataSource: 'CelesTrak active satellites',
    acquiredAt: new Date().toISOString(),
  };
}
