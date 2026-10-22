import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const built = ['bica.glb', '../play/player_car.glb', '../play/bica_collision.bin'].every((file) => existsSync(`public/assets/proof/${file}`));

/**
 * Functional check of the playable slice. The simulation is stepped through window.__lisbonPlay without waiting for
 * frames, so the drive is deterministic and independent of the (software) frame rate.
 */
test.describe('playable slice', () => {
  test.skip(!built, 'play assets not built yet (art/exports → npm run assets:proof)');
  test.use({ viewport: { width: 640, height: 360 } });
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/play.html?dpr=0.5');
    await page.waitForFunction(() => window.__lisbonPlay, null, { timeout: 180_000 });
  });

  test('the car drives down the hill and is stopped by walls', async ({ page }) => {
    const result = await page.evaluate(() => {
      const g = window.__lisbonPlay!;
      const v = g.vehicle;
      const start = { y: v.y, z: v.z };
      g.step({ throttle: 1 }, 2);
      const moved = start.z - v.z;
      const speed = v.speed;
      // Straight across the Bica into the east façades.
      v.place(0, -20, -Math.PI / 2);
      g.step({ throttle: 1 }, 3);
      return { moved, speed, wall: g.distance(v.x, v.z), stoppedAt: v.x };
    });
    expect(result.moved).toBeGreaterThan(5);
    expect(result.speed).toBeGreaterThan(5);
    expect(result.wall).toBeGreaterThan(0.5);
    expect(result.stoppedAt).toBeLessThan(3.5);
  });

  test('a careful run delivers every order', async ({ page }) => {
    const summary = await page.evaluate(() => {
      const g = window.__lisbonPlay!;
      const v = g.vehicle;
      const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
      for (let i = 0; i < 120 * 180 && g.run.phase !== 'finished'; i++) {
        const target = g.run.target!;
        let [wx, , wz] = target.stand;
        // Out of the cross street first, then down the middle of the Bica until the stop is close.
        if (g.run.phase === 'deliver' && v.z > -2) [wx, wz] = [0, -6];
        else if (g.run.phase === 'deliver' && Math.abs(wz - v.z) > 6) wx = 0;
        const steer = Math.max(-1, Math.min(1, -wrap(Math.atan2(-(wx - v.x), -(wz - v.z)) - v.yaw) * 2.5));
        const distance = Math.hypot(target.stand[0] - v.x, target.stand[2] - v.z);
        const gap = v.z - (g.funicular.box.z + g.funicular.box.halfZ) - 2.4;
        const follow = gap > 0 && gap < 20 && distance > gap ? Math.max(0, gap - 3) * 0.8 : 99;
        const want = Math.min(distance < 1.5 ? 0 : Math.min(9, 1 + distance * 0.6), follow);
        g.step({ throttle: v.speed < want - 0.3 ? 1 : 0, brake: v.speed > want + 0.5 ? 1 : 0, steer }, 1 / 120);
      }
      return { phase: g.run.phase, ...g.run.summary() };
    });
    expect(summary.phase).toBe('finished');
    expect(summary.delivered).toBe(5);
    expect(summary.condition).toBeGreaterThan(80);
    expect(summary.seconds).toBeLessThan(90);
  });
});
