/**
 * Browser-safe close-approach replay (no satellite.js / WASM).
 */

import type { CloseApproach } from '../types';
import replaySnapshot from '../replay/close-approach-snapshot.json';

export interface CloseApproachSnapshot {
  primaryName: string;
  startUtc: string;
  hours: number;
  thresholdKm: number;
  approaches: CloseApproach[];
  dataSource: string;
  acquiredAt: string;
  totalScreened: number;
  excludedDocked?: string[];
  disclaimer: string;
}

export function getReplayCloseApproachSnapshot(): CloseApproachSnapshot {
  return structuredClone(replaySnapshot) as CloseApproachSnapshot;
}
