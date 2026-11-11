import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('first-person approach, rejected capture, guided hold, latch and exported provenance', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin !== 'http://127.0.0.1:4188'
    )
      external.push(r.url());
  });
  await page.goto('/#/capture');
  await expect(
    page.getByRole('heading', { name: 'Plan the approach. Test the escape.' }),
  ).toBeVisible();
  const capture = page.getByRole('button', { name: /Close cage \/ capture/ });
  await expect(capture).toBeEnabled({ timeout: 30000 });
  await capture.click();
  await expect(page.getByText('capture rejected', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/capture-first-person.png', fullPage: true });
  await page.getByLabel('Capture simulation speed').selectOption('8');
  await page.getByRole('button', { name: /Guided approach/ }).click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'hold', {
    timeout: 25000,
  });
  await expect(page.getByTestId('rehearsal-status')).toHaveText('Stand-off hold');
  await expect(page.getByLabel('Collector configuration')).toHaveValue('collector-split');
  await page.getByRole('button', { name: 'Show mechanism camera' }).click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-camera-view', 'mechanism');
  await capture.click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'secured', {
    timeout: 10000,
  });
  await page.screenshot({ path: 'test-results/capture-secured.png', fullPage: true });
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export rehearsal' }).click();
  const download = await event;
  const exported = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(exported.classification).toBe('synthetic_concept_rehearsal');
  expect(exported.state.phase).toBe('secured');
  expect(exported.sourceManifest.assets).toHaveLength(7);
  expect(exported.selectedAssets.map((a: { id: string }) => a.id)).toContain('caging-arm');
  expect(exported.trace.length).toBeGreaterThan(10);
  expect(exported.mechanismEvidence.collectorSegments).toEqual(['model_part3', 'model_part4']);
  expect(exported.mechanismEvidence.arms).toHaveLength(2);
  expect(
    exported.mechanismEvidence.arms.every(
      (a: { reachable: boolean; errorM: number }) => a.reachable && a.errorM < 0.08,
    ),
  ).toBe(true);
  expect(exported.state.entryEvidence.gates.every((g: { passed: boolean }) => g.passed)).toBe(true);
  expect(exported.state.events.some((e: { type: string }) => e.type === 'soft_capture')).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('Fetscape value proposition and fault comparison match the selected script', async ({
  page,
}) => {
  await page.goto('/#/capture');
  await expect(
    page.getByRole('heading', { name: 'Plan the approach. Test the escape.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Test degraded thrust/ }).click();
  const comparison = page.getByRole('region', { name: 'Degraded thrust evidence' });
  await expect(comparison).toContainText('59.5');
  await expect(comparison).toContainText('129.8');
  await expect(comparison).toContainText('simulator-provided');
  await comparison.getByRole('button', { name: 'Jump to fault' }).click();
  await expect(comparison.locator('.fault-metrics>div').last()).toContainText('130');
  await comparison.getByRole('button', { name: 'Show endpoint' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export rehearsal', exact: true }).click();
  const downloaded = await event;
  const data = JSON.parse(readFileSync((await downloaded.path())!, 'utf8'));
  expect(data.independentFaultEvidence.seed).toBe(7);
  expect(data.scriptReference).toContain('Fetscape');
  await page.getByRole('button', { name: /Inspect orbital geometry/ }).click();
  await expect(page.getByRole('heading', { name: 'Understand the encounter.' })).toBeVisible();
  await expect(page.getByText('FROZEN PUBLIC ELEMENTS', { exact: true })).toBeVisible();
  await expect(page.locator('.metrics .metric').nth(1)).toContainText('80.8');
});
test('all seven asset inspections, split explosion, configuration changes and mobile view', async ({
  page,
}) => {
  await page.goto('/#/capture');
  await expect(page.locator('.capture-action')).toBeEnabled({ timeout: 30000 });
  for (const name of [
    'Low-poly collector',
    'Detailed collector',
    'Segmented collector',
    'Upper-stage target',
    'Irregular debris',
    'Caging robotic arm',
    'Spacecraft bus target',
  ]) {
    await page.locator('.asset-grid button').filter({ hasText: name }).click();
    await expect(page.locator('.flight-top strong')).toHaveText(name);
    await expect(page.locator('.inspection-loading')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('.asset-provenance')).toContainText('Source SHA-256');
    if (name === 'Segmented collector') {
      await page.getByLabel('Explode model segments').fill('.8');
      await page.screenshot({ path: 'test-results/capture-split-inspection.png', fullPage: true });
    }
  }
  await page.getByRole('button', { name: /Return to first-person/ }).click();
  await page.getByLabel('Collector configuration').selectOption('collector-split');
  await page.getByLabel('Capture visual target').selectOption('spacecraft-bus');
  await expect(page.locator('.capture-action')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('.flight-top strong')).toHaveText('Spacecraft bus target');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/capture-mobile.png', fullPage: true });
});
test('manual input, pause, abort, high-tumble rejection and planning entry', async ({ page }) => {
  await page.goto('/#/capture');
  await expect(page.locator('.capture-action')).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Take controls', exact: true }).click();
  const before = Number(
    (await page.getByLabel('Simulated target range').textContent())!.replace('m', ''),
  );
  await page.keyboard.down('w');
  await expect
    .poll(async () =>
      Number((await page.getByLabel('Simulated target range').textContent())!.replace('m', '')),
    )
    .toBeLessThan(before);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume capture rehearsal' })).toBeVisible();
  await page.getByRole('button', { name: /Abort & retreat/ }).click();
  await page.getByLabel('Capture simulation speed').selectOption('8');
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'aborted', {
    timeout: 20000,
  });
  await page.getByLabel('Capture scenario').selectOption('tumbling');
  await page.getByRole('button', { name: /Guided approach/ }).click();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'hold', {
    timeout: 25000,
  });
  await page.getByRole('button', { name: /Close cage \/ capture/ }).click();
  await expect(page.getByText('capture rejected', { exact: true })).toBeVisible();
  await expect(page.locator('.flight-viewport')).toHaveAttribute('data-phase', 'hold');
  await page.getByRole('button', { name: 'Debris removal lab' }).click();
  await page.getByRole('button', { name: 'Open first-person rehearsal' }).click();
  await expect(page.locator('.capture-context')).toContainText('Planning context:');
});
test('WebGL unavailable has a visible recoverable state and disabled flight actions', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return (get as (...args: unknown[]) => unknown).apply(this, [type, ...args]);
    } as typeof get;
  });
  await page.goto('/#/capture');
  await expect(page.getByRole('alert')).toContainText('3D rendering is unavailable');
  await expect(page.locator('.capture-action')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reinitialize 3D view' })).toBeVisible();
});
test('model loading errors stay visible and a fresh 3D view can recover', async ({ page }) => {
  await page.route('**/models/upper-stage.glb', (route) =>
    route.fulfill({ status: 503, body: 'Injected asset failure' }),
  );
  await page.goto('/#/capture');
  await expect(page.getByRole('alert')).toContainText('upper-stage: HTTP 503', { timeout: 30000 });
  await expect(page.locator('.capture-action')).toBeDisabled();
  await page.unroute('**/models/upper-stage.glb');
  await page.getByRole('button', { name: 'Reinitialize 3D view' }).click();
  await expect(page.locator('.capture-action')).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
