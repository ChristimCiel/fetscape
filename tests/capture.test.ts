import { describe, it, expect } from 'vitest';
import {
  CAPTURE_RULES,
  EMPTY_INPUT,
  createCaptureState,
  startCaptureRun,
  stepCapture,
  telemetry,
  captureGates,
  requestCapture,
  abortCapture,
  bodyToWorld,
} from '../packages/orbital-core/src/capture';
import type { CaptureState } from '../packages/orbital-core/src/capture';
function advance(s: CaptureState, seconds: number, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++) s = stepCapture(s, EMPTY_INPUT, dt);
  return s;
}
describe('Synthetic capture rehearsal contracts', () => {
  it('guided nominal approach reaches stand-off and visual latch', () => {
    let s = advance(startCaptureRun(createCaptureState(), 'guided'), 50);
    expect(s.phase).toBe('hold');
    expect(captureGates(s).ready).toBe(true);
    s = advance(requestCapture(s), CAPTURE_RULES.captureDurationS + 1);
    expect(s.phase).toBe('secured');
    expect(s.running).toBe(false);
    expect(s.events.at(-1)?.type).toBe('secured');
    expect(s.entryEvidence?.rangeM).toBeCloseTo(4.4, 1);
    expect(s.events.some((e) => e.type === 'soft_capture')).toBe(true);
    expect(telemetry(s).rangeM).toBeCloseTo(Math.hypot(0.3, CAPTURE_RULES.cradleRangeM), 2);
  });
  it('rejects capture at initial range and refuses excessive tumble after guidance', () => {
    expect(requestCapture(createCaptureState()).events.at(-1)?.type).toBe('capture_rejected');
    const s = advance(startCaptureRun(createCaptureState('tumbling'), 'guided'), 50);
    expect(s.phase).toBe('hold');
    expect(captureGates(s).gates.find((g) => g.id === 'tumble')?.passed).toBe(false);
    expect(requestCapture(s).phase).toBe('hold');
  });
  it('does not pull or stop the debris before the modeled soft-capture stage', () => {
    let s = advance(startCaptureRun(createCaptureState(), 'guided'), 50);
    const p = [...s.targetPosition],
      euler = [...s.targetEuler];
    s = advance(requestCapture(s), 1);
    expect(s.attachedPose).toBeNull();
    expect(s.targetPosition).toEqual(p);
    expect(s.targetEuler[1]).toBeGreaterThan(euler[1]);
    s = advance(s, 4);
    expect(s.attachedPose).not.toBeNull();
    expect(s.events.some((e) => e.type === 'soft_capture')).toBe(true);
  });
  it('gates total relative speed, not just the closing component', () => {
    const s = {
      ...createCaptureState(),
      phase: 'hold' as const,
      targetPosition: [0, 0, -4.4] as [number, number, number],
      velocity: [0.3, 0, 0] as [number, number, number],
    };
    expect(telemetry(s).closingSpeedMS).toBe(0);
    expect(captureGates(s).gates.find((g) => g.id === 'speed')?.passed).toBe(false);
  });
  it('manual thrust coasts and brake reduces speed', () => {
    let s = startCaptureRun(createCaptureState(), 'manual');
    for (let i = 0; i < 120; i++) s = stepCapture(s, { ...EMPTY_INPUT, forward: 1 }, 1 / 120);
    const speed = telemetry(s).relativeSpeedMS;
    expect(s.position[2]).toBeLessThan(0);
    s = advance(s, 1);
    expect(telemetry(s).relativeSpeedMS).toBeCloseTo(speed, 6);
    for (let i = 0; i < 240; i++) s = stepCapture(s, { ...EMPTY_INPUT, brake: true }, 1 / 120);
    expect(telemetry(s).relativeSpeedMS).toBeLessThan(0.01);
  });
  it('abort interrupts capture and reaches the explicit exit boundary', () => {
    let s = advance(startCaptureRun(createCaptureState(), 'guided'), 50);
    s = advance(requestCapture(s), 0.5);
    s = abortCapture(s);
    s = advance(s, 35);
    expect(s.phase).toBe('aborted');
    expect(telemetry(s).rangeM).toBeGreaterThanOrEqual(CAPTURE_RULES.retreatRangeM);
    expect(s.events.some((e) => e.type === 'secured')).toBe(false);
  });
  it('proxy collision is a failure and cannot be captured', () => {
    let s = startCaptureRun(createCaptureState(), 'manual');
    for (let i = 0; i < 6000 && s.running; i++)
      s = stepCapture(s, { ...EMPTY_INPUT, forward: 1 }, 1 / 120);
    expect(s.phase).toBe('collision');
    expect(captureGates(s).ready).toBe(false);
    expect(requestCapture(s).phase).toBe('collision');
  });
  it('fixed-step results are reproducible and agree with a smaller integration step', () => {
    const initial = startCaptureRun(createCaptureState('drifting'), 'guided'),
      a = advance(initial, 35),
      b = advance(initial, 35),
      fine = advance(initial, 35, 1 / 240);
    expect(a).toEqual(b);
    expect(Math.hypot(...a.position.map((v, i) => v - fine.position[i]))).toBeLessThan(0.02);
    expect(() => stepCapture(a, EMPTY_INPUT, 0.5)).toThrow();
  });
  it('body-axis controls match yaw/pitch conventions', () => {
    const v = bodyToWorld([0, 0, -1], Math.PI / 2, 0);
    expect(v[0]).toBeCloseTo(-1);
    expect(v[2]).toBeCloseTo(0);
  });
});
