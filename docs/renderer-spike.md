# Renderer spike

Stage 1 component. A **technical benchmark only**: the look-test scene is primitive geometry and is
not the art direction (see `plan.md` §4). It measures whether the game uses three.js `WebGPURenderer`
or the classic `WebGLRenderer`; that decision is made by re-running it on the visual-proof scene.
The WebGL 2 route stays first-class either way.

## What runs

One look-test scene (`src/world/lookTestScene.ts`): a 240 m street on a 14 % slope with three rows of
buildings each side, roofs, windows, shutters, balconies, tram rails, lamps, bollards, ~360 trees,
planters, a river and a placeholder microcar. It is a performance and look probe, not game content.
A scripted 48 s camera loop (`src/world/cameraPath.ts`) follows the car up and down the street with a
crane shot at each end, driven by wall-clock time so every run sees the same views.

Three routes render the same scene and materials (`src/render/`):

| `?renderer=` | Renderer | Backend | Post-processing |
| --- | --- | --- | --- |
| `webgpu` (default) | `WebGPURenderer` | WebGPU if available, else WebGL 2 | TSL `RenderPipeline`: scene pass with MRT normals → GTAO → DoF → bloom → tone mapping → FXAA |
| `webgpu-gl2` | `WebGPURenderer({ forceWebGL: true })` | WebGL 2 | Same TSL chain on the WebGL 2 backend |
| `webgl` | `WebGLRenderer` | WebGL 2 | `EffectComposer`: RenderPass → GTAOPass → BokehPass → UnrealBloomPass → OutputPass → FXAA |

Shared look values live in `src/render/look.ts` (AgX tone mapping, exposure, AO radius, bloom, DoF).
Each route is a separate dynamic chunk, so players only download one.

Effects can be switched off one at a time to see their cost: `?shadows=0`, `?ao=0`, `?bloom=0`,
`?dof=0`, `?aa=0`. `?dpr=` caps the pixel ratio (default 1.5), `?density=` scales prop counts.

## Automatic WebGL 2 fallback

`WebGPURenderer` only falls back when WebGPU is missing. If WebGPU exists but fails after start-up,
the page would stay broken. `src/main.ts` therefore watches the first 15 s of a WebGPU run (errors,
rejected promises, device loss) and reloads the same configuration on `webgpu-gl2`, recording the
reason in `?fallback=`. The results JSON includes it.

## Findings so far (headless, functional only)

These come from headless Chromium with a software GPU in the build sandbox, so they say nothing about
frame rate.

1. **All three routes render** the scene with every effect and no console errors on the page the player
   ends up on (`npm test`).
2. **WebGPU failed in Chromium 141** (the sandbox's browser): three r186 sets
   `GPUTextureViewDescriptor.swizzle`, which that browser version rejects with
   `Failed to read the 'swizzle' property … not of type 'GPUTextureComponentSwizzle'`.
   `WebGPURenderer` did not fall back on its own; the guard above reloaded on WebGL 2 as designed.
   Current Chrome may behave differently. The M4 runs will show it. This is the main argument for
   keeping the guard in the game, whichever renderer wins.
3. **The two routes do different amounts of work.** The classic route renders the scene several times per
   frame (shadow map, GTAO depth/normals, Bokeh depth, main pass); the TSL route renders it once with
   multiple render targets. Draw-call and triangle counts are therefore not comparable one-to-one
   between routes; compare frame times.
4. r185 renamed `directionToColor`/`colorToDirection` to `packNormalToRGB`/`unpackRGBToNormal`;
   the spike uses the new names.

Built size (gzip, production build): app core ≈ 65 KB, `webgpu` route chunk ≈ 199 KB, `webgl` route
chunk ≈ 99 KB.

## How the decision will be made

From the M4 benchmark results (see `docs/benchmark.md`), in order:
1. The chosen renderer must run in Chrome, Safari and Firefox on the M4 with no fallback errors, and its
   WebGL 2 path must look like its WebGPU path.
2. It must hold the frame-time target with all effects on (see `plan.md` §5), or come closest.
3. If the routes are close, prefer `WebGPURenderer` (where three.js development is going); if the WebGPU
   route is unstable in any target browser, use `WebGLRenderer`.
