import { describe, expect, it } from 'vitest';
import { createCaptureState, EMPTY_INPUT, startCaptureRun } from '@orbit/core/capture';
import { advanceCaptureFrame } from '../apps/web/src/capture/clock';

describe('render-independent capture clock', () => {
  const run = (frames: number, wallS: number) => {
    let state = startCaptureRun(createCaptureState(), 'guided');
    let remainderS = 0;
    for (let i = 0; i < frames; i++) {
      ({ state, remainderS } = advanceCaptureFrame(state, EMPTY_INPUT, wallS, 8, remainderS));
    }
    return state;
  };
  it('reaches the same stand-off state at 2 fps and 60 fps for equal elapsed time', () => {
    const slow = run(6, 0.5),
      fast = run(180, 1 / 60);
    expect(slow.phase).toBe('hold');
    expect(slow.timeS).toBeCloseTo(24, 8);
    expect(slow).toEqual(fast);
  });
  it('does not advance a paused session or retain time for later catch-up', () => {
    const paused = createCaptureState();
    expect(advanceCaptureFrame(paused, EMPTY_INPUT, 600, 8, 0.004)).toEqual({
      state: paused,
      remainderS: 0,
    });
  });
  it('bounds long-stall work without changing the fixed integration step', () => {
    const state = startCaptureRun(createCaptureState(), 'guided');
    const long = advanceCaptureFrame(state, EMPTY_INPUT, 600, 8);
    const bounded = advanceCaptureFrame(state, EMPTY_INPUT, 1, 8);
    expect(long).toEqual(bounded);
    expect(long.state.timeS).toBeCloseTo(8, 8);
    expect(long.remainderS).toBeLessThan(1 / 120);
  });
});
