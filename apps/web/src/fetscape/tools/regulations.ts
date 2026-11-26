/**
 * Fetscape v1 MVP - Regulation Retrieval Database
 * Simplified regulatory citation system
 */

import type { RegulationCitation } from '../types';

export const REGULATIONS_DB: Record<string, RegulationCitation[]> = {
  taiwan: [
    {
      source: 'NSTC 太空載具登錄審查基準 (2025-12-02修正)',
      section: '4.4.1.3',
      text: '避碰資訊來源、方法及決策條件（如使用 Space-Track/CSpOC 資料）',
      url: 'https://gazette.nat.gov.tw/egFront/detail.do?metaid=148827',
    },
    {
      source: 'NSTC 太空載具登錄審查基準 (2025-12-02修正)',
      section: '5.2',
      text: 'LEO 軌道運行載具應於任務結束後 25 年內移離軌道',
      url: 'https://gazette.nat.gov.tw/egFront/detail.do?metaid=148827',
    },
    {
      source: 'NSTC 太空載具登錄審查基準',
      section: '營運計畫',
      text: '應載明避碰資訊來源、判斷方法、決策條件及太空載具除役處置方式',
    },
  ],

  fcc: [
    {
      source: 'FCC Space Debris Mitigation Rules',
      section: '25.283',
      text: '5-year post-mission disposal requirement for satellites launched after September 29, 2024',
      url: 'https://www.fcc.gov/space-debris-mitigation',
    },
    {
      source: 'FCC Space Debris FAQ',
      section: 'Disposal Compliance',
      text: 'The 5-year rule applies to both U.S. licensed satellites and non-U.S. satellites seeking FCC market access',
    },
    {
      source: 'FCC Space Debris FAQ',
      section: 'DAS Analysis',
      text: 'Debris Assessment Software (DAS) output alone is insufficient for demonstrating PMD compliance. Detailed mission plan required.',
    },
  ],

  iadc: [
    {
      source: 'IADC Space Debris Mitigation Guidelines',
      section: '5.3.2',
      text: 'LEO protected region: 2000 km altitude and below. Orbital lifetime should be limited to 25 years after end of mission.',
      url: 'https://www.iadc-home.org/',
    },
  ],

  uncopuos: [
    {
      source: 'UN COPUOS Space Debris Mitigation Guidelines',
      section: 'Guideline 6',
      text: 'Limit the long-term presence of spacecraft and launch vehicle orbital stages in the low-Earth orbit (LEO) region after the end of their mission.',
      url: 'https://www.unoosa.org/oosa/en/ourwork/topics/space-debris/index.html',
    },
  ],
};

export function retrieveRegulations(context: {
  jurisdiction?: 'taiwan' | 'fcc' | 'international';
  missionType?: 'leo' | 'geo' | 'meo';
  hasNoPropulsion?: boolean;
}): RegulationCitation[] {
  const citations: RegulationCitation[] = [];

  if (context.jurisdiction === 'taiwan' || context.jurisdiction === undefined) {
    citations.push(...REGULATIONS_DB.taiwan);
  }

  if (context.jurisdiction === 'fcc' || context.jurisdiction === undefined) {
    citations.push(...REGULATIONS_DB.fcc);
  }

  if (context.jurisdiction === 'international' || context.jurisdiction === undefined) {
    citations.push(...REGULATIONS_DB.iadc.slice(0, 1));
    citations.push(...REGULATIONS_DB.uncopuos.slice(0, 1));
  }

  return citations;
}

export function generateComplianceChecklist(profile: {
  hasNoPropulsion: boolean;
  altitude: number;
  estimatedLifetime: number;
}): { item: string; status: 'required' | 'recommended' | 'n/a'; notes: string }[] {
  const checklist: { item: string; status: 'required' | 'recommended' | 'n/a'; notes: string }[] =
    [];

  checklist.push({
    item: 'Register with national space agency (TASA for Taiwan)',
    status: 'required',
    notes: '依太空載具登錄審查基準提交營運計畫',
  });

  checklist.push({
    item: 'Document collision avoidance data sources and decision criteria',
    status: 'required',
    notes: 'Specify SSA provider (e.g., Space-Track, commercial SSA)',
  });

  checklist.push({
    item: 'Post-mission disposal plan',
    status: 'required',
    notes: profile.hasNoPropulsion
      ? 'Passive atmospheric decay. Document estimated lifetime.'
      : 'Active deorbit maneuver plan required.',
  });

  if (profile.estimatedLifetime > 5) {
    checklist.push({
      item: 'FCC market access waiver or compliance demonstration',
      status: 'required',
      notes: 'Lifetime exceeds 5-year FCC limit. Waiver may be required for U.S. operations.',
    });
  }

  if (profile.altitude > 600) {
    checklist.push({
      item: 'Enhanced deorbit system',
      status: 'recommended',
      notes: 'Consider drag sail, electrodynamic tether, or propulsion for higher altitudes.',
    });
  }

  checklist.push({
    item: 'Coordination with licensed SSA provider',
    status: 'recommended',
    notes: 'Partner with LeoLabs, COMSPOC, or similar for operational conjunction assessment.',
  });

  return checklist;
}

export function formatRegulationCitations(
  citations: RegulationCitation[],
  language: 'en' | 'zh-TW',
): string {
  let output = language === 'zh-TW' ? '## 相關法規引用\n\n' : '## Applicable Regulations\n\n';

  for (const citation of citations) {
    output += `### ${citation.source}\n`;
    output += `**${citation.section}**: ${citation.text}\n`;
    if (citation.url) {
      output += `📄 [${language === 'zh-TW' ? '完整文件' : 'Full document'}](${citation.url})\n`;
    }
    output += '\n';
  }

  return output;
}
