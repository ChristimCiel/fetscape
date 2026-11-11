/** Synthetic near-field rehearsal only: kinematic body axes, not orbital GNC/contact dynamics. */
import { mechanismCycle } from './mechanism.js';
export type V3 = [number, number, number];
export type CapturePhase =
  'idle' | 'approach' | 'hold' | 'capturing' | 'secured' | 'retreat' | 'aborted' | 'collision';
export type ScenarioId = 'nominal' | 'tumbling' | 'drifting';
export interface CaptureEvent {
  timeS: number;
  type: string;
  detail: string;
}
export interface CaptureState {
  timeS: number;
  running: boolean;
  phase: CapturePhase;
  mode: 'manual' | 'guided';
  position: V3;
  velocity: V3;
  yaw: number;
  pitch: number;
  roll: number;
  targetPosition: V3;
  targetVelocity: V3;
  targetEuler: V3;
  tumbleDegS: number;
  captureProgress: number;
  attachedPose: { offset: V3; euler: V3; tumbleDegS: number } | null;
  entryEvidence: {
    timeS: number;
    rangeM: number;
    relativeSpeedMS: number;
    alignmentDeg: number;
    tumbleDegS: number;
    gates: { id: string; label: string; passed: boolean }[];
  } | null;
  retreatDirection: V3;
  events: CaptureEvent[];
  scenario: ScenarioId;
}
export interface PilotInput {
  right: number;
  up: number;
  forward: number;
  brake: boolean;
  yaw: number;
  pitch: number;
  roll: number;
}
export const EMPTY_INPUT: PilotInput = {
  right: 0,
  up: 0,
  forward: 0,
  brake: false,
  yaw: 0,
  pitch: 0,
  roll: 0,
};
export const CAPTURE_RULES = Object.freeze({
  model: 'synthetic-kinematic-rehearsal/2.0',
  stepS: 1 / 120,
  initialRangeM: 14,
  holdRangeM: 4.4,
  minRangeM: 3.6,
  maxRangeM: 5.2,
  maxRelativeSpeedMS: 0.15,
  maxAlignmentDeg: 5,
  maxTumbleDegS: 2.5,
  collisionProxyRadiusM: 2.6,
  retreatRangeM: 24,
  maxAccelerationMS2: 0.35,
  manualSpeedLimitMS: 1.2,
  guidedSpeedLimitMS: 0.95,
  captureDurationS: 8,
  cradleRangeM: 3.2,
  targetLongestSideM: 3.8,
});
const length = (v: V3) => Math.hypot(...v);
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (v: V3, n: number): V3 => [v[0] * n, v[1] * n, v[2] * n];
const product = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cap = (v: V3, max: number) => mul(v, Math.min(1, max / Math.max(length(v), 1e-12)));
const direction = (v: V3) => mul(v, 1 / Math.max(length(v), 1e-12));
const wrap = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));
export function bodyToWorld(v: V3, yaw: number, pitch: number, roll = 0): V3 {
  // Three.js Euler order YXZ: roll about local Z, then pitch X, then yaw Y.
  const cr = Math.cos(roll),
    sr = Math.sin(roll),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const x = v[0] * cr - v[1] * sr,
    y = v[0] * sr + v[1] * cr;
  const yy = y * cp - v[2] * sp,
    z = y * sp + v[2] * cp;
  return [x * cy + z * sy, yy, -x * sy + z * cy];
}
export function worldToBody(v: V3, yaw: number, pitch: number, roll = 0): V3 {
  return [
    product(v, bodyToWorld([1, 0, 0], yaw, pitch, roll)),
    product(v, bodyToWorld([0, 1, 0], yaw, pitch, roll)),
    product(v, bodyToWorld([0, 0, 1], yaw, pitch, roll)),
  ];
}
function event(state: CaptureState, type: string, detail: string): CaptureState {
  return { ...state, events: [...state.events, { timeS: state.timeS, type, detail }].slice(-150) };
}
export function createCaptureState(scenario: ScenarioId = 'nominal'): CaptureState {
  return {
    timeS: 0,
    running: false,
    phase: 'idle',
    mode: 'manual',
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    roll: 0,
    targetPosition: scenario === 'drifting' ? [0.7, 0.2, -14] : [0, 0, -14],
    targetVelocity: scenario === 'drifting' ? [0.025, 0.012, 0] : [0, 0, 0],
    targetEuler: [0.1, 0.2, 0.08],
    tumbleDegS: scenario === 'tumbling' ? 6 : 0.6,
    captureProgress: 0,
    attachedPose: null,
    entryEvidence: null,
    retreatDirection: [0, 0, 1],
    scenario,
    events: [
      {
        timeS: 0,
        type: 'scenario',
        detail: `${scenario}: fictional local scene. All dimensions, speeds and gates are explicit demonstration assumptions.`,
      },
    ],
  };
}
export function telemetry(state: CaptureState) {
  const relative = sub(state.targetPosition, state.position),
    dv = sub(state.targetVelocity, state.velocity),
    range = length(relative);
  const forward = bodyToWorld([0, 0, -1], state.yaw, state.pitch, state.roll);
  const alignmentDeg =
    (Math.acos(Math.max(-1, Math.min(1, product(forward, direction(relative))))) * 180) / Math.PI;
  return {
    rangeM: range,
    relativeSpeedMS: length(dv),
    closingSpeedMS: (range > 0 ? -product(relative, dv) / range : 0) || 0,
    alignmentDeg,
    tumbleDegS: state.tumbleDegS,
  };
}
export function captureGates(state: CaptureState) {
  const t = telemetry(state),
    c = CAPTURE_RULES;
  const gates = [
    {
      id: 'phase',
      label: 'Approach / hold state',
      passed: ['approach', 'hold'].includes(state.phase),
    },
    {
      id: 'range',
      label: `Centre range ${c.minRangeM}–${c.maxRangeM} m`,
      passed: t.rangeM >= c.minRangeM && t.rangeM <= c.maxRangeM,
    },
    {
      id: 'speed',
      label: `Relative speed ≤ ${c.maxRelativeSpeedMS} m/s`,
      passed: t.relativeSpeedMS <= c.maxRelativeSpeedMS,
    },
    {
      id: 'alignment',
      label: `Boresight error ≤ ${c.maxAlignmentDeg}°`,
      passed: t.alignmentDeg <= c.maxAlignmentDeg,
    },
    {
      id: 'tumble',
      label: `Assumed tumble ≤ ${c.maxTumbleDegS}°/s`,
      passed: t.tumbleDegS <= c.maxTumbleDegS,
    },
  ];
  return { ready: gates.every((g) => g.passed), gates };
}
export function startCaptureRun(state: CaptureState, mode: 'manual' | 'guided'): CaptureState {
  if (['secured', 'aborted', 'collision', 'capturing', 'retreat'].includes(state.phase))
    return state;
  return event(
    { ...state, running: true, phase: 'approach', mode },
    mode,
    mode === 'guided'
      ? 'Scripted local approach controller engaged; no flight guidance.'
      : 'Manual local translation and attitude controls engaged.',
  );
}
export function requestCapture(state: CaptureState): CaptureState {
  const check = captureGates(state);
  if (!check.ready)
    return event(
      state,
      'capture_rejected',
      check.gates
        .filter((g) => !g.passed)
        .map((g) => g.label)
        .join('; '),
    );
  return event(
    {
      ...state,
      phase: 'capturing',
      running: true,
      captureProgress: 0,
      attachedPose: null,
      entryEvidence: { timeS: state.timeS, ...telemetry(state), gates: check.gates },
    },
    'capture_started',
    'Authored mechanism sequence: deploy, track grasp points, close fingers, berth, close collector and verify a simulated latch. No force or contact solver.',
  );
}
export function abortCapture(state: CaptureState): CaptureState {
  if (['secured', 'aborted', 'collision', 'retreat'].includes(state.phase)) return state;
  return event(
    {
      ...state,
      phase: 'retreat',
      running: true,
      retreatDirection: direction(sub(state.position, state.targetPosition)),
      captureProgress: 0,
      attachedPose: null,
    },
    'abort',
    'Conceptual retreat along the current simulator line of sight.',
  );
}
export function recenterCapture(state: CaptureState): CaptureState {
  const r = direction(sub(state.targetPosition, state.position));
  return { ...state, yaw: Math.atan2(-r[0], -r[2]), pitch: Math.asin(r[1]), roll: 0 };
}
export function stepCapture(state: CaptureState, input: PilotInput, dt: number): CaptureState {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1)
    throw new Error('Capture step must be >0 and ≤0.1 s');
  if (!state.running || ['idle', 'secured', 'aborted', 'collision'].includes(state.phase))
    return state;
  const c = CAPTURE_RULES;
  let next: CaptureState = { ...state, timeS: state.timeS + dt };
  next.targetPosition = add(state.targetPosition, mul(state.targetVelocity, dt));
  next.targetEuler = add(state.targetEuler, [
    ((state.tumbleDegS * Math.PI) / 180) * dt * 0.25,
    ((state.tumbleDegS * Math.PI) / 180) * dt,
    0,
  ]);
  let acceleration: V3 = [0, 0, 0];
  if (state.phase === 'retreat') {
    acceleration = cap(
      sub(mul(state.retreatDirection, 0.95), state.velocity),
      c.maxAccelerationMS2,
    );
  } else if (state.phase === 'capturing') {
    acceleration = cap(mul(state.velocity, -3), c.maxAccelerationMS2);
  } else if (state.mode === 'guided') {
    const desiredPosition = add(next.targetPosition, [0, 0, c.holdRangeM]);
    const desiredVelocity = add(
      next.targetVelocity,
      cap(mul(sub(desiredPosition, state.position), 0.55), c.guidedSpeedLimitMS),
    );
    acceleration = cap(mul(sub(desiredVelocity, state.velocity), 1.8), c.maxAccelerationMS2);
    const r = direction(sub(next.targetPosition, state.position)),
      wantedYaw = Math.atan2(-r[0], -r[2]),
      wantedPitch = Math.asin(r[1]);
    next.yaw = wrap(state.yaw + wrap(wantedYaw - state.yaw) * Math.min(1, dt * 3));
    next.pitch = state.pitch + (wantedPitch - state.pitch) * Math.min(1, dt * 3);
    next.roll = state.roll * Math.max(0, 1 - dt * 3);
  } else {
    acceleration = mul(
      cap(
        bodyToWorld([input.right, input.up, -input.forward], state.yaw, state.pitch, state.roll),
        1,
      ),
      c.maxAccelerationMS2,
    );
    if (input.brake) acceleration = cap(mul(state.velocity, -3), c.maxAccelerationMS2);
    next.yaw = wrap(state.yaw + input.yaw * 0.45 * dt);
    next.pitch = Math.max(-1.3, Math.min(1.3, state.pitch + input.pitch * 0.45 * dt));
    next.roll = wrap(state.roll + input.roll * 0.45 * dt);
  }
  next.velocity = cap(add(state.velocity, mul(acceleration, dt)), c.manualSpeedLimitMS);
  next.position = add(state.position, mul(add(state.velocity, next.velocity), dt / 2));
  if (state.phase === 'capturing') {
    next.captureProgress = Math.min(1, state.captureProgress + dt / c.captureDurationS);
    const before = mechanismCycle(state.captureProgress),
      cycle = mechanismCycle(next.captureProgress);
    if (cycle.stage !== before.stage) next = event(next, 'mechanism_stage', cycle.stage);
    if (cycle.attached) {
      if (!state.attachedPose) {
        next.attachedPose = {
          offset: worldToBody(
            sub(next.targetPosition, next.position),
            next.yaw,
            next.pitch,
            next.roll,
          ),
          euler: [...next.targetEuler],
          tumbleDegS: state.tumbleDegS,
        };
        next = event(
          next,
          'soft_capture',
          'Authored geometry constraint attached. This is not force/contact telemetry.',
        );
      }
      const pose = next.attachedPose!;
      const destination: V3 = [0, -0.3, -c.cradleRangeM];
      const offset = add(pose.offset, mul(sub(destination, pose.offset), cycle.retraction));
      next.targetPosition = add(
        next.position,
        bodyToWorld(offset, next.yaw, next.pitch, next.roll),
      );
      next.targetEuler = mul(pose.euler, 1 - cycle.collectorClosure);
      next.tumbleDegS = pose.tumbleDegS * (1 - cycle.collectorClosure);
      next.targetVelocity = mul(sub(next.targetPosition, state.targetPosition), 1 / dt);
    }
    if (next.captureProgress >= 1) {
      next = {
        ...next,
        phase: 'secured',
        running: false,
        targetVelocity: [...next.velocity],
        tumbleDegS: 0,
      };
      return event(
        next,
        'secured',
        'Authored collector closure and simulated latch verified. Scenario paused; hardware contact, latch sensing and coupled dynamics remain unvalidated.',
      );
    }
  }
  const t = telemetry(next);
  if (t.rangeM < c.collisionProxyRadiusM)
    return event(
      { ...next, phase: 'collision', running: false },
      'proxy_collision',
      'Centre-distance proxy violated. No mesh contact or damage model. Reset required.',
    );
  if (state.phase === 'retreat' && t.rangeM >= c.retreatRangeM)
    return event(
      { ...next, phase: 'aborted', running: false },
      'retreat_complete',
      'Synthetic exit boundary reached; scenario paused.',
    );
  if (state.mode === 'guided' && ['approach', 'hold'].includes(next.phase)) {
    const hold = Math.abs(t.rangeM - c.holdRangeM) < 0.12 && t.relativeSpeedMS < 0.04;
    if (hold && state.phase !== 'hold')
      next = event(
        { ...next, phase: 'hold' },
        'hold',
        'Synthetic stand-off reached. Capture still requires every demonstration gate.',
      );
    else if (!hold) next.phase = 'approach';
  }
  return next;
}
