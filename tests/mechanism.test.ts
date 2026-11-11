import { describe, it, expect } from 'vitest';
import {
  solvePlanarArm,
  armEndpoint,
  mechanismCycle,
  graspPointVelocity,
  ARM_RIG,
  COLLECTOR_RIG,
} from '../packages/orbital-core/src/mechanism';
describe('Authored mechanism kinematics and script evidence', () => {
  it('two-link IK reaches analytic 3-4-5 geometry and flags unreachable targets', () => {
    const p = solvePlanarArm(3, 4, 3, 4),
      end = armEndpoint(p.shoulder, p.elbow, 3, 4);
    expect(p.reachable).toBe(true);
    expect(end.y).toBeCloseTo(3, 8);
    expect(end.z).toBeCloseTo(4, 8);
    expect(solvePlanarArm(0, 10, 3, 4).reachable).toBe(false);
    expect(solvePlanarArm(0, 10, 3, 4).reachError).toBeGreaterThan(2.9);
  });
  it('preserves the source wrist location when solving its rest pose', () => {
    const S = ARM_RIG.shoulder,
      E = ARM_RIG.elbow,
      W = ARM_RIG.wrist;
    const upper = Math.hypot(E[1] - S[1], E[2] - S[2]),
      lower = Math.hypot(W[1] - E[1], W[2] - E[2]);
    const result = solvePlanarArm(W[1] - S[1], W[2] - S[2], upper, lower),
      end = armEndpoint(result.shoulder, result.elbow, upper, lower);
    expect(end.y + S[1]).toBeCloseTo(W[1], 9);
    expect(end.z + S[2]).toBeCloseTo(W[2], 9);
  });
  it('uses the supplied collector jaw parts and sequences contact before berthing and lock', () => {
    expect(COLLECTOR_RIG.map((j) => j.name)).toEqual(['model_part3', 'model_part4']);
    expect(mechanismCycle(0.2).attached).toBe(false);
    expect(mechanismCycle(0.5).attached).toBe(true);
    expect(mechanismCycle(0.5).collectorClosure).toBe(0);
    expect(mechanismCycle(0.95).collectorClosure).toBe(1);
    expect(mechanismCycle(1).latch).toBe(1);
  });
  it('reproduces the pitch grasp-point example without equating centre speed to grasp speed', () => {
    const v = graspPointVelocity([0, 0, 0], [0, 0, (3 * Math.PI) / 180], [2, 0, 0]);
    expect(Math.hypot(...v)).toBeCloseTo(0.1047197551, 9);
  });
});
