/**
 * Live-mode helper: graceful replay fallback when the worker cannot run.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { runLiveOrReplayScreen } from '../apps/web/src/fetscape/tools/live-screen';

describe('runLiveOrReplayScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to replay when Worker is unavailable', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('Worker constructor blocked in unit test');
        }
      },
    );

    const result = await runLiveOrReplayScreen({ hours: 1, thresholdKm: 50 });
    expect(result.mode).toBe('replay');
    if (result.mode === 'replay') {
      expect(result.reason).toMatch(/Worker/i);
    }
    expect(result.snapshot.disclaimer).toMatch(/GEOMETRIC SCREENING ONLY/i);
    expect(result.snapshot.approaches.length).toBeGreaterThan(0);
    for (const row of result.snapshot.approaches) {
      expect(row.note).toMatch(/Geometric/i);
      expect(row.note).not.toMatch(/collision risk/i);
    }
  });
});
