# Progress

## Stage 1 — Clean base + renderer spike (2026-10-20) — awaiting review

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

**Waiting on**
- kAI's benchmark runs on the MacBook Air M4: 3 routes × Chrome, Safari, Firefox.
- Renderer decision from those numbers, then approval to start Stage 2.

## Stage 0 — Audit and plan (2026-10-20) — approved
- Audit and `plan.md`; revision 2 reopened the engine choice and chose browser-first.
