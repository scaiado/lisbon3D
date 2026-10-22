import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

const ROUTES = ['webgpu', 'webgpu-gl2', 'webgl'] as const;

/** Console errors fail the run; warnings are allowed (WebGPURenderer warns when it falls back to WebGL 2). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  // Errors from a WebGPU attempt that triggered the automatic WebGL 2 fallback belong to the page that
  // was replaced; only the page the player ends up on must be clean.
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) errors.length = 0;
  });
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

for (const route of ROUTES) {
  test(`look test renders on ${route}`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto(`/?renderer=${route}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });

    const backend = await page.locator('body').getAttribute('data-backend');
    const fellBack = (await page.locator('body').getAttribute('data-fallback')) === 'true';
    expect(['webgpu', 'webgl2']).toContain(backend);
    if (route !== 'webgpu') expect(backend).toBe('webgl2');
    if (fellBack) expect(new URL(page.url()).searchParams.get('renderer')).toBe('webgpu-gl2');
    testInfo.annotations.push({ type: 'backend', description: `${route} → ${backend}${fellBack ? ` (fallback: ${new URL(page.url()).searchParams.get('fallback')})` : ''}` });

    await page.waitForTimeout(1500);
    const shot = await page.locator('canvas').screenshot();
    await testInfo.attach(`${route}.png`, { body: shot, contentType: 'image/png' });
    expect(shot.byteLength).toBeGreaterThan(20_000); // a blank or single-colour canvas compresses far smaller
    expect(errors).toEqual([]);
  });
}

test('benchmark completes and reports results', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?renderer=webgl&bench=2');
  await expect(page.locator('body')).toHaveAttribute('data-bench-state', 'done', { timeout: 60_000 });
  const result = await page.evaluate(() => window.__lisbonBench);
  expect(result).toBeTruthy();
  const summary = (result as { summary: { frames: number; drawCalls: { average: number } } }).summary;
  expect(summary.frames).toBeGreaterThan(0);
  expect(summary.drawCalls.average).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
  expect(errors).toEqual([]);
});
