/**
 * Judge-mode E2E: offline walkthrough in EN and zh-TW.
 * Local API serves the built app at / (not GitHub Pages /fetscape/ base).
 */

import { test, expect } from '@playwright/test';

async function openFetscape(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fetscape AI Workspace' }).click();
  await expect(page.getByTestId('fetscape-app')).toBeVisible();
  await expect(page.getByTestId('fetscape-brand')).toHaveText('Fetscape');
  await expect(page.getByTestId('judge-mode-badge')).toBeVisible();
}

test.describe('Fetscape Judge Mode', () => {
  test('loads workspace with judge badge and language toggle', async ({ page }) => {
    await openFetscape(page);
    await expect(page.getByTestId('language-toggle')).toHaveText('中文');
    await expect(page.getByTestId('judge-walkthrough')).toBeVisible();
    await expect(page.getByTestId('walkthrough-title')).toContainText('Welcome to Fetscape');
  });

  test('completes walkthrough in English and shows verified pack + approval', async ({ page }) => {
    await openFetscape(page);

    // Step 0 → 1
    await page.getByTestId('walkthrough-next').click();
    await expect(page.getByTestId('walkthrough-title')).toContainText('Define Mission Profile');

    // Step 1 → 2 triggers offline analysis (deterministic replay — no network)
    await page.getByTestId('walkthrough-next').click();
    await expect(page.getByTestId('verification-status')).toHaveText('Verified', {
      timeout: 30000,
    });
    await expect(page.getByTestId('evidence-pack')).toContainText('GEOMETRIC SCREENING ONLY');
    await expect(page.getByTestId('evidence-pack')).toContainText('Not probability of collision');
    await expect(page.getByTestId('approval-card')).toBeVisible();

    // Continue through remaining steps
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('walkthrough-next').click();
    }
    await expect(page.getByTestId('walkthrough-title')).toContainText('Demo Complete');
  });

  test('toggles Traditional Chinese UI', async ({ page }) => {
    await openFetscape(page);
    await page.getByTestId('language-toggle').click();
    await expect(page.getByTestId('judge-mode-badge')).toHaveText('評審模式');
    await expect(page.getByTestId('walkthrough-title')).toContainText('歡迎使用 Fetscape');
    await expect(page.getByTestId('language-toggle')).toHaveText('English');
  });

  test('shows safety disclaimers without Pc / maneuver / commanding claims', async ({ page }) => {
    await openFetscape(page);
    const safety = page.getByTestId('safety-disclaimers');
    await expect(safety).toContainText('Geometric screening only');
    await expect(safety).toContainText('Decision support');
    await expect(safety).not.toContainText(/collision risk/i);
    await expect(safety).not.toContainText(/recommend(ed)? burn/i);
  });

  test('debris planner tab is labeled as concept study', async ({ page }) => {
    await openFetscape(page);
    await page.getByTestId('tab-debris').click();
    await expect(page.getByTestId('debris-planner')).toBeVisible();
    await expect(page.getByTestId('concept-study-banner')).toContainText('Concept study tool');
    await page.getByTestId('rank-debris').click();
    await expect(page.getByTestId('debris-report')).toContainText('Debris Target Ranking');
    await expect(page.getByTestId('debris-report')).toContainText('concept study');
  });

  test('approval card requires explicit approve before export', async ({ page }) => {
    await openFetscape(page);
    await page.getByTestId('walkthrough-next').click();
    await page.getByTestId('walkthrough-next').click();
    await expect(page.getByTestId('approval-card')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('approve-export')).toBeVisible();
    await expect(page.getByTestId('reject-export')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByTestId('approve-export').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/fetscape-analysis-/);
  });
});
