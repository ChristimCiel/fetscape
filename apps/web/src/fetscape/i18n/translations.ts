/**
 * Fetscape v1 MVP - Bilingual Support (Traditional Chinese / English)
 */

import type { Language } from '../types';

export const translations = {
  en: {
    appName: 'Fetscape',
    tagline: 'AI-Native Space Operations Workspace',
    judgeMode: 'Judge Mode',

    lanes: {
      missionReadiness: 'Mission Readiness',
      debrisRemoval: 'Debris Removal Planning',
    },

    missionReadiness: {
      title: 'Mission-Readiness Agent',
      subtitle: 'Pre-launch to L+90 days compliance and analysis',
      inputPrompt:
        'Describe your mission (e.g., "8U cubesat, SSO 510km, no propulsion, launch 2027-03")',
      analyze: 'Analyze Mission',
      analyzing: 'Analyzing mission requirements...',

      sections: {
        orbitalDensity: 'Orbital Shell Density',
        closeApproaches: 'Close Approach Screening',
        deorbitLifetime: 'Deorbit Lifetime Analysis',
        regulations: 'Regulatory Compliance',
        evidencePack: 'Evidence Pack',
      },

      disclaimers: {
        geometricOnly: 'Geometric screening only. Not probability of collision (Pc).',
        decisionSupport:
          'Decision support tool. Human review required for all operational decisions.',
        noManeuvers: 'No maneuver recommendations provided. Consult qualified operators.',
        noCommanding: 'This system cannot command satellites.',
      },
    },

    debrisRemoval: {
      title: 'Debris-Removal Mission Planner',
      subtitle: 'Concept study tool for ADR mission exploration',
      selectTarget: 'Rank and select debris targets',
      analyzing: 'Analyzing debris removal options...',

      sections: {
        targetRanking: 'Target Ranking',
        missionConcept: 'Mission Concept',
        captureReplay: 'Capture Rehearsal',
        feasibility: 'Feasibility Assessment',
      },

      disclaimers: {
        conceptOnly: 'Concept study tool. Not validated for actual mission planning.',
        noPhysical: 'No physical AI or robotics validation. Geometric analysis only.',
        partnerRequired: 'Requires design partner collaboration and licensed SSA data.',
      },
    },

    common: {
      loading: 'Loading...',
      error: 'Error',
      export: 'Export',
      approve: 'Approve',
      reject: 'Reject',
      pending: 'Pending approval',
      approved: 'Approved',
      rejected: 'Rejected',
      disclaimer: 'Disclaimer',
      dataSource: 'Data Source',
      timestamp: 'Timestamp',
      verification: 'Verification',
      verified: 'Verified',
      passed: 'Passed',
      blocked: 'Blocked',
      warnings: 'Warnings',
    },

    safety: {
      title: 'Safety Boundaries Enforced',
      violations: 'Safety Violations Detected',
      noViolations: 'No safety violations',
      types: {
        prohibited_term: 'Prohibited terminology',
        unsupported_claim: 'Unsupported claim',
        maneuver_advice: 'Maneuver advice not permitted',
        commanding: 'Satellite commanding not permitted',
      },
    },

    judge: {
      title: 'Judge Mode',
      description: 'Offline demo with preloaded data. No API keys required.',
      startDemo: 'Start Walkthrough',
      nextStep: 'Next Step',
      prevStep: 'Previous Step',
      finish: 'Finish Demo',
    },

    approval: {
      title: 'Approval Required',
      description: 'This action requires explicit user approval before proceeding.',
      exportReport: 'Export evidence pack report',
      generateFile: 'Generate compliance document',
      types: {
        export: 'Export Data',
        file: 'Generate File',
        email: 'Draft Email',
        draft: 'Draft Document',
      },
    },
  },

  'zh-TW': {
    appName: 'Fetscape',
    tagline: 'AI 原生太空作業工作空間',
    judgeMode: '評審模式',

    lanes: {
      missionReadiness: '任務整備度',
      debrisRemoval: '太空碎片清除規劃',
    },

    missionReadiness: {
      title: '任務整備度智能代理',
      subtitle: '發射前至入軌後 90 日合規性與分析',
      inputPrompt:
        '描述您的任務（例如："8U 立方衛星，太陽同步軌道 510 公里，無推進系統，2027 年 3 月發射"）',
      analyze: '分析任務',
      analyzing: '正在分析任務需求...',

      sections: {
        orbitalDensity: '軌道殼層密度',
        closeApproaches: '接近事件篩選',
        deorbitLifetime: '離軌壽命分析',
        regulations: '法規遵循',
        evidencePack: '證據包',
      },

      disclaimers: {
        geometricOnly: '僅幾何篩選。非碰撞機率 (Pc)。',
        decisionSupport: '決策支援工具。所有操作決策需人工審查。',
        noManeuvers: '不提供機動建議。請諮詢合格操作員。',
        noCommanding: '本系統無法指揮衛星。',
      },
    },

    debrisRemoval: {
      title: '太空碎片清除任務規劃器',
      subtitle: 'ADR 任務探索之概念研究工具',
      selectTarget: '排序並選擇碎片目標',
      analyzing: '正在分析碎片清除選項...',

      sections: {
        targetRanking: '目標排序',
        missionConcept: '任務概念',
        captureReplay: '捕獲演練',
        feasibility: '可行性評估',
      },

      disclaimers: {
        conceptOnly: '概念研究工具。未驗證用於實際任務規劃。',
        noPhysical: '無實體 AI 或機器人驗證。僅幾何分析。',
        partnerRequired: '需要設計夥伴合作及授權 SSA 資料。',
      },
    },

    common: {
      loading: '載入中...',
      error: '錯誤',
      export: '匯出',
      approve: '核准',
      reject: '拒絕',
      pending: '等待核准',
      approved: '已核准',
      rejected: '已拒絕',
      disclaimer: '免責聲明',
      dataSource: '資料來源',
      timestamp: '時間戳記',
      verification: '驗證',
      verified: '已驗證',
      passed: '通過',
      blocked: '已封鎖',
      warnings: '警告',
    },

    safety: {
      title: '已實施安全界限',
      violations: '檢測到安全違規',
      noViolations: '無安全違規',
      types: {
        prohibited_term: '禁用術語',
        unsupported_claim: '不支援的聲明',
        maneuver_advice: '不允許機動建議',
        commanding: '不允許衛星指揮',
      },
    },

    judge: {
      title: '評審模式',
      description: '離線展示，含預載資料。無需 API 金鑰。',
      startDemo: '開始導覽',
      nextStep: '下一步',
      prevStep: '上一步',
      finish: '完成展示',
    },

    approval: {
      title: '需要核准',
      description: '此操作在繼續前需要明確的使用者核准。',
      exportReport: '匯出證據包報告',
      generateFile: '產生合規文件',
      types: {
        export: '匯出資料',
        file: '產生檔案',
        email: '草擬電子郵件',
        draft: '草擬文件',
      },
    },
  },
} as const;

export function t(key: string, lang: Language = 'en'): string {
  const keys = key.split('.');
  let value: any = translations[lang];

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      console.warn(`Translation missing: ${key} (${lang})`);
      return key;
    }
  }

  return String(value);
}
