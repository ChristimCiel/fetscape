import { z } from 'zod';
import { twoline2satrec } from 'satellite.js';
import type { GP, OrbitalObject } from './types.js';

const numeric = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
  z.number().finite(),
);
const bounded = (min: number, max: number) => numeric.pipe(z.number().min(min).max(max));
export function utcEpoch(text: string): string {
  // GP JSON omits Z because UTC is implicit. Reject offsets and leap seconds.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:[0-5]\d(?:\.\d{1,9})?Z?$/.test(text))
    throw new Error('Expected ISO UTC epoch; leap seconds and offsets are unsupported');
  const normalized = text.endsWith('Z') ? text : text + 'Z';
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 19) !== text.slice(0, 19))
    throw new Error('Invalid UTC calendar date');
  return normalized;
}
const gpSchema = z.object({
  OBJECT_NAME: z.string().trim().min(1).max(120),
  OBJECT_ID: z.string().max(80).default(''),
  NORAD_CAT_ID: numeric.pipe(z.number().int().min(0).max(999999999)),
  EPOCH: z.string().transform((s, ctx) => {
    try {
      return utcEpoch(s);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid UTC epoch' });
      return z.NEVER;
    }
  }),
  MEAN_MOTION: bounded(0.01, 20),
  ECCENTRICITY: bounded(0, 0.999999),
  INCLINATION: bounded(0, 180),
  RA_OF_ASC_NODE: bounded(0, 360),
  ARG_OF_PERICENTER: bounded(0, 360),
  MEAN_ANOMALY: bounded(0, 360),
  BSTAR: numeric.default(0),
  MEAN_MOTION_DOT: numeric.default(0),
  MEAN_MOTION_DDOT: numeric.default(0),
  EPHEMERIS_TYPE: z.literal(0).default(0),
  CLASSIFICATION_TYPE: z.enum(['U', 'C']).default('U'),
  ELEMENT_SET_NO: numeric.default(0),
  REV_AT_EPOCH: numeric.default(0),
  CENTER_NAME: z.literal('EARTH').default('EARTH'),
  REF_FRAME: z.literal('TEME').default('TEME'),
  TIME_SYSTEM: z.literal('UTC').default('UTC'),
  MEAN_ELEMENT_THEORY: z.literal('SGP4').default('SGP4'),
});
const unknownPhysical = () => ({
  massKg: null,
  sizeM: null,
  tumbleRadS: null,
  basis: 'not_in_orbital_elements' as const,
});
export function normalizeOMM(rows: unknown, syntheticIds?: string[]): OrbitalObject[] {
  const parsed = z.array(gpSchema).min(2).max(24).parse(rows);
  const ids = new Set<string>();
  return parsed.map((gp, index) => {
    if (!syntheticIds && gp.NORAD_CAT_ID === 0)
      throw new Error('Public/imported catalog IDs must be positive');
    const id = syntheticIds?.[index] ?? `norad-${gp.NORAD_CAT_ID}`;
    if (!id || ids.has(id)) throw new Error('Duplicate or missing object identifier');
    ids.add(id);
    return {
      id,
      name: gp.OBJECT_NAME,
      catalogId: syntheticIds ? null : gp.NORAD_CAT_ID,
      gp,
      physical: unknownPhysical(),
    };
  });
}
export function tleChecksum(line: string): boolean {
  return (
    line.length === 69 &&
    /^\d$/.test(line[68]) &&
    [...line.slice(0, 68)].reduce(
      (sum, c) => sum + (/\d/.test(c) ? Number(c) : c === '-' ? 1 : 0),
      0,
    ) %
      10 ===
      Number(line[68])
  );
}
export function decodeCatalogId(raw: string): number {
  if (/^\d{5}$/.test(raw)) return Number(raw);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const prefix = alphabet.indexOf(raw[0]);
  if (prefix < 0 || !/^\d{4}$/.test(raw.slice(1))) throw new Error('Unsupported TLE catalog ID');
  return (prefix + 10) * 10000 + Number(raw.slice(1));
}
export function normalizeTLE(text: string): OrbitalObject[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter((s) => s.trim());
  const objects: OrbitalObject[] = [];
  for (let i = 0; i < lines.length;) {
    const name = lines[i].startsWith('1 ') ? '' : lines[i++].replace(/^0 /, '').trim();
    const a = lines[i++],
      b = lines[i++];
    if (!a?.startsWith('1 ') || !b?.startsWith('2 ') || !tleChecksum(a) || !tleChecksum(b))
      throw new Error('Malformed TLE or checksum mismatch');
    if (a.slice(2, 7) !== b.slice(2, 7)) throw new Error('Mismatched TLE catalog IDs');
    const id = decodeCatalogId(a.slice(2, 7));
    const sat = twoline2satrec(a, b);
    if (sat.error) throw new Error(`Invalid TLE initialization: ${sat.error}`);
    const rad = 180 / Math.PI;
    const epoch = new Date((sat.jdsatepoch - 2440587.5) * 86400000).toISOString();
    const gp: GP = {
      OBJECT_NAME: name || `NORAD ${id}`,
      OBJECT_ID: '',
      NORAD_CAT_ID: id,
      EPOCH: epoch,
      MEAN_MOTION: Number(b.slice(52, 63)),
      ECCENTRICITY: sat.ecco,
      INCLINATION: sat.inclo * rad,
      RA_OF_ASC_NODE: sat.nodeo * rad,
      ARG_OF_PERICENTER: sat.argpo * rad,
      MEAN_ANOMALY: sat.mo * rad,
      BSTAR: sat.bstar,
      MEAN_MOTION_DOT: Number(a.slice(33, 43)),
      MEAN_MOTION_DDOT: Number(
        `${a[44] === '-' ? '-' : ''}0.${a.slice(45, 50)}e${a.slice(50, 52)}`,
      ),
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: z.enum(['U', 'C']).parse(a[7]),
      ELEMENT_SET_NO: 0,
      REV_AT_EPOCH: 0,
      CENTER_NAME: 'EARTH',
      REF_FRAME: 'TEME',
      TIME_SYSTEM: 'UTC',
      MEAN_ELEMENT_THEORY: 'SGP4',
    };
    objects.push({
      id: `norad-${id}`,
      name: gp.OBJECT_NAME,
      catalogId: id,
      gp,
      tle: [a, b],
      physical: unknownPhysical(),
    });
  }
  if (
    objects.length < 2 ||
    objects.length > 24 ||
    new Set(objects.map((o) => o.id)).size !== objects.length
  )
    throw new Error('Import requires 2–24 unique objects');
  return objects;
}
export function fingerprint(object: OrbitalObject): string {
  const g = object.gp;
  const epoch = g.EPOCH.replace(/Z$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  return JSON.stringify([
    epoch,
    g.MEAN_MOTION,
    g.ECCENTRICITY,
    g.INCLINATION,
    g.RA_OF_ASC_NODE,
    g.ARG_OF_PERICENTER,
    g.MEAN_ANOMALY,
    g.BSTAR,
    g.MEAN_MOTION_DOT,
    g.MEAN_MOTION_DDOT,
  ]);
}
