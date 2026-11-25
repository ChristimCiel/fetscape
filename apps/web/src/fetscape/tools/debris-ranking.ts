/**
 * Fetscape v1 MVP - Debris Target Ranking
 * Explainable criteria for ADR mission planning (concept study)
 */

import type { DebrisTarget, MissionConcept } from '../types';
import { calculateMeanAltitude } from './celestrak';
import type { GPObject } from './celestrak';

export interface RankingCriteria {
  name: string;
  weight: number;
  description: string;
}

export const DEFAULT_CRITERIA: RankingCriteria[] = [
  {
    name: 'altitude_accessibility',
    weight: 0.3,
    description: 'Lower altitude requires less delta-V. Preference: 400-600 km LEO.',
  },
  {
    name: 'mass_impact',
    weight: 0.25,
    description: 'Larger objects create more debris on collision. Preference: >500 kg if known.',
  },
  {
    name: 'orbital_density',
    weight: 0.2,
    description: 'High-traffic regions benefit more from removal. Preference: congested shells.',
  },
  {
    name: 'collision_history',
    weight: 0.15,
    description: 'Objects from previous collisions. Preference: Iridium 33 / Cosmos 2251 debris.',
  },
  {
    name: 'capture_feasibility',
    weight: 0.1,
    description: 'Geometric features, known tumble. Preference: upper stages, intact spacecraft.',
  },
];

export function rankDebrisTargets(
  objects: GPObject[],
  criteria: RankingCriteria[] = DEFAULT_CRITERIA,
): DebrisTarget[] {
  const targets: DebrisTarget[] = [];

  for (const obj of objects) {
    const altitude = calculateMeanAltitude(obj.MEAN_MOTION);

    const scores: { criterion: string; value: number; weight: number }[] = [];

    // Altitude accessibility (lower is better, 400-600km optimal)
    const altScore =
      altitude >= 400 && altitude <= 600
        ? 1.0
        : altitude < 400
          ? Math.max(0, 1 - (400 - altitude) / 200)
          : Math.max(0, 1 - (altitude - 600) / 400);
    scores.push({
      criterion: 'altitude_accessibility',
      value: altScore,
      weight: criteria.find((c) => c.name === 'altitude_accessibility')?.weight ?? 0.3,
    });

    // Mass impact (unknown for most objects, use heuristic)
    const massScore = obj.OBJECT_NAME.includes('DEB')
      ? 0.3
      : obj.OBJECT_NAME.includes('R/B') || obj.OBJECT_NAME.includes('STAGE')
        ? 0.8
        : 0.5;
    scores.push({
      criterion: 'mass_impact',
      value: massScore,
      weight: criteria.find((c) => c.name === 'mass_impact')?.weight ?? 0.25,
    });

    // Orbital density (simplified: favor 500-600 km)
    const densityScore = altitude >= 500 && altitude <= 600 ? 0.9 : 0.5;
    scores.push({
      criterion: 'orbital_density',
      value: densityScore,
      weight: criteria.find((c) => c.name === 'orbital_density')?.weight ?? 0.2,
    });

    // Collision history (Iridium 33, Cosmos 2251, Fengyun 1C debris)
    const collisionScore =
      obj.OBJECT_NAME.includes('IRIDIUM 33 DEB') ||
      obj.OBJECT_NAME.includes('COSMOS 2251 DEB') ||
      obj.OBJECT_NAME.includes('FENGYUN 1C DEB')
        ? 1.0
        : 0.1;
    scores.push({
      criterion: 'collision_history',
      value: collisionScore,
      weight: criteria.find((c) => c.name === 'collision_history')?.weight ?? 0.15,
    });

    // Capture feasibility (simplified heuristic)
    const captureScore =
      obj.OBJECT_NAME.includes('R/B') || obj.OBJECT_NAME.includes('STAGE')
        ? 0.7
        : obj.OBJECT_NAME.includes('DEB')
          ? 0.2
          : 0.5;
    scores.push({
      criterion: 'capture_feasibility',
      value: captureScore,
      weight: criteria.find((c) => c.name === 'capture_feasibility')?.weight ?? 0.1,
    });

    // Calculate weighted score
    const totalScore = scores.reduce((sum, s) => sum + s.value * s.weight, 0);

    targets.push({
      id: `norad-${obj.NORAD_CAT_ID}`,
      name: obj.OBJECT_NAME,
      catalogId: obj.NORAD_CAT_ID.toString(),
      altitude,
      inclination: obj.INCLINATION,
      mass: undefined, // Unknown from TLE
      size: undefined, // Unknown from TLE
      rankingScore: Math.round(totalScore * 1000) / 1000,
      rankingCriteria: scores.map((s) => ({
        criterion: s.criterion,
        value: Math.round(s.value * 100) / 100,
        weight: s.weight,
      })),
      feasibilityNotes: [
        altitude > 600 ? 'High altitude - significant delta-V required' : null,
        'Mass and dimensions unknown - requires visual inspection',
        'Tumble state unknown - attitude determination needed',
        obj.OBJECT_NAME.includes('DEB') ? 'Debris fragment - irregular shape likely' : null,
      ].filter(Boolean) as string[],
    });
  }

  // Sort by ranking score descending
  targets.sort((a, b) => b.rankingScore - a.rankingScore);

  return targets;
}

export function generateMissionConcept(target: DebrisTarget): MissionConcept {
  const concept: MissionConcept = {
    targetId: target.id,
    captureApproach: 'Concept study only. Actual approach requires detailed mission design.',
    risks: [
      'Target mass, dimensions, and inertia unknown',
      'Tumble state and attitude determination required',
      'No validated capture mechanism for this target',
      'Collision debris may have sharp edges or structural damage',
    ],
    requiredData: [
      'High-resolution optical imagery for shape/size',
      'Radar measurements for tumble characterization',
      'Material composition analysis',
      'Precise ephemeris from licensed SSA provider',
      'Historical tracking data for uncertainty assessment',
    ],
  };

  // Estimate delta-V (very rough approximation)
  if (target.altitude >= 400 && target.altitude <= 600) {
    concept.transferDeltaV = Math.abs(target.altitude - 500) * 0.5; // Simplified
    concept.planeChangeDeltaV = target.inclination * 10; // Very rough
  }

  // Estimate duration
  if (concept.transferDeltaV !== undefined) {
    concept.estimatedDuration = Math.ceil(concept.transferDeltaV * 2); // days (placeholder)
  }

  return concept;
}

export function formatDebrisRankingReport(
  targets: DebrisTarget[],
  criteria: RankingCriteria[],
  language: 'en' | 'zh-TW' = 'en',
): string {
  let report =
    language === 'zh-TW' ? '# 太空碎片目標排序報告\n\n' : '# Debris Target Ranking Report\n\n';

  report +=
    language === 'zh-TW'
      ? '**免責聲明**: 這是概念研究工具。未驗證用於實際任務規劃。需要設計夥伴合作及授權 SSA 資料。\n\n'
      : '**DISCLAIMER**: This is a concept study tool. Not validated for actual mission planning. Requires design partner collaboration and licensed SSA data.\n\n';

  report += language === 'zh-TW' ? '## 排序標準\n\n' : '## Ranking Criteria\n\n';

  for (const c of criteria) {
    report += `- **${c.name}** (權重: ${c.weight}): ${c.description}\n`;
  }
  report += '\n';

  report += language === 'zh-TW' ? '## 前 10 個目標\n\n' : '## Top 10 Candidates\n\n';

  report += '| Rank | Object | Altitude | Score | Key Factors |\n';
  report += '|------|--------|----------|-------|-------------|\n';

  for (let i = 0; i < Math.min(10, targets.length); i++) {
    const t = targets[i];
    const topCriteria = t.rankingCriteria
      .sort((a, b) => b.value * b.weight - a.value * a.weight)
      .slice(0, 2)
      .map((c) => c.criterion)
      .join(', ');

    report += `| ${i + 1} | ${t.name} | ${Math.round(t.altitude)} km | ${t.rankingScore} | ${topCriteria} |\n`;
  }

  report += '\n';
  report +=
    language === 'zh-TW'
      ? '**注意**: 實際質量、尺寸和翻滾狀態未知。需要額外的觀測和分析。\n'
      : '**NOTE**: Actual mass, dimensions, and tumble state unknown. Additional observations and analysis required.\n';

  return report;
}
