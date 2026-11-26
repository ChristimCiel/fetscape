/**
 * Fetscape v1 MVP - Tools Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateMeanAltitude, filterByAltitude } from '../apps/web/src/fetscape/tools/celestrak';
import {
  estimateDeorbitLifetime,
  getComplianceStatus,
} from '../apps/web/src/fetscape/tools/deorbit';
import {
  retrieveRegulations,
  generateComplianceChecklist,
} from '../apps/web/src/fetscape/tools/regulations';

describe('CelesTrak tools', () => {
  describe('calculateMeanAltitude', () => {
    it('should calculate altitude from mean motion', () => {
      // ISS mean motion ~15.5 rev/day -> ~410 km altitude
      const alt = calculateMeanAltitude(15.5);
      expect(alt).toBeGreaterThan(400);
      expect(alt).toBeLessThan(420);
    });

    it('should calculate altitude for LEO satellite', () => {
      // 500km altitude -> ~15.2 rev/day
      const alt = calculateMeanAltitude(15.2);
      expect(alt).toBeGreaterThan(480);
      expect(alt).toBeLessThan(520);
    });
  });

  describe('filterByAltitude', () => {
    it('should filter objects by altitude range', () => {
      const objects = [
        { MEAN_MOTION: 15.5, OBJECT_NAME: 'ISS' } as any,
        { MEAN_MOTION: 15.2, OBJECT_NAME: 'SAT-500' } as any,
        { MEAN_MOTION: 16.0, OBJECT_NAME: 'SAT-350' } as any,
      ];

      const filtered = filterByAltitude(objects, 400, 450);
      expect(filtered.length).toBe(1);
      expect(filtered[0].OBJECT_NAME).toBe('ISS');
    });
  });
});

describe('Deorbit estimator', () => {
  describe('estimateDeorbitLifetime', () => {
    it('should estimate lifetime for 500km orbit', () => {
      const result = estimateDeorbitLifetime({
        altitudeKm: 500,
        massKg: 10,
        areaM2: 0.1,
      });

      expect(result.estimatedLifetimeYears).toBeGreaterThan(0);
      expect(result.method).toBeTruthy();
      expect(result.assumptions.length).toBeGreaterThan(0);
      expect(result.uncertainties.length).toBeGreaterThan(0);
    });

    it('should estimate shorter lifetime at low altitude', () => {
      const result = estimateDeorbitLifetime({
        altitudeKm: 400,
      });

      // At 400km, lifetime should be reasonably short (typically < 10 years)
      expect(result.estimatedLifetimeYears).toBeLessThan(50);
      expect(result.estimatedLifetimeYears).toBeGreaterThan(0);
    });

    it('should not comply at high altitude', () => {
      const result = estimateDeorbitLifetime({
        altitudeKm: 800,
      });

      expect(result.complies25Year).toBe(false);
      expect(result.complies5Year).toBe(false);
    });
  });

  describe('getComplianceStatus', () => {
    it('should return compliant for <5 year lifetime', () => {
      const estimate = {
        estimatedLifetimeYears: 3,
        complies25Year: true,
        complies5Year: true,
      } as any;

      const status = getComplianceStatus(estimate);
      expect(status.status).toBe('compliant');
    });

    it('should return marginal for 5-25 year lifetime', () => {
      const estimate = {
        estimatedLifetimeYears: 10,
        complies25Year: true,
        complies5Year: false,
      } as any;

      const status = getComplianceStatus(estimate);
      expect(status.status).toBe('marginal');
    });

    it('should return non-compliant for >25 year lifetime', () => {
      const estimate = {
        estimatedLifetimeYears: 50,
        complies25Year: false,
        complies5Year: false,
      } as any;

      const status = getComplianceStatus(estimate);
      expect(status.status).toBe('non-compliant');
    });
  });
});

describe('Regulations', () => {
  describe('retrieveRegulations', () => {
    it('should retrieve Taiwan regulations', () => {
      const regs = retrieveRegulations({ jurisdiction: 'taiwan' });
      expect(regs.length).toBeGreaterThan(0);
      expect(regs.some((r) => r.source.includes('NSTC'))).toBe(true);
    });

    it('should retrieve FCC regulations', () => {
      const regs = retrieveRegulations({ jurisdiction: 'fcc' });
      expect(regs.length).toBeGreaterThan(0);
      expect(regs.some((r) => r.source.includes('FCC'))).toBe(true);
    });

    it('should retrieve multiple jurisdictions by default', () => {
      const regs = retrieveRegulations({});
      expect(regs.length).toBeGreaterThan(2);
    });
  });

  describe('generateComplianceChecklist', () => {
    it('should generate checklist for no-propulsion mission', () => {
      const checklist = generateComplianceChecklist({
        hasNoPropulsion: true,
        altitude: 500,
        estimatedLifetime: 8,
      });

      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist.some((item) => item.status === 'required')).toBe(true);
      expect(checklist.some((item) => item.item.includes('Register'))).toBe(true);
    });

    it('should include FCC waiver for >5 year lifetime', () => {
      const checklist = generateComplianceChecklist({
        hasNoPropulsion: true,
        altitude: 500,
        estimatedLifetime: 8,
      });

      expect(checklist.some((item) => item.item.includes('FCC'))).toBe(true);
    });

    it('should recommend enhanced deorbit for high altitude', () => {
      const checklist = generateComplianceChecklist({
        hasNoPropulsion: true,
        altitude: 650,
        estimatedLifetime: 15,
      });

      expect(checklist.some((item) => item.item.includes('Enhanced'))).toBe(true);
    });
  });
});
