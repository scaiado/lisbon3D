import '../styles.css';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readOptions } from '../core/options';
import { createRoute } from '../render/createRoute';
import { addProofLighting } from './lighting';
import { PROOF_LOOK } from './look';
import { loadProofAssets } from './assets';
import { showReport, startReport } from './report';
import { PROOF_VIEWS, applyPose, placeMicrocar, viewPose, type ProofView } from './views';

/**
 * Stage 2b visual proof: the Blender-built top of the Bica, lit in-engine, seen from the three review views.
 *
 *   ?view=chase|carfront|carside|carrear|facade|establish   review camera (default chase); ?view=free adds orbit controls
 *   ?report=1   frame-rate run over every view (3 s warm-up + 10 s each; ?warmup= and ?seconds= override)
 *   ?renderer=webgl|webgpu|webgpu-gl2 and the effect switches work as in the renderer spike; ?dof=1 turns depth of field on.
 *   The proof defaults to the classic WebGL 2 route, the first-class path until the renderer is decided.
 */

declare global {
  interface Window {
    /** Proof facts for the Playwright capture script. */
    __lisbonProof?: Record<string, unknown>;
  }
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');
  const params = new URLSearchParams(window.location.search);
  const options = readOptions();
  if (!params.has('renderer')) options.route = 'webgl';
  // Direction C wants crisp storybook detail, so depth of field is opt-in here (?dof=1).
  options.effects.dof = params.get('dof') === '1';
  const requested = params.get('view');
  const free = requested === 'free';
  let view: ProofView = PROOF_VIEWS.includes(requested as ProofView) ? (requested as ProofView) : 'chase';

  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.1, 4000);
  const lighting = addProofLighting(scene, options.effects.shadows);

  let assets;
  try {
    assets = await loadProofAssets(import.meta.env.BASE_URL);
  } catch (error) {
    showMessage(root, 'Proof assets are not built yet', `Run the Blender build and \`npm run assets:proof\`. (${String(error)})`);
    return;
  }
  scene.add(assets.street, assets.microcar);
  placeMicrocar(assets.microcar, assets.street);

  const route = await createRoute(options.route, { scene, camera, effects: options.effects, toneMapping: PROOF_LOOK.toneMapping });
  document.body.dataset['backend'] = route.backend;
  root.prepend(route.canvas);

  const pixelRatio = Math.min(window.devicePixelRatio, options.dprCap);
  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    route.setSize(window.innerWidth, window.innerHeight, pixelRatio);
  };

  const controls = free ? new OrbitControls(camera, route.canvas) : null;
  const show = (next: ProofView): void => {
    view = next;
    const pose = viewPose(view, assets.microcar);
    applyPose(camera, pose);
    controls?.target.copy(pose.target);
    route.setFocusDistance(pose.focus);
    const center = pose.position.clone().lerp(pose.target, 0.35);
    lighting.fitShadow(center, view === 'establish' ? 140 : view.startsWith('car') ? 25 : 60);
    document.body.dataset['view'] = view;
  };
  show(view);
  resize();
  window.addEventListener('resize', resize);

  const hud = mountHud(root, (next) => show(next));
  window.addEventListener('keydown', (event) => {
    const index = Number(event.key) - 1;
    const next = PROOF_VIEWS[index];
    if (next) show(next);
    if (event.key === 'p') console.info('[Lisbon3D] camera', camera.position.toArray(), 'looking', camera.getWorldDirection(new Vector3()).toArray());
  });

  const report = params.get('report') === '1' ? startReport(route, pixelRatio, show, (result) => showReport(root, result), params) : null;
  let frame = 0;
  let windowStart = performance.now();
  let last = windowStart;
  let fps = 0;
  let measuring = report !== null;
  const tick = (now: number): void => {
    controls?.update();
    route.render();
    if (measuring) measuring = report?.frame(now - last) ?? false;
    last = now;
    const stats = route.frameStats();
    if (frame === 2) {
      window.__lisbonProof = { view, backend: route.backend, ...stats, bytes: assets.bytes };
      document.body.dataset['ready'] = 'true';
    }
    // Frame rate over the last 60 frames: only meaningful on real hardware, never in headless tests.
    if (frame % 60 === 0) {
      if (frame > 0) fps = 60_000 / (now - windowStart);
      windowStart = now;
      hud.textContent = `${measuring ? `measuring ${view} · ` : ''}${route.backend} · ${fps ? `${fps.toFixed(0)} fps · ` : ''}${stats.drawCalls} draws · ${(stats.triangles / 1e6).toFixed(2)} M tris · ${megabytes(assets.bytes)} MB assets`;
    }
    frame++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function megabytes(bytes: Record<string, number>): string {
  return (Object.values(bytes).reduce((sum, value) => sum + value, 0) / 1e6).toFixed(1);
}

function mountHud(parent: HTMLElement, choose: (view: ProofView) => void): HTMLElement {
  const panel = document.createElement('nav');
  panel.className = 'proof-hud';
  const labels: Record<ProofView, string> = {
    chase: '1 Street',
    carfront: '2 Car front',
    carside: '3 Car side',
    carrear: '4 Car rear',
    facade: '5 Façade',
    establish: '6 Wide'
  };
  for (const view of PROOF_VIEWS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = labels[view];
    button.addEventListener('click', () => choose(view));
    panel.append(button);
  }
  const stats = document.createElement('span');
  panel.append(stats);
  if (new URLSearchParams(window.location.search).has('clean')) panel.hidden = true;
  parent.append(panel);
  return stats;
}

function showMessage(parent: HTMLElement, title: string, detail: string): void {
  document.body.dataset['error'] = 'true';
  const panel = document.createElement('section');
  panel.className = 'panel';
  const heading = document.createElement('h1');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = detail;
  panel.append(heading, text);
  parent.append(panel);
}

void start();
