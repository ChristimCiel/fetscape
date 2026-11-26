/**
 * Fetscape v1 MVP - Preloaded Demo Data
 * For judge mode: no API keys required
 */

import type { MissionProfile, AgentTrace } from './types';
import { computeReadiness } from './readiness';

export const DEMO_MISSIONS: MissionProfile[] = [
  {
    name: 'Taiwan CubeSat Demo Mission',
    mass: 10, // 8U typical ~10kg
    orbit: {
      altitude: 510,
      inclination: 97.5,
      eccentricity: 0.001,
    },
    launchDate: '2027-03-15',
    hasNoPropulsion: true,
  },
  {
    name: 'Starlink-like Commercial Constellation',
    mass: 260,
    orbit: {
      altitude: 550,
      inclination: 53.0,
      eccentricity: 0.0001,
    },
    hasNoPropulsion: false,
  },
  {
    name: 'ISS Resupply Orbital Profile',
    mass: 7000,
    orbit: {
      altitude: 410,
      inclination: 51.6,
      eccentricity: 0.0005,
    },
    hasNoPropulsion: false,
  },
];

const defaultReadiness = computeReadiness(DEMO_MISSIONS[0]);

export const DEMO_TRACE: AgentTrace = {
  id: 'demo-trace-taiwan-cubesat',
  task: 'Mission readiness analysis for Taiwan CubeSat Demo Mission',
  steps: [
    {
      thought: 'Analyzing orbital shell density around mission altitude',
      toolCalls: [
        {
          id: 'tool-demo-1',
          tool: 'analyze_shell_density',
          arguments: {
            altitudeKm: DEMO_MISSIONS[0].orbit.altitude,
            shellThicknessKm: 50,
          },
          timestamp: Date.now(),
        },
      ],
      results: [
        {
          toolCallId: 'tool-demo-1',
          success: true,
          data: {
            targetAltitudeKm: defaultReadiness.shellAltitudeKm,
            objectsInShell: defaultReadiness.shellObjects,
            shellRangeKm: [
              defaultReadiness.shellAltitudeKm - 25,
              defaultReadiness.shellAltitudeKm + 25,
            ],
            dataSource: defaultReadiness.shellSource,
            acquiredAt: defaultReadiness.shellSnapshotDate,
          },
          timestamp: Date.now(),
        },
      ],
    },
    {
      thought: 'Estimating post-mission deorbit lifetime',
      toolCalls: [
        {
          id: 'tool-demo-2',
          tool: 'estimate_deorbit_lifetime',
          arguments: {
            altitudeKm: DEMO_MISSIONS[0].orbit.altitude,
            massKg: DEMO_MISSIONS[0].mass,
            inclination: DEMO_MISSIONS[0].orbit.inclination,
            eccentricity: DEMO_MISSIONS[0].orbit.eccentricity,
          },
          timestamp: Date.now(),
        },
      ],
      results: [
        {
          toolCallId: 'tool-demo-2',
          success: true,
          data: {
            estimatedLifetimeYears: defaultReadiness.lifetimeYears,
            complies25Year: defaultReadiness.complies25Year,
            complies5Year: defaultReadiness.complies5Year,
            method: defaultReadiness.method,
            assumptions: defaultReadiness.assumptions,
            uncertainties: defaultReadiness.uncertainties,
          },
          timestamp: Date.now(),
        },
      ],
    },
  ],
  finalResponse: undefined,
  verificationStatus: 'verified',
  createdAt: Date.now(),
  completedAt: Date.now() + 5000,
  tokenUsage: 0,
};

export type WalkthroughStep = {
  id: string;
  title: { en: string; 'zh-TW': string };
  description: { en: string; 'zh-TW': string };
  action: { en: string; 'zh-TW': string };
};

/** Build walkthrough copy from live readiness numbers (no hard-coded 1247 / 8.5). */
export function buildWalkthroughSteps(
  readiness: ReturnType<typeof computeReadiness>,
): WalkthroughStep[] {
  const life = readiness.lifetimeYears;
  const shell = readiness.shellObjects;
  const alt = readiness.shellAltitudeKm;
  const nstc = readiness.complies25Year ? 'within' : 'exceeds';
  const fcc = readiness.complies5Year ? 'within' : 'exceeds';
  const nstcZh = readiness.complies25Year ? '符合' : '超出';
  const fccZh = readiness.complies5Year ? '符合' : '超出';

  return [
    {
      id: 'intro',
      title: {
        en: 'Welcome to Fetscape',
        'zh-TW': '歡迎使用 Fetscape',
      },
      description: {
        en: 'Pre-launch readiness for smallsat teams: disposal, shell density, and a cited evidence pack. Decision support for a qualified operator.',
        'zh-TW':
          '小型衛星團隊的發射前整備：離軌處置、殼層密度與附引用的證據包。僅供合格操作員決策支援。',
      },
      action: { en: 'Next', 'zh-TW': '下一步' },
    },
    {
      id: 'mission-input',
      title: {
        en: 'Define Mission Profile',
        'zh-TW': '定義任務概況',
      },
      description: {
        en: `Default preset: Taiwan 8U CubeSat at ${alt} km SSO, mass ${DEMO_MISSIONS[0].mass} kg, no propulsion. Change the preset chips anytime.`,
        'zh-TW': `預設：台灣 8U 立方衛星、${alt} km 太陽同步軌道、質量 ${DEMO_MISSIONS[0].mass} kg、無推進。可隨時切換預設。`,
      },
      action: { en: 'Analyze', 'zh-TW': '分析' },
    },
    {
      id: 'density-analysis',
      title: {
        en: 'Orbital Shell Density',
        'zh-TW': '軌道殼層密度',
      },
      description: {
        en: `Tool output for this profile: ${shell} objects from the bundled CelesTrak derelict snapshot within ±25 km of ${alt} km (snapshot ${readiness.shellSnapshotDate}). Catalog-relative, not a full LEO census.`,
        'zh-TW': `此任務設定的工具輸出：內建 CelesTrak 廢棄物體快照中，距 ${alt} km ±25 km 有 ${shell} 個物體（快照 ${readiness.shellSnapshotDate}）。為目錄相對值，非完整 LEO 普查。`,
      },
      action: { en: 'Next', 'zh-TW': '下一步' },
    },
    {
      id: 'deorbit-analysis',
      title: {
        en: 'Deorbit Lifetime',
        'zh-TW': '離軌壽命',
      },
      description: {
        en: `Screening estimate ${life} yr (range ${readiness.lifetimeRange[0]}–${readiness.lifetimeRange[1]}). NSTC 25-year: ${nstc}. FCC 5-year: ${fcc}.`,
        'zh-TW': `篩選估計 ${life} 年（範圍 ${readiness.lifetimeRange[0]}–${readiness.lifetimeRange[1]}）。NSTC 25 年：${nstcZh}。FCC 5 年：${fccZh}。`,
      },
      action: { en: 'Next', 'zh-TW': '下一步' },
    },
    {
      id: 'regulations',
      title: {
        en: 'Regulatory Compliance',
        'zh-TW': '法規遵循',
      },
      description: {
        en: 'Citations for Taiwan NSTC and FCC disposal guidance are attached in the evidence pack for operator review.',
        'zh-TW': '證據包附有台灣 NSTC 與 FCC 離軌處置指引引用，供操作員審查。',
      },
      action: { en: 'Next', 'zh-TW': '下一步' },
    },
    {
      id: 'approval',
      title: {
        en: 'Approval Card',
        'zh-TW': '核准卡',
      },
      description: {
        en: 'Export requires explicit approval. Nothing is sent anywhere.',
        'zh-TW': '匯出需要明確核准。不會傳送到任何地方。',
      },
      action: { en: 'Next', 'zh-TW': '下一步' },
    },
    {
      id: 'complete',
      title: {
        en: 'Demo Complete',
        'zh-TW': '展示完成',
      },
      description: {
        en: 'You have walked the readiness loop with deterministic tools, verifier, and safety boundaries.',
        'zh-TW': '你已完成整備流程：確定性工具、驗證器與安全界限。',
      },
      action: { en: 'Finish', 'zh-TW': '完成' },
    },
  ];
}

/** @deprecated Prefer buildWalkthroughSteps(readiness) */
export const WALKTHROUGH_STEPS = buildWalkthroughSteps(defaultReadiness);
