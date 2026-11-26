/**
 * ADR target ranking — explainable decision support from public GP data.
 * Scores cite data sources. No maneuver advice, no Pc, no commanding.
 */

import type { DebrisTarget, MissionConcept } from '../types';
import { calculateMeanAltitude } from './celestrak';
import type { GPObject } from './celestrak';
import { estimateDeorbitLifetime } from './deorbit';
import derelictSnapshot from '../replay/celestrak-derelict-snapshot.json';

export interface RankingCriteria {
  name: string;
  weight: number;
  description: string;
}

export interface ScoredCriterion {
  criterion: string;
  value: number | string;
  weight: number;
  score: number;
  source: string;
  tradeOff: string;
}

export interface RankedDerelict extends DebrisTarget {
  objectClass: 'rocket_body' | 'dead_payload' | 'debris_fragment' | 'unknown';
  estimatedLifetimeYears: number;
  shellDensityNearby: number;
  sizeMassClass: 'unknown' | 'fragment' | 'small_sat' | 'upper_stage_or_large';
  criteriaDetail: ScoredCriterion[];
  dataSource: string;
  contentSha256?: string;
}

export const DEFAULT_CRITERIA: RankingCriteria[] = [
  {
    name: 'altitude_band',
    weight: 0.3,
    description:
      'Prefer LEO bands where a servicer can reach with less transfer effort (400–700 km).',
  },
  {
    name: 'natural_decay_lifetime',
    weight: 0.25,
    description:
      'Longer estimated natural decay raises priority for active removal consideration (screening estimate only).',
  },
  {
    name: 'shell_density',
    weight: 0.2,
    description:
      'Objects in denser mean-altitude shells may have higher mission relevance for cleanup studies.',
  },
  {
    name: 'size_mass_class',
    weight: 0.25,
    description:
      'Approximate class from public naming conventions (R/B, parent payload, DEB). Mass/size are not measured from GP.',
  },
];

export function getBundledDerelictCatalog(): {
  objects: GPObject[];
  meta: {
    source: string;
    sourceUrls: string[];
    acquiredAt: string;
    contentSha256: string;
    note: string;
  };
} {
  const snap = derelictSnapshot as {
    objects: GPObject[];
    source: string;
    sourceUrls: string[];
    acquiredAt: string;
    contentSha256: string;
    note: string;
  };
  return {
    objects: snap.objects,
    meta: {
      source: snap.source,
      sourceUrls: snap.sourceUrls,
      acquiredAt: snap.acquiredAt,
      contentSha256: snap.contentSha256,
      note: snap.note,
    },
  };
}

export function classifyDerelict(name: string): RankedDerelict['objectClass'] {
  const n = name.toUpperCase();
  if (n.includes('R/B') || n.includes('FREGAT') || n.includes('STAGE')) return 'rocket_body';
  if (n.includes('DEB')) return 'debris_fragment';
  if (n.includes('COSMOS 2251') || n.includes('IRIDIUM 33') || n.includes('FENGYUN'))
    return 'dead_payload';
  return 'unknown';
}

export function sizeMassClassFromName(name: string): RankedDerelict['sizeMassClass'] {
  const cls = classifyDerelict(name);
  if (cls === 'rocket_body' || cls === 'dead_payload') return 'upper_stage_or_large';
  if (cls === 'debris_fragment') return 'fragment';
  return 'unknown';
}

function shellCounts(objects: GPObject[], binKm = 50): Map<number, number> {
  const bins = new Map<number, number>();
  for (const obj of objects) {
    const alt = calculateMeanAltitude(obj.MEAN_MOTION);
    const key = Math.floor(alt / binKm) * binKm;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  return bins;
}

export function rankDerelictTargets(
  objects: GPObject[],
  options?: {
    criteria?: RankingCriteria[];
    catalogForDensity?: GPObject[];
    dataSource?: string;
    contentSha256?: string;
  },
): RankedDerelict[] {
  const criteria = options?.criteria ?? DEFAULT_CRITERIA;
  const densityCatalog = options?.catalogForDensity ?? objects;
  const bins = shellCounts(densityCatalog);
  const dataSource = options?.dataSource ?? 'Bundled CelesTrak GP snapshot';
  const targets: RankedDerelict[] = [];

  for (const obj of objects) {
    const altitude = calculateMeanAltitude(obj.MEAN_MOTION);
    const lifetime = estimateDeorbitLifetime({
      altitudeKm: altitude,
      inclination: obj.INCLINATION,
      eccentricity: obj.ECCENTRICITY,
    });
    const bin = Math.floor(altitude / 50) * 50;
    const shellDensityNearby = bins.get(bin) ?? 0;
    const objectClass = classifyDerelict(obj.OBJECT_NAME);
    const sizeMassClass = sizeMassClassFromName(obj.OBJECT_NAME);

    const detail: ScoredCriterion[] = [];

    // Altitude band (0–1)
    const altScore =
      altitude >= 400 && altitude <= 700
        ? 1
        : altitude < 400
          ? Math.max(0, 1 - (400 - altitude) / 200)
          : Math.max(0, 1 - (altitude - 700) / 500);
    detail.push({
      criterion: 'altitude_band',
      value: `${Math.round(altitude)} km mean-altitude proxy`,
      weight: criteria.find((c) => c.name === 'altitude_band')?.weight ?? 0.3,
      score: altScore,
      source: `${dataSource} · MEAN_MOTION→a−Re`,
      tradeOff:
        altitude < 400
          ? 'Lower band: shorter natural decay, less urgency for ADR concept studies.'
          : altitude > 700
            ? 'Higher band: harder to reach; trade against lifetime score.'
            : 'Mid LEO band: accessible for concept-study comparison.',
    });

    // Natural decay lifetime — longer lifetime → higher removal-study priority
    const lifeYears = lifetime.estimatedLifetimeYears;
    const lifeScore = Math.min(1, Math.log10(Math.max(lifeYears, 0.1) + 1) / Math.log10(101));
    detail.push({
      criterion: 'natural_decay_lifetime',
      value: `${lifeYears} yr (screening estimate)`,
      weight: criteria.find((c) => c.name === 'natural_decay_lifetime')?.weight ?? 0.25,
      score: lifeScore,
      source: 'Fetscape empirical drag screening model (not operational DAS)',
      tradeOff:
        lifeYears <= 25
          ? 'May meet 25-year guideline passively — ADR still optional for concept comparison.'
          : 'Long natural lifetime — higher priority in removal concept studies.',
    });

    // Shell density
    const maxInCatalog = Math.max(...bins.values(), 1);
    const densityScore = shellDensityNearby / maxInCatalog;
    detail.push({
      criterion: 'shell_density',
      value: `${shellDensityNearby} objects in ±25 km mean-altitude bin (catalog-relative)`,
      weight: criteria.find((c) => c.name === 'shell_density')?.weight ?? 0.2,
      score: densityScore,
      source: `${dataSource} · local shell histogram`,
      tradeOff:
        densityScore > 0.5
          ? 'Denser shell in this snapshot — higher relative cleanup interest.'
          : 'Sparser shell in this snapshot — lower relative cleanup interest.',
    });

    // Size/mass class from naming only
    const classScore =
      sizeMassClass === 'upper_stage_or_large'
        ? 1
        : sizeMassClass === 'small_sat'
          ? 0.6
          : sizeMassClass === 'fragment'
            ? 0.35
            : 0.2;
    detail.push({
      criterion: 'size_mass_class',
      value: `${sizeMassClass} (from OBJECT_NAME convention only)`,
      weight: criteria.find((c) => c.name === 'size_mass_class')?.weight ?? 0.25,
      score: classScore,
      source: 'CelesTrak OBJECT_NAME heuristics — mass/size not in GP',
      tradeOff:
        sizeMassClass === 'unknown'
          ? 'No size/mass in GP; treat as unknown until partner data arrives.'
          : 'Class is approximate; not a measured mass or radar cross-section.',
    });

    const rankingScore =
      Math.round(detail.reduce((sum, d) => sum + d.score * d.weight, 0) * 1000) / 1000;

    targets.push({
      id: `norad-${obj.NORAD_CAT_ID}`,
      name: obj.OBJECT_NAME,
      catalogId: String(obj.NORAD_CAT_ID),
      altitude,
      inclination: obj.INCLINATION,
      mass: undefined,
      size: undefined,
      rankingScore,
      rankingCriteria: detail.map((d) => ({
        criterion: d.criterion,
        value: typeof d.value === 'number' ? d.value : d.score,
        weight: d.weight,
      })),
      feasibilityNotes: [
        'Decision support for a qualified operator only.',
        'No maneuver plan, burn recommendation, or satellite commanding.',
        'Geometric / catalog screening only — not Pc.',
        'Mass, tumble, and capture readiness remain unknown from GP.',
      ],
      objectClass,
      estimatedLifetimeYears: lifeYears,
      shellDensityNearby,
      sizeMassClass,
      criteriaDetail: detail,
      dataSource,
      contentSha256: options?.contentSha256,
    });
  }

  targets.sort((a, b) => b.rankingScore - a.rankingScore);
  return targets;
}

/** @deprecated Prefer rankDerelictTargets for explainable ADR scoring. */
export function rankDebrisTargets(
  objects: GPObject[],
  criteria: RankingCriteria[] = DEFAULT_CRITERIA,
): DebrisTarget[] {
  return rankDerelictTargets(objects, { criteria });
}

export function generateMissionConcept(target: DebrisTarget): MissionConcept {
  return {
    targetId: target.id,
    captureApproach:
      'Concept study only. Compare options and missing data; do not treat as a flight plan.',
    risks: [
      'Target mass, dimensions, and inertia unknown from GP',
      'Tumble / attitude unknown',
      'No validated capture mechanism for this target in Fetscape',
    ],
    requiredData: [
      'Licensed SSA ephemeris and covariance',
      'Optical / radar characterization',
      'Partner authorization and mission constraints',
    ],
  };
}

export function formatDebrisRankingReport(
  targets: RankedDerelict[],
  language: 'en' | 'zh-TW' = 'en',
): string {
  let report =
    language === 'zh-TW'
      ? '# 太空碎片清除目標排序（決策支援）\n\n'
      : '# ADR Target Ranking (Decision Support)\n\n';
  report +=
    language === 'zh-TW'
      ? '**僅供合格操作員決策支援。** 不提供機動建議、衛星指令，亦不計算 Pc。\n\n'
      : '**Decision support for a qualified operator only.** No maneuver advice, no satellite commanding, and no probability of collision (Pc).\n\n';

  if (targets[0]?.dataSource) {
    report +=
      language === 'zh-TW'
        ? `**資料來源**: ${targets[0].dataSource}\n`
        : `**Data source**: ${targets[0].dataSource}\n`;
    if (targets[0].contentSha256)
      report += `**SHA-256**: \`${targets[0].contentSha256.slice(0, 16)}…\`\n`;
    report += '\n';
  }

  report += '| Rank | Object | Class | Alt (km) | Lifetime (yr) | Shell N | Score |\n';
  report += '|------|--------|-------|----------|---------------|---------|-------|\n';
  targets.slice(0, 12).forEach((t, i) => {
    report += `| ${i + 1} | ${t.name} | ${t.objectClass} | ${Math.round(t.altitude)} | ${t.estimatedLifetimeYears} | ${t.shellDensityNearby} | ${t.rankingScore} |\n`;
  });
  report += '\n';

  for (const t of targets.slice(0, 3)) {
    report += `### ${t.name}\n`;
    for (const c of t.criteriaDetail) {
      report += `- **${c.criterion}** (w=${c.weight}, score=${c.score.toFixed(2)}): ${c.value}\n`;
      report += `  - source: ${c.source}\n`;
      report += `  - trade-off: ${c.tradeOff}\n`;
    }
    report += '\n';
  }
  return report;
}
