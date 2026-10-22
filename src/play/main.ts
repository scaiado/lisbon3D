import '../styles.css';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { readOptions } from '../core/options';
import { createRoute } from '../render/createRoute';
import { addProofLighting } from '../proof/lighting';
import { PROOF_LOOK } from '../proof/look';
import { loadModel } from '../proof/assets';
import { Sound } from './audio';
import { CAMERA_MODES, ChaseCamera } from './camera';
import { CarModel } from './car';
import { type CollisionMap, distanceAt, loadCollision } from './collision';
import { NataRun } from './delivery';
import { Funicular } from './funicular';
import { type GameplayLayout, loadGameplay } from './gameplay';
import { Hud } from './hud';
import { Controls } from './input';
import { type DriveInput, Vehicle } from './vehicle';

/**
 * Stage 3 playable slice: drive the Bica and run the pastry delivery.
 *
 *   ?clean hides the HUD; ?dpr= caps the pixel ratio (adaptive below it); effect switches as in the proof.
 *   window.__lisbonPlay exposes the simulation for tests (step it without rendering).
 */

declare global {
  interface Window {
    __lisbonPlay?: {
      vehicle: Vehicle;
      run: NataRun;
      layout: GameplayLayout;
      map: CollisionMap;
      funicular: Funicular;
      /** Advances the simulation by `seconds` with a fixed input, without rendering. */
      step(input: Partial<DriveInput>, seconds: number): void;
      distance(x: number, z: number): number;
      /** Puts the camera straight behind the car and hides the start card (for captures). */
      frame(): void;
    };
  }
}

const PHYSICS_DT = 1 / 120;
const NO_INPUT: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');
  const params = new URLSearchParams(window.location.search);
  const options = readOptions();
  if (!params.has('renderer')) options.route = 'webgl';
  options.effects.dof = false;
  const base = import.meta.env.BASE_URL;

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 4000);
  const lighting = addProofLighting(scene, options.effects.shadows);

  const [street, carGltf, map] = await Promise.all([
    loadModel(`${base}assets/proof/bica.glb`),
    loadModel(`${base}assets/play/player_car.glb`),
    loadCollision(`${base}assets/play/bica_collision.bin`)
  ]);
  const layout = await loadGameplay(`${base}assets/play/bica_gameplay.json`, map);
  scene.add(street.scene, carGltf.scene);

  const model = new CarModel(carGltf.scene);
  const vehicle = new Vehicle(model.spec, map);
  const spawn = (): void => vehicle.place(layout.spawn.position[0], layout.spawn.position[2], layout.spawn.yaw);
  spawn();
  const funicular = new Funicular(street.scene, layout.funicular);
  const run = new NataRun(layout, map);
  scene.add(run.group);

  const route = await createRoute(options.route, { scene, camera, effects: options.effects, toneMapping: PROOF_LOOK.toneMapping });
  document.body.dataset['backend'] = route.backend;
  root.prepend(route.canvas);

  const chase = new ChaseCamera(camera, map);
  const hud = new Hud(root, params.has('clean'));
  const controls = new Controls();
  const sound = new Sound();

  // Last safe spot (on the street, clear of walls, upright), for R.
  let safe = { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw };
  let safeTimer = 0;
  let bumpLevel = 0;

  const simulate = (dt: number, input: DriveInput): void => {
    funicular.update(dt, vehicle.x, vehicle.z, model.spec.width / 2, model.spec.length / 2);
    vehicle.impacts.length = 0;
    vehicle.step(dt, input, [funicular.box]);
    run.update(dt, vehicle, vehicle.impacts);
    // The funicular sets off down the hill as soon as the run starts.
    if (run.phase !== 'ready') funicular.depart();
    safeTimer += dt;
    if (safeTimer > 1 && !vehicle.airborne && distanceAt(map, vehicle.x, vehicle.z) > 1.1 && Math.abs(vehicle.roll) < 0.15) {
      safe = { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw };
      safeTimer = 0;
    }
  };

  const handleEvents = (): void => {
    for (const impact of vehicle.impacts) {
      chase.bump(Math.min(0.3, impact.speed * 0.04));
      sound.thump(impact.speed);
    }
    bumpLevel = Math.max(bumpLevel * 0.9, Math.abs(vehicle.vy) * 0.05);
    for (const event of run.events.splice(0)) {
      hud.event(event);
      if (event.kind === 'pickup' || event.kind === 'delivered') sound.chime();
      if (event.kind === 'finished') hud.showResults(run);
    }
    if (funicular.bell) {
      funicular.bell = false;
      sound.bell();
    }
  };

  window.__lisbonPlay = {
    vehicle,
    run,
    layout,
    map,
    funicular,
    step(input, seconds) {
      const full = { ...NO_INPUT, ...input };
      for (let t = 0; t < seconds; t += PHYSICS_DT) {
        simulate(PHYSICS_DT, full);
        handleEvents();
      }
    },
    distance: (x, z) => distanceAt(map, x, z),
    frame() {
      chase.snap();
      hud.hideStart();
    }
  };

  // Resolution adapts to hold the frame rate: the proof measured cost per pixel, not per triangle.
  const maxRatio = Math.min(window.devicePixelRatio, options.dprCap);
  let pixelRatio = maxRatio;
  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    route.setSize(window.innerWidth, window.innerHeight, pixelRatio);
  };
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now();
  let frames = 0;
  let windowStart = last;
  let accumulator = 0;
  const tick = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    for (const action of controls.take()) {
      if (action === 'camera') chase.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(chase.mode) + 1) % CAMERA_MODES.length]!;
      if (action === 'mute') sound.toggleMute();
      if (action === 'reset') {
        vehicle.place(safe.x, safe.z, safe.yaw);
        chase.snap();
      }
      if (action === 'restart') {
        run.reset();
        funicular.reset();
        hud.hideResults();
        spawn();
        chase.snap();
      }
    }
    const input = controls.read();
    if (controls.touched) {
      sound.start();
      hud.hideStart();
    }

    accumulator += dt;
    while (accumulator >= PHYSICS_DT) {
      simulate(PHYSICS_DT, input);
      handleEvents();
      accumulator -= PHYSICS_DT;
    }

    model.update(vehicle);
    chase.update(vehicle, dt);
    const shadowCentre = new Vector3(Math.round(vehicle.x), Math.round(vehicle.y), Math.round(vehicle.z - 8));
    lighting.fitShadow(shadowCentre, 30);
    sound.drive(vehicle.speed, input.throttle, bumpLevel);

    const target = run.target;
    let distance: number | null = null;
    let bearing = 0;
    if (target) {
      const tx = target.stand[0] - vehicle.x;
      const tz = target.stand[2] - vehicle.z;
      distance = Math.hypot(tx, tz);
      const view = camera.getWorldDirection(new Vector3());
      const flat = Math.hypot(view.x, view.z) || 1;
      const fx = view.x / flat;
      const fz = view.z / flat;
      bearing = Math.atan2(tx * -fz + tz * fx, tx * fx + tz * fz);
    }
    hud.update(run, vehicle.speed, distance, bearing);

    route.render();
    frames++;
    if (now - windowStart > 1000) {
      const fps = (frames * 1000) / (now - windowStart);
      const next = fps < 52 ? Math.max(0.75, pixelRatio - 0.1) : fps > 59 ? Math.min(maxRatio, pixelRatio + 0.05) : pixelRatio;
      if (Math.abs(next - pixelRatio) > 0.001) {
        pixelRatio = next;
        resize();
      }
      hud.setStats(`${fps.toFixed(0)} fps · ${pixelRatio.toFixed(2)}× · ${route.frameStats().drawCalls} draws`);
      frames = 0;
      windowStart = now;
    }
    if (!document.body.dataset['ready']) document.body.dataset['ready'] = 'true';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

void start();
