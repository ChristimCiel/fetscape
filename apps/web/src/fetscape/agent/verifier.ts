/**
 * Fetscape v1 MVP - Verifier
 * Checks every generated sentence and number against tool outputs
 * Blocks unsupported claims
 */

import type { VerificationResult, SafetyViolation, ToolResult } from '../types';
import { SafetyLinter } from '../safety/linter';

export class Verifier {
  private linter: SafetyLinter;

  constructor() {
    this.linter = new SafetyLinter();
  }

  verify(generatedText: string, toolResults: ToolResult[]): VerificationResult {
    const violations: SafetyViolation[] = [];
    const supportedClaims: string[] = [];
    const unsupportedClaims: string[] = [];

    // Check safety boundaries
    const safetyViolations = this.linter.lint(generatedText);
    violations.push(...safetyViolations);

    // Check disclaimers
    const { missing, present } = this.linter.checkDisclaimers(generatedText);
    for (const missingDisclaimer of missing) {
      violations.push({
        type: 'unsupported_claim',
        content: `Missing required disclaimer: ${missingDisclaimer}`,
        context: 'Document safety disclaimers',
        severity: 'warning',
      });
    }

    // Extract numerical claims
    const numericalClaims = this.extractNumericalClaims(generatedText);
    for (const claim of numericalClaims) {
      if (this.isSupported(claim, toolResults)) {
        supportedClaims.push(claim.text);
      } else {
        unsupportedClaims.push(claim.text);
        violations.push({
          type: 'unsupported_claim',
          content: claim.text,
          context: claim.context,
          severity: 'error',
        });
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
      supportedClaims,
      unsupportedClaims,
    };
  }

  private extractNumericalClaims(
    text: string,
  ): Array<{ text: string; context: string; value?: number }> {
    const claims: Array<{ text: string; context: string; value?: number }> = [];

    // Match patterns like "X objects", "Y km", "Z years", etc.
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(objects?|satellites?)/gi,
      /(\d+(?:\.\d+)?)\s*km/gi,
      /(\d+(?:\.\d+)?)\s*years?/gi,
      /(\d+(?:\.\d+)?)\s*%/gi,
      /lifetime[:\s]+(\d+(?:\.\d+)?)\s*years?/gi,
      /altitude[:\s]+(\d+(?:\.\d+)?)\s*km/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1]);
        const fullText = match[0];
        const startIdx = match.index;
        const context = text.slice(
          Math.max(0, startIdx - 50),
          Math.min(text.length, startIdx + fullText.length + 50),
        );

        claims.push({
          text: fullText,
          context,
          value,
        });
      }
    }

    return claims;
  }

  private isSupported(claim: { text: string; value?: number }, toolResults: ToolResult[]): boolean {
    if (!claim.value) return true; // Can't verify non-numerical claims automatically

    // Check if the value appears in any tool result
    for (const result of toolResults) {
      if (!result.success || !result.data) continue;

      const dataStr = JSON.stringify(result.data);

      // Check if the exact value or a close approximation appears in the data
      const tolerance = claim.value * 0.1; // 10% tolerance
      const minVal = claim.value - tolerance;
      const maxVal = claim.value + tolerance;

      // Extract numbers from tool data
      const numbersInData = dataStr.match(/\d+(?:\.\d+)?/g)?.map(parseFloat) ?? [];

      for (const num of numbersInData) {
        if (num >= minVal && num <= maxVal) {
          return true;
        }
      }
    }

    return false;
  }

  blockUnsafe(text: string): { blocked: boolean; safeText: string; violations: SafetyViolation[] } {
    const violations = this.linter.lint(text);

    if (violations.length === 0) {
      return {
        blocked: false,
        safeText: text,
        violations: [],
      };
    }

    let safeText = text;

    // Replace prohibited terms with safe alternatives
    for (const violation of violations) {
      if (violation.type === 'prohibited_term') {
        safeText = safeText.replace(violation.content, '[BLOCKED: Safety violation]');
      }
    }

    // Ensure geometric screening disclaimer
    if (safeText.includes('miss distance') || safeText.includes('approach')) {
      if (!safeText.includes('geometric screening')) {
        safeText += '\n\n**GEOMETRIC SCREENING ONLY**: Not probability of collision (Pc).';
      }
    }

    return {
      blocked: true,
      safeText,
      violations,
    };
  }
}
