import { CAPTURE_RULES, stepCapture } from '@orbit/core/capture';
import type { CaptureState, PilotInput } from '@orbit/core/capture';

/** Keep fixed integration steps when rendering is slow; bound catch-up after a stall. */
export function advanceCaptureFrame(
  state: CaptureState,
  input: PilotInput,
  wallS: number,
  speed: number,
  remainderS = 0,
): { state: CaptureState; remainderS: number } {
  if (!state.running) return { state, remainderS: 0 };
  const elapsed = Math.max(0, Math.min(1, wallS));
  const scaled = elapsed * Math.max(0, Math.min(8, speed)) + remainderS;
  const steps = Math.min(960, Math.floor((scaled + 1e-10) / CAPTURE_RULES.stepS));
  for (let i = 0; i < steps; i++) state = stepCapture(state, input, CAPTURE_RULES.stepS);
  return { state, remainderS: Math.max(0, scaled - steps * CAPTURE_RULES.stepS) };
}
