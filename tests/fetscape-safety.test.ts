/**
 * Fetscape v1 MVP - Safety Linter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SafetyLinter,
  filterDocked,
  ensureGeometricLabel,
} from '../apps/web/src/fetscape/safety/linter';

describe('SafetyLinter', () => {
  const linter = new SafetyLinter();

  describe('prohibited terms', () => {
    it('should detect collision risk terminology', () => {
      const violations = linter.lint('The collision risk is high with Pc = 0.001');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.type === 'prohibited_term')).toBe(true);
    });

    it('should detect maneuver advice', () => {
      const violations = linter.lint('We recommend a burn of 2 m/s to avoid collision');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.type === 'maneuver_advice')).toBe(true);
    });

    it('should detect commanding language', () => {
      const violations = linter.lint('Send command to the satellite to execute maneuver');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.type === 'commanding')).toBe(true);
    });

    it('should detect Chinese prohibited terms', () => {
      const violations = linter.lint('碰撞風險很高，建議執行機動');
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should allow safe terminology', () => {
      const violations = linter.lint(
        'Geometric screening shows miss distance of 500m. No Pc calculated. ' +
          'Decision support tool. Human review required.',
      );
      expect(violations.length).toBe(0);
    });
  });

  describe('disclaimer checking', () => {
    it('should identify missing geometric screening disclaimer', () => {
      const { missing } = linter.checkDisclaimers('Miss distance is 500m at TCA');
      expect(missing.includes('geometricScreening')).toBe(true);
    });

    it('should recognize present disclaimers', () => {
      const { present } = linter.checkDisclaimers(
        'Geometric screening only. Not Pc. Human review required.',
      );
      expect(present.includes('geometricScreening')).toBe(true);
      expect(present.includes('decisionSupport')).toBe(true);
    });
  });

  describe('ensureCompliance', () => {
    it('should pass compliant text', () => {
      const { compliant, violations } = linter.ensureCompliance(
        'Geometric screening only. Miss distance 500m. Not Pc. Decision support tool. ' +
          'Human review required. No maneuver advice.',
      );
      expect(compliant).toBe(true);
      expect(violations.filter((v) => v.severity === 'error').length).toBe(0);
    });

    it('should fail non-compliant text', () => {
      const { compliant, violations } = linter.ensureCompliance(
        'Collision risk is high. Recommend burn of 2 m/s.',
      );
      expect(compliant).toBe(false);
      expect(violations.length).toBeGreaterThan(0);
    });
  });
});

describe('filterDocked', () => {
  it('should filter ISS docked modules', () => {
    const objects = [
      { name: 'ISS (ZARYA)', catalogId: '25544' },
      { name: 'ISS (ZVEZDA)', catalogId: '25545' },
      { name: 'PROGRESS-MS 20', catalogId: '52943' },
      { name: 'STARLINK-1234', catalogId: '44567' },
    ];

    const filtered = filterDocked(objects);
    expect(filtered.length).toBeLessThan(objects.length);
    expect(filtered.some((o) => o.name.includes('STARLINK'))).toBe(true);
  });

  it('should not filter non-docked objects', () => {
    const objects = [
      { name: 'STARLINK-1234', catalogId: '44567' },
      { name: 'ONEWEB-0001', catalogId: '44235' },
    ];

    const filtered = filterDocked(objects);
    expect(filtered.length).toBe(objects.length);
  });
});

describe('ensureGeometricLabel', () => {
  it('should add label to miss distance mentions', () => {
    const result = ensureGeometricLabel('Miss distance is 500m');
    expect(result).toContain('Geometric screening only');
  });

  it('should not duplicate label', () => {
    const input = 'Miss distance is 500m. Geometric screening only.';
    const result = ensureGeometricLabel(input);
    expect(result).toBe(input);
  });

  it('should not add label to unrelated text', () => {
    const input = 'The satellite was launched in 2020';
    const result = ensureGeometricLabel(input);
    expect(result).toBe(input);
  });
});
