import { describe, it, expect } from 'vitest';
import {
  getBundledDerelictCatalog,
  rankDerelictTargets,
  classifyDerelict,
} from '../apps/web/src/fetscape/tools/debris-ranking';

describe('ADR derelict ranking', () => {
  it('loads bundled CelesTrak derelict snapshot with rocket bodies / dead payloads / fragments', () => {
    const { objects, meta } = getBundledDerelictCatalog();
    expect(objects.length).toBeGreaterThan(5);
    expect(meta.source).toMatch(/CelesTrak/);
    expect(meta.contentSha256).toHaveLength(64);
    const classes = new Set(objects.map((o) => classifyDerelict(o.OBJECT_NAME)));
    expect(classes.has('dead_payload') || classes.has('debris_fragment')).toBe(true);
  });

  it('ranks with transparent criteria and cites sources; no Pc wording', () => {
    const { objects, meta } = getBundledDerelictCatalog();
    const ranked = rankDerelictTargets(objects, {
      dataSource: meta.source,
      contentSha256: meta.contentSha256,
    });
    expect(ranked[0].rankingScore).toBeGreaterThanOrEqual(ranked[ranked.length - 1].rankingScore);
    for (const row of ranked.slice(0, 5)) {
      expect(row.criteriaDetail.length).toBe(4);
      for (const c of row.criteriaDetail) {
        expect(c.source.length).toBeGreaterThan(5);
        expect(c.tradeOff.length).toBeGreaterThan(5);
        expect(c.source).not.toMatch(/collision risk/i);
      }
      expect(row.feasibilityNotes.join(' ')).toMatch(/Decision support/i);
      expect(row.feasibilityNotes.join(' ')).not.toMatch(/recommend(ed)? burn/i);
    }
  });
});
