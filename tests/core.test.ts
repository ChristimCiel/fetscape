import { describe, it, expect } from 'vitest';
import {
  normalizeOMM,
  normalizeTLE,
  utcEpoch,
  decodeCatalogId,
  propagator,
  findMinima,
  geometry,
  temeToEcef,
  relativeRIC,
  evaluateTarget,
  planeAngleDeg,
  screen,
  PropagationError,
} from '@orbit/core';
import type { State } from '@orbit/core';
import { bundledDatasets } from '../apps/api/src/datasets';
const datasets = bundledDatasets(),
  real = datasets[0],
  sim = datasets[1];
const zero: State = { positionKm: [0, 0, 0], velocityKmS: [0, 0, 0] };
const vanguard = [
  '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
  '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
];
const second = [
  '1 04632U 70093B   04031.91070959 -.00000084  00000-0  10000-3 0  9955',
  '2 04632  11.4628 273.1101 1450506 207.6000 143.9350  1.20231981 44145',
];
describe('Catalog data contracts', () => {
  it('retains six-digit identifiers, separates unknown physical properties', () => {
    expect(real.objects.some((o) => o.catalogId === 100057)).toBe(true);
    expect(real.objects[0].physical).toEqual({
      massKg: null,
      sizeM: null,
      tumbleRadS: null,
      basis: 'not_in_orbital_elements',
    });
    expect(sim.objects.every((o) => o.catalogId === null && o.id.startsWith('SIM-'))).toBe(true);
  });
  it('rejects duplicate catalog IDs and unsupported frames / invalid dates', () => {
    const row = real.objects[0].gp;
    expect(() => normalizeOMM([row, row])).toThrow();
    expect(() => normalizeOMM([row, { ...real.objects[1].gp, REF_FRAME: 'GCRF' }])).toThrow();
    expect(() => utcEpoch('2026-02-30T00:00:00Z')).toThrow();
    expect(() => utcEpoch('2026-11-11T12:00:60Z')).toThrow();
    expect(() => utcEpoch('2026-11-11T12:00:00+08:00')).toThrow();
  });
  it('accepts numeric OMM strings and never accepts supplied mass as inferred data', () => {
    const rows = real.objects
      .slice(0, 2)
      .map((o) => ({ ...o.gp, MEAN_MOTION: String(o.gp.MEAN_MOTION), massKg: 123 }));
    expect(normalizeOMM(rows)[0].physical.massKg).toBeNull();
    expect(() => normalizeOMM([{ ...rows[0], MEAN_MOTION: '' }, rows[1]])).toThrow();
  });
  it('parses canonical TLE without a lossy OMM round trip and checks checksums', () => {
    const objects = normalizeTLE([...vanguard, ...second].join('\n'));
    expect(objects[0].catalogId).toBe(5);
    expect(objects[0].tle).toEqual(vanguard);
    expect(objects[0].gp.MEAN_MOTION_DOT).toBe(0.00000023);
    expect(() =>
      normalizeTLE([...vanguard, ...second].join('\n').replace('4753', '4754')),
    ).toThrow();
    expect(decodeCatalogId('A0001')).toBe(100001);
    expect(() => decodeCatalogId('I0001')).toThrow();
  });
  it('matches Vallado published Vanguard epoch position', () => {
    const o = normalizeTLE([...vanguard, ...second].join('\n'))[0];
    const s = propagator(o)(Date.parse(o.gp.EPOCH));
    expect(
      Math.hypot(...s.positionKm.map((x, i) => x - [7022.46529266, -1400.08296755, 0.03995155][i])),
    ).toBeLessThan(0.01);
  });
});
describe('Independent geometry and local-minimum cases', () => {
  const linear = (t: number): State => ({
    positionKm: [(t - 5000) / 1000, 2, 0],
    velocityKmS: [1, 0, 0],
  });
  it('finds analytic miss distance and TCA', () => {
    const r = findMinima(() => zero, linear, 0, 10000, 1000, 1);
    expect(r.events).toHaveLength(1);
    expect(Math.abs(r.events[0].time - 5000)).toBeLessThanOrEqual(1);
    expect(r.events[0].value.distanceKm).toBeCloseTo(2, 5);
  });
  it('finds separate minima and rejects window edges', () => {
    const periodic = (t: number): State => ({
      positionKm: [10 + Math.cos(t / 1000), 0, 0],
      velocityKmS: [-Math.sin(t / 1000), 0, 0],
    });
    expect(findMinima(() => zero, periodic, 0, 14000, 200, 1).events).toHaveLength(2);
    expect(findMinima(() => zero, linear, 5000, 10000, 1000).events).toHaveLength(0);
    expect(findMinima(() => zero, linear, 0, 5000, 1000).events).toHaveLength(0);
  });
  it('does not bridge failed propagation samples or hide partial coverage', () => {
    const faulty = (t: number) => {
      if (t >= 4000 && t <= 6000)
        throw new PropagationError('test', new Date(t).toISOString(), 'injected failure');
      return linear(t);
    };
    const r = findMinima(() => zero, faulty, 0, 10000, 1000);
    expect(r.events).toHaveLength(0);
    expect(r.failures).toHaveLength(3);
  });
  it('computes relative rather than absolute speed', () => {
    const a = { positionKm: [7000, 0, 0], velocityKmS: [0, 7.5, 0] } as State;
    expect(
      geometry(a, { positionKm: [7000, 1, 0], velocityKmS: [0, 7.5, 0] }).relativeVelocityKmS,
    ).toBe(0);
  });
  it('ECEF velocity includes the rotating-frame derivative', () => {
    const t = Date.parse('2026-11-11T12:00:00Z'),
      s = { positionKm: [7000, 0, 0], velocityKmS: [0, 0, 0] } as State;
    const before = temeToEcef(s, t - 100),
      after = temeToEcef(s, t + 100),
      center = temeToEcef(s, t);
    const difference = after.positionKm.map(
      (x, i) => (x - before.positionKm[i]) / 0.2 - center.velocityKmS[i],
    );
    expect(Math.hypot(...difference)).toBeLessThan(0.0001);
  });
  it('RIC transformation subtracts reference rotation', () => {
    const a = { positionKm: [7000, 0, 0], velocityKmS: [0, 7, 0] } as State;
    const b = { positionKm: [7000, 1, 0], velocityKmS: [-0.001, 7, 0] } as State;
    expect(relativeRIC(a, b).positionKm).toEqual([0, 1, 0]);
    expect(Math.hypot(...relativeRIC(a, b).velocityKmS)).toBeLessThan(1e-10);
  });
});
describe('Removal model applicability', () => {
  it('uses RAAN and inclination for plane separation', () => {
    const a = sim.objects[0],
      b = { ...a, gp: { ...a.gp, RA_OF_ASC_NODE: a.gp.RA_OF_ASC_NODE + 180 } };
    expect(planeAngleDeg(a, b)).toBeCloseTo(103.2, 6);
  });
  it('same orbit proxies are zero and eccentric targets are rejected', () => {
    expect(evaluateTarget(sim.objects[0], sim.objects[0]).circularHohmannDeltaVKmS).toBe(0);
    expect(
      evaluateTarget(
        real.objects[0],
        real.objects.find((o) => o.catalogId === 49271)!,
      ).model,
    ).toBe('unsupported_eccentricity');
  });
  it('records duplicate representations instead of treating them as collisions', () => {
    const r = screen(
      real,
      {
        datasetId: real.id,
        primaryId: real.objects[0].id,
        startUtc: real.referenceStart,
        hours: 1,
        cadenceSeconds: 30,
        thresholdKm: 100,
      },
      'test',
      '2026-11-11T12:00:00Z',
    );
    expect(r.coverage.exclusions.map((e) => e.objectId)).toContain('norad-36086');
    expect(r.events.some((e) => e.secondaryId === 'norad-36086')).toBe(false);
  });
});
