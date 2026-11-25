/**
 * Opt-in live screening via Web Worker, with graceful replay fallback.
 */

import {
  getReplayCloseApproachSnapshot,
  type CloseApproachSnapshot,
} from './close-approach-replay';
import type { WorkerRequest, WorkerResponse } from '../workers/sgp4-live.worker';

export type LiveScreenResult =
  | { mode: 'live'; snapshot: CloseApproachSnapshot }
  | { mode: 'replay'; snapshot: CloseApproachSnapshot; reason: string };

function runWorker(
  request: Exclude<WorkerRequest, { type: 'ping' }>,
  timeoutMs = 45000,
): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/sgp4-live.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (error) {
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Live worker timed out'));
    }, timeoutMs);
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.id !== request.id) return;
      clearTimeout(timer);
      worker.terminate();
      resolve(ev.data);
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    worker.postMessage(request);
  });
}

export async function runLiveOrReplayScreen(options?: {
  primaryNorad?: number;
  hours?: number;
  thresholdKm?: number;
}): Promise<LiveScreenResult> {
  try {
    const response = await runWorker({
      id: `live-${Date.now()}`,
      type: 'fetch_and_screen',
      primaryNorad: options?.primaryNorad,
      hours: options?.hours,
      thresholdKm: options?.thresholdKm,
    });
    if (response.type === 'screen_result' && response.ok) {
      return { mode: 'live', snapshot: response.snapshot };
    }
    if (response.type === 'screen_result' && !response.ok) {
      return {
        mode: 'replay',
        snapshot: getReplayCloseApproachSnapshot(),
        reason: response.error,
      };
    }
    return {
      mode: 'replay',
      snapshot: getReplayCloseApproachSnapshot(),
      reason: 'Unexpected worker response',
    };
  } catch (error) {
    return {
      mode: 'replay',
      snapshot: getReplayCloseApproachSnapshot(),
      reason: (error as Error).message ?? 'Worker unavailable',
    };
  }
}
