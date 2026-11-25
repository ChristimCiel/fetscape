/**
 * Fetscape v1 MVP - Judge Mode E2E Test
 * Tests offline demo walkthrough in both languages
 */

import { test, expect } from '@playwright/test';

test.describe('Fetscape Judge Mode', () => {
  test('should load and display Fetscape workspace', async ({ page }) => {
    await page.goto('/');

    // Click on Fetscape AI Workspace nav item
    await page.click('text=Fetscape AI Workspace');

    // Should show the app name
    await expect(page.locator('text=Fetscape')).toBeVisible();

    // Should show judge mode badge
    await expect(page.locator('text=Judge Mode')).toBeVisible();

    // Should show language toggle
    await expect(page.locator('button:has-text("中文")')).toBeVisible();
  });

  test('should complete walkthrough in English', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Fetscape AI Workspace');

    // Should start at step 1
    await expect(page.locator('text=Step 1')).toBeVisible();
    await expect(page.locator('text=Welcome to Fetscape')).toBeVisible();

    // Click through walkthrough
    for (let step = 1; step <= 7; step++) {
      await expect(page.locator(`text=Step ${step}`)).toBeVisible();

      // Click action button (various labels)
      const nextButton = page.locator('button').filter({
        hasText: /Start Analysis|Analyze|Next|Approve Export|Finish/,
      });
      await nextButton.first().click();

      // Wait a bit for state update
      await page.waitForTimeout(500);
    }
  });

  test('should toggle to Traditional Chinese', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Fetscape AI Workspace');

    // Click language toggle
    await page.click('button:has-text("中文")');

    // Should show Chinese text
    await expect(page.locator('text=歡迎使用 Fetscape')).toBeVisible();
    await expect(page.locator('text=評審模式')).toBeVisible();
  });

  test('should show analysis results after walkthrough', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Fetscape AI Workspace');

    // Skip to analysis step (step 2)
    await page.click('button:has-text("Start Analysis")');
    await page.click('button');

    // Wait for analysis
    await page.waitForTimeout(1000);

    // Should show verification status
    await expect(page.locator('text=verified, text=passed, text=success').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display safety disclaimers', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Fetscape AI Workspace');

    // Go through walkthrough to show results
    for (let i = 0; i < 3; i++) {
      await page.locator('button').first().click();
      await page.waitForTimeout(300);
    }

    // Should show safety boundaries
    await expect(
      page.locator('text=/geometric screening|not Pc|decision support/i').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should show approval card', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Fetscape AI Workspace');

    // Navigate to approval step
    for (let i = 0; i < 5; i++) {
      await page.locator('button').first().click();
      await page.waitForTimeout(300);
    }

    // Should show approval card
    await expect(page.locator('text=/approval required|approve|export/i').first()).toBeVisible({
      timeout: 5000,
    });
  });
});
