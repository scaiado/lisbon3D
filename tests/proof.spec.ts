import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const VIEWS = ['chase', 'carside', 'facade', 'establish'] as const;
const built = existsSync('public/assets/proof/bica.glb') && existsSync('public/assets/proof/microcar.glb');

/**
 * Functional check of the visual proof, plus the review captures: with CAPTURE=1 each view is saved at
 * 1920×1080 to art/renders/browser/. Headless Chromium renders with a software GPU, so these images show
 * the look, never the frame rate.
 */
test.describe('visual proof', () => {
  test.skip(!built, 'proof assets not built yet (art/exports → npm run assets:proof)');
  test.use({ viewport: { width: 1920, height: 1080 } });
  // Software rendering of the full scene at 1080p is slow; this is a look check, not a speed check.
  test.setTimeout(300_000);

  for (const view of VIEWS) {
    test(`renders the ${view} view`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(`/proof.html?view=${view}&clean&dpr=1`);
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
      await page.waitForTimeout(1500);
      const shot = await page.locator('canvas').screenshot();
      expect(shot.byteLength).toBeGreaterThan(50_000);
      expect(errors).toEqual([]);
      if (process.env['CAPTURE']) {
        mkdirSync('art/renders/browser', { recursive: true });
        writeFileSync(`art/renders/browser/${view}.png`, shot);
        const facts = await page.evaluate(() => window.__lisbonProof);
        writeFileSync(`art/renders/browser/${view}.json`, `${JSON.stringify(facts, null, 2)}\n`);
      }
    });
  }

  test('report mode measures every view and shows copyable results', async ({ page }) => {
    await page.goto('/proof.html?report=1&warmup=0.2&seconds=0.5&dpr=0.5');
    await expect(page.locator('body')).toHaveAttribute('data-report', 'done', { timeout: 240_000 });
    const report = await page.evaluate(() => window.__lisbonProof?.['report'] as { views: { view: string; summary: { frames: number } }[] });
    expect(report.views.map((entry) => entry.view)).toEqual([...VIEWS]);
    for (const entry of report.views) expect(entry.summary.frames).toBeGreaterThan(0);
  });
});
