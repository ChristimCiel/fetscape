/**
 * Judge-mode E2E: Suite UI home is Fetscape; offline walkthrough, ADR, live opt-in.
 */

import { test, expect } from '@playwright/test';

async function openFetscape(page: import('@playwright/test').Page) {
  await page.goto('/?judge=1');
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

    await page.getByTestId('walkthrough-next').click();
    await expect(page.getByTestId('walkthrough-title')).toContainText('Define Mission Profile');

    await page.getByTestId('walkthrough-next').click();
    await expect(page.getByTestId('verification-status')).toHaveText('Verified', {
      timeout: 30000,
    });
    await expect(page.getByTestId('evidence-pack')).toContainText('GEOMETRIC SCREENING ONLY');
    await expect(page.getByTestId('evidence-pack')).toContainText('Not probability of collision');
    await expect(page.getByTestId('approval-card')).toBeVisible();

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

  test('ADR planner ranks bundled derelicts with cited trade-offs', async ({ page }) => {
    await openFetscape(page);
    await page.getByTestId('tab-debris').first().click();
    await expect(page.getByTestId('debris-planner')).toBeVisible();
    await expect(page.getByTestId('concept-study-banner')).toContainText('Decision support');
    await expect(page.getByTestId('derelict-source')).toContainText('CelesTrak');
    await expect(page.getByTestId('derelict-ranking-table')).toBeVisible();
    await expect(page.getByTestId('derelict-criteria')).toContainText('source:');
    await expect(page.getByTestId('derelict-criteria')).toContainText('trade-off:');
    await expect(page.getByTestId('debris-report')).toContainText('ADR Target Ranking');
    await expect(page.getByTestId('debris-planner')).not.toContainText(/collision risk/i);
    await expect(page.getByTestId('debris-planner')).not.toContainText(/recommend(ed)? burn/i);
  });

  test('proximity screening defaults to replay; live mode is opt-in', async ({ page }) => {
    await openFetscape(page);
    await expect(page.getByTestId('live-mode-panel')).toBeVisible();
    await page.getByTestId('live-mode-panel').locator('summary').click();
    await expect(page.getByTestId('live-mode-toggle')).not.toBeChecked();
    await expect(page.getByTestId('screen-mode-label')).toContainText('REPLAY');
    await page.getByTestId('run-proximity-screen').click();
    await expect(page.getByTestId('proximity-disclaimer')).toContainText(/GEOMETRIC/i);
    await expect(page.getByTestId('proximity-table')).toBeVisible();
    await expect(page.getByTestId('proximity-table')).toContainText('Geometric');
    await expect(page.getByTestId('proximity-disclaimer')).toContainText(/proximity only/i);
    await expect(page.getByTestId('proximity-disclaimer')).not.toContainText(/collision risk/i);

    await page.getByTestId('live-mode-toggle').check();
    await expect(page.getByTestId('live-mode-toggle')).toBeChecked();
    await expect(page.getByTestId('run-proximity-screen')).toContainText(/live/i);
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
