import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('public capture, degraded thrust, orbital replay and static downloads', async ({ page }) => {
  const errors: string[] = [],
    failed: string[] = [],
    requests: { path: string; method: string }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) =>
    requests.push({ path: new URL(request.url()).pathname, method: request.method() }),
  );
  await page.goto('./#/capture');
  await expect(page.getByRole('note')).toContainText('Public interactive demo');
  await expect(page.locator('.capture-action')).toBeEnabled({ timeout: 30000 });
  await page.getByLabel('Capture simulation speed').selectOption('8');
  await page.getByRole('button', { name: /Guided approach/ }).click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'hold', {
    timeout: 25000,
  });
  await page.getByRole('button', { name: 'Show mechanism camera' }).click();
  await page.getByRole('button', { name: /Close cage \/ capture/ }).click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'secured', {
    timeout: 10000,
  });
  await page.getByRole('button', { name: /Test degraded thrust/ }).click();
  await expect(page.getByRole('region', { name: 'Degraded thrust evidence' })).toContainText(
    '129.8',
  );
  const evidenceEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export rehearsal', exact: true }).click();
  const evidence = JSON.parse(readFileSync((await (await evidenceEvent).path())!, 'utf8'));
  expect(evidence.state.phase).toBe('secured');
  expect(evidence.independentFaultEvidence.seed).toBe(7);
  await page.screenshot({ path: 'test-results/pages-capture.png', fullPage: true });
  await page.getByRole('button', { name: /Inspect orbital geometry/ }).click();
  await expect(page.locator('.metrics .metric').nth(1)).toContainText('80.8');
  await expect(page.getByLabel('Primary object')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save review record' })).toBeDisabled();
  const reportEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export report', exact: true }).click();
  expect(readFileSync((await (await reportEvent).path())!, 'utf8')).toContain(
    'PROBABILITY OF COLLISION: UNAVAILABLE',
  );
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export full analysis JSON' }).click();
  expect(
    JSON.parse(readFileSync((await (await jsonEvent).path())!, 'utf8')).analysis.dataset.kind,
  ).toBe('public_elements');
  await page.getByLabel('Data source', { exact: true }).selectOption('synthetic-lab');
  await page.getByRole('button', { name: 'Load bundled replay' }).click();
  await expect(page.getByText('SYNTHETIC · FICTIONAL OBJECTS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Debris removal lab/ }).click();
  await page.getByRole('button', { name: /SIM-POLAR/ }).click();
  const briefEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Target brief', exact: true }).click();
  expect(readFileSync((await (await briefEvent).path())!, 'utf8')).toContain('SIM-POLAR');
  expect(requests.some((request) => request.method !== 'GET')).toBe(false);
  expect(requests.some((request) => /\/api\//.test(request.path))).toBe(false);
  expect(requests.filter((request) => request.path.endsWith('.glb')).length).toBeGreaterThan(0);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test('public root, read-only inputs, refresh, history and mobile layout', async ({ page }) => {
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Plan the approach. Test the escape.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Data sources', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Validate and import' })).toBeDisabled();
  await expect(page.getByLabel('Element data')).toBeDisabled();
  await page.getByRole('button', { name: 'Analysis history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bundled analyses' })).toBeVisible();
  await expect(page.locator('.history-list button')).toHaveCount(2);
  await page.locator('.history-list button').first().click();
  await expect(page.getByRole('img', { name: /SGP4 orbital/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: /SGP4 orbital/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/pages-mobile.png', fullPage: true });
});
