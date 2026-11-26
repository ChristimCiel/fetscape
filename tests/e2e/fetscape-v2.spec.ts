import { test, expect } from '@playwright/test';

test('3-second clarity: verdict visible at load with no tour', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Will your satellite re-enter in time?' }),
  ).toBeVisible();
  await expect(page.getByTestId('judge-walkthrough')).toHaveCount(0);
  await expect(page.getByTestId('analysis-results')).toContainText('8.5');
  await expect(page.getByTestId('analysis-results')).toContainText(/Watch/);
});

test('keyboard altitude slider updates the verdict', async ({ page }) => {
  await page.goto('/');
  const sat = page.getByRole('slider', { name: /altitude/i });
  await sat.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown'); // 510 → 480 km
  await expect(sat).toHaveAttribute('aria-valuenow', '480');
  await expect(page.getByTestId('analysis-results')).toContainText(/Pass/);
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp'); // 630
  await expect(page.getByTestId('analysis-results')).toContainText(/Miss/);
});

test('proximity values are never colour-coded', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('live-mode-panel').locator('summary').click();
  await page.getByTestId('run-proximity-screen').click();
  const colors = await page
    .getByTestId('proximity-table')
    .locator('td')
    .evaluateAll((tds) => [...new Set(tds.map((td) => getComputedStyle(td).color))]);
  expect(colors.length).toBe(1); // one neutral color for every cell
});

test('debris mode: dot and card selection are linked; criteria cite sources', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-debris').click();
  await page.getByTestId('derelict-ranking-table').locator('button').nth(3).click();
  await expect(page.getByTestId('derelict-detail')).toContainText('KSLV-II');
  await expect(page.getByTestId('derelict-criteria')).toContainText('trade-off:');
});

test('mobile 390: no horizontal scroll; verdict before plot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const v = await page.getByTestId('analysis-results').boundingBox();
  const p = await page.getByRole('img', { name: /Altitude versus inclination/ }).boundingBox();
  expect(v!.y).toBeLessThan(p!.y);
});

test('replay mode makes no external network requests on /', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/celestrak|space-track|googleapis|api\./i.test(url)) external.push(url);
  });
  await page.goto('/');
  await page.getByTestId('live-mode-panel').locator('summary').click();
  await page.getByTestId('run-proximity-screen').click();
  await expect(page.getByTestId('proximity-table')).toBeVisible();
  expect(external).toEqual([]);
});
