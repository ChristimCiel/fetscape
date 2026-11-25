/**
 * Fetscape v1 MVP - Safety Linter
 * Enforces hard safety boundaries:
 * 1. No geometric proximity presented as Pc or "collision risk"
 * 2. No maneuver advice
 * 3. No satellite commanding
 */

import type { SafetyViolation } from '../types';

const PROHIBITED_TERMS = {
  collisionRisk: [
    /collision\s+risk/i,
    /risk\s+of\s+collision/i,
    /probability\s+of\s+collision/i,
    /Pc\s*=\s*[\d.]+/i,
    /calculated\s+Pc/i,
    /estimated\s+Pc/i,
    /Pc\s+value/i,
    /碰撞風險/,
    /碰撞機率/,
  ],

  maneuverAdvice: [
    /\brecommend(ed|s)?\s+(a\s+)?(burn|maneuver|delta-?v)/i,
    /\bsuggest(ed|s)?\s+(a\s+)?(burn|maneuver)/i,
    /\bexecute\s+(a\s+)?(burn|maneuver)/i,
    /\bperform\s+(a\s+)?maneuver/i,
    /\boptimal\s+(burn|maneuver)/i,
    /\byou\s+should\s+(burn|maneuver)/i,
    /建議.*?(?:燃燒|機動)/,
    /執行.*?(?:燃燒|機動)/,
    /最佳.*?(?:燃燒|機動)/,
  ],

  commanding: [
    /\bcommand\s+the\s+satellite\b/i,
    /\bsend\s+command\b/i,
    /\bexecute\s+command\b/i,
    /\buplink\s+command\b/i,
    /\bground\s+command\b/i,
    /\bautonomous\s+command\b/i,
    /\b指揮衛星\b/,
    /\b發送指令\b/,
    /\b執行指令\b/,
  ],

  misleading: [
    /\bsafe\s+orbit\b/i,
    /\bno\s+collision\s+risk\b/i,
    /\bguarantee.*?safe/i,
    /\bprecise\s+Pc\b/i,
    /\b安全軌道\b/,
    /\b無碰撞風險\b/,
    /\b保證安全\b/,
  ],
};

const REQUIRED_DISCLAIMERS = {
  geometricScreening: [
    /geometric\s+screening\s+only/i,
    /not\s+Pc/i,
    /not\s+probability\s+of\s+collision/i,
    /僅幾何篩選/,
    /非碰撞機率/,
  ],

  decisionSupport: [
    /decision\s+support/i,
    /human\s+review\s+required/i,
    /qualified\s+operator/i,
    /決策支援/,
    /需人工審查/,
  ],

  noManeuvers: [
    /no\s+maneuver\s+(advice|recommendations?)/i,
    /consult.*?operator/i,
    /不提供.*?機動/,
    /諮詢.*?操作員/,
  ],
};

export class SafetyLinter {
  lint(text: string): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    for (const [category, patterns] of Object.entries(PROHIBITED_TERMS)) {
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          const type = this.categorizeViolation(category);
          violations.push({
            type,
            content: matches[0],
            context: this.extractContext(text, matches.index ?? 0, 100),
            severity: 'error',
          });
        }
      }
    }

    return violations;
  }

  checkDisclaimers(text: string): { missing: string[]; present: string[] } {
    const missing: string[] = [];
    const present: string[] = [];

    for (const [category, patterns] of Object.entries(REQUIRED_DISCLAIMERS)) {
      const hasDisclaimer = patterns.some((pattern) => pattern.test(text));
      if (hasDisclaimer) {
        present.push(category);
      } else {
        if (this.shouldHaveDisclaimer(text, category)) {
          missing.push(category);
        }
      }
    }

    return { missing, present };
  }

  private categorizeViolation(category: string): SafetyViolation['type'] {
    switch (category) {
      case 'maneuverAdvice':
        return 'maneuver_advice';
      case 'commanding':
        return 'commanding';
      default:
        return 'prohibited_term';
    }
  }

  private extractContext(text: string, index: number, length: number): string {
    const start = Math.max(0, index - length / 2);
    const end = Math.min(text.length, index + length / 2);
    return text.slice(start, end).trim();
  }

  private shouldHaveDisclaimer(text: string, category: string): boolean {
    const lowerText = text.toLowerCase();

    if (category === 'geometricScreening') {
      return (
        lowerText.includes('miss') ||
        lowerText.includes('approach') ||
        lowerText.includes('tca') ||
        lowerText.includes('接近') ||
        lowerText.includes('距離')
      );
    }

    if (category === 'decisionSupport') {
      return (
        lowerText.includes('recommend') ||
        lowerText.includes('suggest') ||
        lowerText.includes('option') ||
        lowerText.includes('建議') ||
        lowerText.includes('選項')
      );
    }

    if (category === 'noManeuvers') {
      return (
        lowerText.includes('delta') ||
        lowerText.includes('burn') ||
        lowerText.includes('transfer') ||
        lowerText.includes('機動') ||
        lowerText.includes('燃燒')
      );
    }

    return false;
  }

  ensureCompliance(text: string): {
    compliant: boolean;
    violations: SafetyViolation[];
    needsDisclaimers: string[];
  } {
    const violations = this.lint(text);
    const { missing } = this.checkDisclaimers(text);

    return {
      compliant: violations.length === 0 && missing.length === 0,
      violations,
      needsDisclaimers: missing,
    };
  }
}

export function filterDocked(objects: { name: string; catalogId?: string }[]): typeof objects {
  const dockedPatterns = [
    /^ISS\s*\(/i,
    /ZARYA/i,
    /ZVEZDA/i,
    /UNITY/i,
    /DESTINY/i,
    /PROGRESS[-\s]MS/i,
    /SOYUZ[-\s]MS/i,
    /DRAGON.*ENDEAV/i,
    /CREW.*DRAGON/i,
  ];

  const dockedIds = new Set<string>();

  objects.forEach((obj, idx) => {
    const matchesPattern = dockedPatterns.some((p) => p.test(obj.name));
    if (matchesPattern) {
      const id = obj.catalogId ?? obj.name;
      dockedIds.add(id);

      // Also mark nearby objects in the list as potentially docked
      objects.forEach((other, otherIdx) => {
        if (idx !== otherIdx) {
          const distance = Math.abs(idx - otherIdx);
          if (distance <= 2 && obj.catalogId && other.catalogId) {
            const otherMatchesPattern = dockedPatterns.some((p) => p.test(other.name));
            if (otherMatchesPattern) {
              dockedIds.add(other.catalogId);
            }
          }
        }
      });
    }
  });

  return objects.filter((obj) => !dockedIds.has(obj.catalogId ?? obj.name));
}

export function ensureGeometricLabel(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('miss distance') || text.includes('距離') || text.includes('接近')) {
    if (!lowerText.includes('geometric') && !text.includes('幾何')) {
      return text + '\n\n[Geometric screening only. Not probability of collision.]';
    }
  }
  return text;
}
