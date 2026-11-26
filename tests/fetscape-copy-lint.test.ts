/**
 * Lint every translated UI string with SafetyLinter.
 */

import { describe, it, expect } from 'vitest';
import { SafetyLinter } from '../apps/web/src/fetscape/safety/linter';
import { translations } from '../apps/web/src/fetscape/i18n/translations';
import { allSuiteStrings } from '../apps/web/src/suite/i18n';
import { buildWalkthroughSteps } from '../apps/web/src/fetscape/demo-data';
import { computeReadiness } from '../apps/web/src/fetscape/readiness';
import { DEMO_MISSIONS } from '../apps/web/src/fetscape/demo-data';

function collectLeaves(node: unknown, path = ''): { path: string; value: string }[] {
  if (typeof node === 'string') return [{ path, value: node }];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    collectLeaves(v, path ? `${path}.${k}` : k),
  );
}

describe('SafetyLinter over product copy', () => {
  const linter = new SafetyLinter();

  it('finds zero violations in translations.ts dictionary', () => {
    const strings = [
      ...collectLeaves(translations.en, 'en'),
      ...collectLeaves(translations['zh-TW'], 'zh-TW'),
    ];
    expect(strings.length).toBeGreaterThan(20);
    for (const s of strings) {
      const violations = linter.lint(s.value);
      expect(violations, `${s.path}: ${s.value}`).toEqual([]);
    }
  });

  it('finds zero violations in suite i18n + walkthrough copy', () => {
    for (const s of allSuiteStrings()) {
      const violations = linter.lint(s.value);
      expect(violations, `suite ${s.lang}.${s.key}: ${s.value}`).toEqual([]);
    }
    const steps = buildWalkthroughSteps(computeReadiness(DEMO_MISSIONS[0]));
    for (const step of steps) {
      for (const lang of ['en', 'zh-TW'] as const) {
        for (const field of ['title', 'description', 'action'] as const) {
          const value = step[field][lang];
          const violations = linter.lint(value);
          expect(violations, `${step.id}.${field}.${lang}`).toEqual([]);
        }
      }
    }
  });
});
