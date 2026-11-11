import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('operations → synthetic replay → review → report → removal → history', async ({ page }) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4188')) external.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByText('FROZEN PUBLIC ELEMENTS', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /SGP4 orbital/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/operations-desktop.png', fullPage: true });
  await page.getByLabel('Data source', { exact: true }).selectOption('synthetic-lab');
  await expect(page.getByText(/Parameters changed/)).toBeVisible();
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByText('SYNTHETIC · FICTIONAL OBJECTS', { exact: true })).toBeVisible();
  await page.locator('.event-list button').filter({ hasText: 'SIM-CROSSING' }).first().click();
  const before = await page.getByLabel('Simulation time', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
  await expect
    .poll(() => page.getByLabel('Simulation time', { exact: true }).inputValue())
    .not.toBe(before);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByLabel('Simulation time', { exact: true }).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.getByLabel('Playback speed').selectOption('1800');
  await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play simulation', exact: true })).toBeVisible();
  await page
    .getByLabel('Review note')
    .fill('Request independent covariance before operational assessment.');
  await page.getByRole('button', { name: 'Save review record' }).click();
  await expect(page.getByText('Review saved to the local analysis record.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Request independent covariance before operational assessment.', {
      exact: true,
    }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export report', exact: true }).click();
  const download = await downloadEvent;
  expect(readFileSync((await download.path())!, 'utf8')).toContain(
    'Request independent covariance',
  );
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export full analysis JSON', exact: true }).click();
  const jsonDownload = await jsonEvent;
  const exported = JSON.parse(readFileSync((await jsonDownload.path())!, 'utf8'));
  expect(exported.analysis.dataset.kind).toBe('synthetic');
  expect(exported.decisions).toHaveLength(1);
  await page.getByRole('button', { name: 'Debris removal lab' }).click();
  await expect(page.getByRole('heading', { name: 'Evaluate the next target.' })).toBeVisible();
  await page.getByRole('button', { name: /SIM-POLAR/ }).click();
  await expect(page.getByRole('heading', { name: 'SIM-POLAR', exact: true })).toBeVisible();
  const briefEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Target brief', exact: true }).click();
  const brief = await briefEvent;
  expect(readFileSync((await brief.path())!, 'utf8')).toContain('SIM-POLAR');
  await page.screenshot({ path: 'test-results/removal-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Satellite operations', exact: true }).click();
  await expect(page.locator('.metrics .metric').first().locator('strong')).toHaveText(
    'SIM-CROSSING',
  );
  await page.getByRole('button', { name: 'Analysis history' }).click();
  await expect(page.getByRole('heading', { name: 'Saved analyses' })).toBeVisible();
  await page.locator('.history-list button').first().click();
  await expect(page.getByRole('heading', { name: 'Understand the encounter.' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('invalid import is visible; valid user snapshot can be analyzed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: /SGP4 orbital/ })).toBeVisible();
  await page.getByRole('button', { name: 'Data sources', exact: true }).click();
  await page.getByLabel('Source / provenance').fill('Local test snapshot');
  await page.getByLabel('Element data').fill('[{"EPOCH":"not-a-date"}]');
  await page.getByRole('button', { name: 'Validate and import' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const rows = JSON.parse(readFileSync('data/public-omm.json', 'utf8')).filter(
    (r: { NORAD_CAT_ID: number }) => [25544, 66906].includes(r.NORAD_CAT_ID),
  );
  await page.getByLabel('Snapshot name').fill('Browser imported snapshot');
  await page.getByLabel('Element data').fill(JSON.stringify(rows));
  await page.getByRole('button', { name: 'Validate and import' }).click();
  await expect(page.getByText(/Imported 2 objects/)).toBeVisible();
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByText('USER IMPORT · UNVERIFIED SOURCE', { exact: true })).toBeVisible();
});
test('mobile layout, methodology and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('img', { name: /SGP4 orbital/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/operations-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Debris removal lab' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Scientific basis' }).click();
  await expect(page.getByRole('heading', { name: 'What remains unavailable' })).toBeVisible();
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to workspace' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
