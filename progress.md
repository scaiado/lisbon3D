# Progress

## Stage 3 — Playable slice: Nata Run in the Bica (2026-10-22) — awaiting review
- kAI stopped the car-design loop: the player car is a plain modern EV saloon (Tesla-like, pearl white, no badges),
  0.20 MB, with steerable wheels. Effort went into driving instead.
- `play.html`: fixed-step car physics on the real street (slopes, sprung body, wall and funicular collisions from a
  baked heightfield + distance field), a chase camera that stays inside the street, synthesised sound, and the
  pastry run: bakery pickup, five doors down the Bica, handover bays, pastry condition, tips, stars.
- The funicular runs down the hill as a moving obstacle once the run starts.
- A scripted careful driver finishes all five deliveries in about 36 s; `tests/play.spec.ts` covers it.
  Details and known gaps: `docs/play.md`. Frame rate on the M4 not yet measured in play.
- Fix after kAI's first play (18:32): the tram's windows, lamps, wheels and pole were merged into the static street
  and stayed behind as dark floating panels. Tram parts now have their own materials (rebuilt on the Mac), the
  optimizer keeps them apart, and the chase camera sits a little higher (2.8 m) so the street ahead reads over the car.

## Stage 2b pass 2 — refinement after review (2026-10-21) — awaiting review
- kAI's notes: varied mid-ground roofs with depth, less repetition, cooler blue-violet shade with warm sun, a
  composed wide view, a microcar that reads as a small charming car (plus a side profile), a few people and animals.
- Blender (on kAI's Mac): new lofted microcar with arches, glass and a roof-rack cake tin; mid-ground of separate
  buildings with hip, gable, mansard and terrace roofs and a church; calmer textures with world-space variation;
  cooler AO; people, cats, pigeons, gulls; wide camera recomposed toward the bridge.
- Engine: `carside` view, blue-violet fill, `?report=1` measurement mode, static `perf/dist` bundle (no install).
- Download 19.6 MB. M4 Chrome: 52–60 fps at the default 1.5 pixel ratio, 21–30 fps at full Retina; cost is per
  pixel, not geometry. Safari not yet measured. Details: `docs/visual-proof.md`, `perf/results/README.md`.

## Stage 2b — Visual proof, direction C (2026-10-21) — pass 1 reviewed
- Blender: kAI's Mac has Blender 5.2.0 LTS (macOS 26.6.2, arm64), and headless mode works. It runs over Remote
  Control in a separate clone (`LAB/lisbon3d-proof`). Nothing was installed and `LAB/Lisbon3D` was not touched.
- Kit as reproducible Blender Python (`art/blender/`):
  - 21 procedural textures (numpy, all ours)
  - façade and roof kits with real relief
  - the stepped Bica street with calçada, kerbs, setts and rails
  - 12 authored buildings in two families plus 22 quieter variants
  - the stepped funicular, mid-ground blocks, the river, painted far-shore and bridge cards
  - the invented pastry-delivery microcar
  - an AO bake into vertex colour
- Engine: `proof.html` with sun, coloured fill, painted sky, haze, ACES tone mapping and three review cameras.
  The assets are compressed with glTF-Transform 4.5.1 (new dev dependency, pinned).
- Results: in-browser captures in `art/renders/browser/` and Blender target renders in `art/renders/`.
  Numbers and known gaps are in `docs/visual-proof.md`.
- Stage 2a: three AI concept frames, reviewed (the first set was rejected for a real-car likeness), logged in
  `art/style-frames/LEDGER.md`. kAI chose C.

## Plan revision 3 — visual-first (2026-10-20) — awaiting review
- kAI corrected the visual brief: the Stage 1 look-test is primitive geometry and does not address the
  product problem. The greybox car-and-camera stage is paused.
- `plan.md` now puts a visual direction (2a) and an illustrated-Lisbon asset-pipeline proof (2b) first:
  authored Blender kit, authored building recipes, illustrated textures with baked light, glTF/KTX2,
  three in-browser review images, visual acceptance criteria, effort estimate, revised download budget.
- Checked tools: Blender 5.2.2 is available as the `bpy` module from PyPI (~400 MB, Python 3.13);
  blender.org is blocked from this sandbox. Not installed; waiting for approval.
- PR #1 is kept as a technical benchmark only and is not to be merged to production.

## Stage 1 — Clean base + renderer spike (2026-10-20) — done; benchmark only

**Done**
- Archived the old browser prototype to `archive/web-v0/`, the Godot experiment to `archive/godot-v0/`,
  and March planning docs, logs, social drafts and reference photos to `docs/archive/`, all with
  `git mv` so history follows each file (`git log --follow`). See `archive/README.md`.
- Stopped tracking the committed `node_modules/` (1,739 files) and `dist/`. History is unchanged.
- Removed the hardcoded MapTiler key from the five files that held it (now in `archive/web-v0/`:
  `gta-prototype.html`, `main-simple.js`, `main-minimal.js`, `public/main-simple.js`,
  `src/hybrid-app.js`). The value is still in Git history and must be rotated in the MapTiler account.
- The old prototype still installs and builds from `archive/web-v0` with its own lockfile
  (`npm ci && npx vite build`, Vite 6.4.1).
- New project: TypeScript 7.0.2, Vite 8.3.4, three 0.186.1, @types/three 0.186.0, @types/node 24.19.2,
  Playwright 1.64.1. Versions rechecked on the npm registry before installing; all pinned exactly;
  lockfile committed. See `docs/project-setup.md`.
- Renderer spike: one look-test scene rendered by three routes (WebGPURenderer on WebGPU, WebGPURenderer
  forced to WebGL 2, classic WebGLRenderer), each with shadows, GTAO, depth of field, bloom, AgX tone
  mapping and FXAA. Automatic reload onto WebGL 2 if WebGPU fails after start-up. See
  `docs/renderer-spike.md`.
- Benchmark mode (`?bench=60`) with results panel and JSON export (frame-time percentiles, 1 % low,
  draw calls, triangles, browser, GPU, resolution, transfer size, plus fields you fill in). See
  `docs/benchmark.md`.
- Performance overlay (toggle with `` ` `` or F3) and control panel (toggle with H).
- Checks: `npm run typecheck`, `npm run build`, `npm test` (Playwright). See `docs/testing.md`.

**How it was checked (build sandbox, headless Chromium 141 with a software GPU — functional only)**
- `tsc --noEmit`: clean. `vite build`: clean.
- Playwright: 4/4 pass — each route renders frames with no console errors; the 2 s benchmark produces
  results.
- Found: WebGPU in Chromium 141 fails on the first frame with three r186 (`createView` rejects the
  `swizzle` field). The guard reloaded on WebGL 2 as designed. Needs checking on current browsers.
- No frame-rate claims: nothing here was measured on real hardware.

**Built size (gzip):** app core ≈ 65 KB, WebGPU route ≈ 199 KB, WebGL route ≈ 99 KB (one route loads).

**Status after the visual brief correction**
- The look-test scene is a renderer benchmark only; it is not the art direction.
- The benchmark will be re-run on the visual-proof scene; the renderer choice waits for that run.

## Stage 0 — Audit and plan (2026-10-20) — approved
- Audit and `plan.md`; revision 2 reopened the engine choice and chose browser-first.
