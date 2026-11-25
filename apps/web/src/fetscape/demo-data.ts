/**
 * Fetscape v1 MVP - Preloaded Demo Data
 * For judge mode: no API keys required
 */

import type { MissionProfile, AgentTrace } from './types';

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

export const DEMO_TRACE: AgentTrace = {
  id: 'demo-trace-taiwan-cubesat',
  task: 'Mission readiness analysis for Taiwan CubeSat Demo Mission',
  steps: [
    {
      thought: 'Analyzing orbital shell density around 510 km',
      toolCalls: [
        {
          id: 'tool-demo-1',
          tool: 'analyze_shell_density',
          arguments: { altitudeKm: 510, shellThicknessKm: 50 },
          timestamp: Date.now(),
        },
      ],
      results: [
        {
          toolCallId: 'tool-demo-1',
          success: true,
          data: {
            targetAltitudeKm: 510,
            objectsInShell: 1247,
            shellRangeKm: [485, 535],
            nearbyBins: [
              { altitudeKm: 450, count: 892 },
              { altitudeKm: 500, count: 1247 },
              { altitudeKm: 550, count: 2103 },
            ],
            totalActive: 9847,
            dataSource: 'CelesTrak active satellites (demo data)',
            acquiredAt: new Date().toISOString(),
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
            altitudeKm: 510,
            massKg: 10,
            inclination: 97.5,
            eccentricity: 0.001,
          },
          timestamp: Date.now(),
        },
      ],
      results: [
        {
          toolCallId: 'tool-demo-2',
          success: true,
          data: {
            estimatedLifetimeYears: 8.5,
            complies25Year: true,
            complies5Year: false,
            method: 'Simplified King-Hele atmospheric drag model',
            assumptions: [
              'Drag coefficient Cd = 2.2',
              'Circular orbit approximation',
              'No propulsion or active deorbit',
              'Solar activity at moderate levels',
            ],
            uncertainties: [
              'Atmospheric density model is simplified',
              'Solar activity variations not modeled',
              'Actual lifetime may vary by factor of 2-5×',
            ],
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

export const WALKTHROUGH_STEPS = [
  {
    id: 'intro',
    title: {
      en: 'Welcome to Fetscape AI-Native Workspace',
      'zh-TW': '歡迎使用 Fetscape AI 原生工作空間',
    },
    description: {
      en: "This is an AI-native space operations workspace where AI is the core of the product, not just a chatbot. Let's walk through a mission readiness analysis.",
      'zh-TW':
        '這是一個 AI 原生太空作業工作空間，AI 是產品的核心，而不僅僅是聊天機器人。讓我們逐步進行任務整備度分析。',
    },
    action: {
      en: 'Start Analysis',
      'zh-TW': '開始分析',
    },
  },
  {
    id: 'mission-input',
    title: {
      en: 'Step 1: Define Mission Profile',
      'zh-TW': '步驟 1：定義任務概況',
    },
    description: {
      en: "We'll analyze a typical Taiwan 8U cubesat mission: SSO orbit at 510 km, no propulsion, launching in 2027.",
      'zh-TW':
        '我們將分析一個典型的台灣 8U 立方衛星任務：太陽同步軌道 510 公里，無推進系統，2027 年發射。',
    },
    action: {
      en: 'Analyze',
      'zh-TW': '分析',
    },
  },
  {
    id: 'density-analysis',
    title: {
      en: 'Step 2: Orbital Shell Density',
      'zh-TW': '步驟 2：軌道殼層密度',
    },
    description: {
      en: 'The agent fetches CelesTrak data and analyzes the shell density. At 510 km, there are approximately 1,247 active objects within ±25 km.',
      'zh-TW':
        '代理抓取 CelesTrak 資料並分析殼層密度。在 510 公里處，±25 公里範圍內約有 1,247 個活躍物體。',
    },
    action: {
      en: 'Next',
      'zh-TW': '下一步',
    },
  },
  {
    id: 'deorbit-analysis',
    title: {
      en: 'Step 3: Deorbit Lifetime',
      'zh-TW': '步驟 3：離軌壽命',
    },
    description: {
      en: 'Without propulsion, the estimated atmospheric drag lifetime is 8.5 years. This complies with NSTC 25-year rule but exceeds FCC 5-year limit.',
      'zh-TW':
        '在沒有推進系統的情況下，估計的大氣阻力壽命為 8.5 年。這符合 NSTC 25 年規則，但超過 FCC 5 年限制。',
    },
    action: {
      en: 'Next',
      'zh-TW': '下一步',
    },
  },
  {
    id: 'regulations',
    title: {
      en: 'Step 4: Regulatory Compliance',
      'zh-TW': '步驟 4：法規遵循',
    },
    description: {
      en: 'The agent retrieves relevant Taiwan NSTC and FCC regulations with citations. It generates a compliance checklist for registration review.',
      'zh-TW':
        '代理檢索相關的台灣 NSTC 和 FCC 法規並附上引用。它產生一個合規檢查清單用於登錄審查。',
    },
    action: {
      en: 'Next',
      'zh-TW': '下一步',
    },
  },
  {
    id: 'approval',
    title: {
      en: 'Step 5: Approval Card',
      'zh-TW': '步驟 5：核准卡',
    },
    description: {
      en: 'Before exporting the evidence pack, explicit user approval is required. No automatic file generation or external communications.',
      'zh-TW': '在匯出證據包之前，需要明確的使用者核准。無自動檔案產生或外部通訊。',
    },
    action: {
      en: 'Approve Export',
      'zh-TW': '核准匯出',
    },
  },
  {
    id: 'complete',
    title: {
      en: 'Demo Complete',
      'zh-TW': '展示完成',
    },
    description: {
      en: "You've seen how Fetscape uses AI as the core orchestrator with deterministic tools, verifier, and safety boundaries. Ready for real missions with BYOK API keys.",
      'zh-TW':
        '您已經看到 Fetscape 如何使用 AI 作為核心編排器，配備確定性工具、驗證器和安全界限。已準備好使用 BYOK API 金鑰進行真實任務。',
    },
    action: {
      en: 'Finish',
      'zh-TW': '完成',
    },
  },
];
