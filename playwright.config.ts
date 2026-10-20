import { defineConfig, devices } from '@playwright/test';

/**
 * Functional browser checks only. Headless browsers usually render with a software GPU, so these
 * tests never count as frame-rate evidence; real numbers come from the benchmark on real hardware.
 *
 * PLAYWRIGHT_CHROMIUM_PATH lets a machine use an already-installed Chromium instead of
 * `npx playwright install chromium`.
 */
const chromiumPath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          ...(chromiumPath ? { executablePath: chromiumPath } : {}),
          args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-unsafe-webgpu']
        }
      }
    }
  ]
});
