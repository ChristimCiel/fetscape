/**
 * Fetscape v1 MVP - CI Safety Term Linter
 * Scans source files for prohibited terminology
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { SafetyLinter } from '../apps/web/src/fetscape/safety/linter';

const linter = new SafetyLinter();
const errors: string[] = [];
const warnings: string[] = [];

function scanFile(filePath: string): void {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.md')) {
    return;
  }

  // Skip test files, the term dictionary, and this scanner itself
  if (
    filePath.includes('.test.') ||
    filePath.includes('lint-safety-terms') ||
    filePath.endsWith('/safety/linter.ts') ||
    filePath.includes('/docs/')
  ) {
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const violations = linter.lint(content);

    if (violations.length > 0) {
      for (const violation of violations) {
        const message = `${filePath}: ${violation.type} - "${violation.content}"`;

        if (violation.severity === 'error') {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

function scanDirectory(dirPath: string): void {
  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
}

console.log('Fetscape v1 Safety Term Linter');
console.log('===============================\n');
console.log('Scanning for prohibited terminology...\n');

// Scan source directories
scanDirectory(join(process.cwd(), 'apps/web/src/fetscape'));
scanDirectory(join(process.cwd(), 'docs'));

console.log(`Scan complete.`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Warnings: ${warnings.length}\n`);

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  for (const warning of warnings) {
    console.log(`  ${warning}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ ERRORS:');
  for (const error of errors) {
    console.log(`  ${error}`);
  }
  console.log('');
  console.log('Safety linter failed. Remove prohibited terms before committing.');
  process.exit(1);
}

console.log('✓ No safety violations detected.');
process.exit(0);
