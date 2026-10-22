import './styles.css';
import { PerspectiveCamera } from 'three';
import { optionsToSearch, readOptions, type SpikeOptions } from './core/options';
import { createRoute } from './render/createRoute';
import type { RenderRoute } from './render/types';
import { buildLookTestScene } from './world/lookTestScene';
import { applyCameraPath } from './world/cameraPath';
import { FrameRecorder } from './bench/frameStats';
import { collectEnvironment } from './bench/environment';
import { PerfOverlay } from './ui/perfOverlay';
import { mountControlPanel } from './ui/controlPanel';
import { mountResultsPanel } from './ui/resultsPanel';

const WARMUP_SECONDS = 3;
/** How long after start-up a WebGPU error still triggers the automatic WebGL 2 fallback. */
const WEBGPU_GUARD_SECONDS = 15;

declare global {
  interface Window {
    /** Benchmark result, exposed for the Playwright functional tests. */
    __lisbonBench?: Record<string, unknown>;
  }
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');
  const options = readOptions();
  document.body.dataset['route'] = options.route;

  const camera = new PerspectiveCamera(52, 1, 0.1, 900);
  const world = buildLookTestScene({ shadows: options.effects.shadows, density: options.density });

  const fallBack = (reason: string): void => fallBackToWebGL2(options, reason);
  let route: RenderRoute;
  try {
    route = await createRoute(options.route, { scene: world.scene, camera, effects: options.effects, onFatal: fallBack });
  } catch (error) {
    if (options.route === 'webgpu') return fallBack(errorText(error));
    showFatal(root, error);
    return;
  }
  if (route.backend === 'webgpu') guardWebGPUStartup(fallBack);
  document.body.dataset['backend'] = route.backend;
  if (options.fallbackReason) document.body.dataset['fallback'] = 'true';
  root.prepend(route.canvas);

  const pixelRatio = Math.min(window.devicePixelRatio, options.dprCap);
  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    route.setSize(window.innerWidth, window.innerHeight, pixelRatio);
  };
  resize();
  window.addEventListener('resize', resize);

  const label = `${route.route} → ${route.backend}${options.fallbackReason ? ' (auto fallback: WebGPU failed)' : ''}`;
  const overlay = new PerfOverlay(root, `${label}\n${route.gpuDescription()}`);
  const benchmarking = options.benchSeconds !== null;
  if (!benchmarking) mountControlPanel(root, options, label);

  const banner = benchmarking ? mountBanner(root) : null;
  const recorder = new FrameRecorder();
  const startTime = performance.now();
  let previous = startTime;
  let frame = 0;

  const tick = (now: number): void => {
    const elapsed = (now - startTime) / 1000;
    const frameMs = now - previous;
    previous = now;

    const focus = applyCameraPath(elapsed, world.car, camera);
    world.followSun(world.car.position);
    route.setFocusDistance(focus);
    route.render();

    const stats = route.frameStats();
    if (frame > 0) overlay.update(frameMs, stats.drawCalls, stats.triangles);
    if (frame === 1) document.body.dataset['ready'] = 'true';
    frame++;

    if (benchmarking && options.benchSeconds !== null && banner) {
      const measured = elapsed - WARMUP_SECONDS;
      if (measured > 0) recorder.add(frameMs, stats.drawCalls, stats.triangles);
      banner.textContent = measured < 0
        ? `Warming up… ${Math.ceil(-measured)} s`
        : `Benchmarking ${route.route} → ${route.backend}: ${Math.ceil(options.benchSeconds - measured)} s left. Please don't touch the window.`;
      if (measured >= options.benchSeconds) {
        banner.remove();
        void finishBenchmark(root, route, pixelRatio, recorder, world.instanceCounts);
        return;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  async function finishBenchmark(
    parent: HTMLElement,
    finished: RenderRoute,
    ratio: number,
    frames: FrameRecorder,
    instanceCounts: Record<string, number>
  ): Promise<void> {
    const result: Record<string, unknown> = {
      app: 'lisbon3d-renderer-spike',
      version: __APP_VERSION__,
      recordedAt: new Date().toISOString(),
      route: finished.route,
      backend: finished.backend,
      gpu: finished.gpuDescription(),
      options,
      warmupSeconds: WARMUP_SECONDS,
      summary: frames.summary(),
      environment: await collectEnvironment(finished.canvas, ratio),
      scene: instanceCounts
    };
    window.__lisbonBench = result;
    document.body.dataset['benchState'] = 'done';
    mountResultsPanel(parent, result, options);
  }
}

/**
 * WebGPURenderer only falls back to WebGL 2 when WebGPU is missing. If WebGPU exists but fails later
 * (driver bug, device lost, an API mismatch in an older browser), the page would stay broken, so any
 * early failure reloads the same configuration on the WebGL 2 backend and records why.
 */
function guardWebGPUStartup(fallBack: (reason: string) => void): void {
  const started = performance.now();
  const active = (): boolean => performance.now() - started < WEBGPU_GUARD_SECONDS * 1000;
  window.addEventListener('error', (event) => {
    if (active()) fallBack(event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (active()) fallBack(errorText(event.reason));
  });
}

let fallingBack = false;
function fallBackToWebGL2(options: SpikeOptions, reason: string): void {
  if (fallingBack || options.route !== 'webgpu') return;
  fallingBack = true;
  console.warn(`[Lisbon3D] WebGPU failed, reloading on WebGL 2: ${reason}`);
  window.location.replace(optionsToSearch({ ...options, route: 'webgpu-gl2', fallbackReason: reason.slice(0, 160) }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mountBanner(parent: HTMLElement): HTMLElement {
  const banner = document.createElement('p');
  banner.className = 'banner';
  parent.append(banner);
  return banner;
}

function showFatal(parent: HTMLElement, error: unknown): void {
  document.body.dataset['error'] = 'true';
  const panel = document.createElement('section');
  panel.className = 'panel';
  const title = document.createElement('h1');
  title.textContent = 'This renderer could not start';
  const detail = document.createElement('p');
  detail.textContent = error instanceof Error ? error.message : String(error);
  const back = document.createElement('a');
  back.href = '?renderer=webgl';
  back.textContent = 'Try the classic WebGL renderer';
  panel.append(title, detail, back);
  parent.append(panel);
  console.error(error);
}

void start();
