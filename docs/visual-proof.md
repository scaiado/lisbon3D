# Visual proof (Stage 2b)

The top of the Bica, looking down to the Tejo, built in Blender and rendered in the browser in direction C
(storybook realism, see `art/style-frames/STYLE-C.md`). This is a look proof, not gameplay: the microcar is parked.

## Run it

```bash
npm ci
npm run dev            # then open http://localhost:5173/proof.html
```

Without installing anything: `cd perf/dist && python3 -m http.server 8080` and open
`http://localhost:8080/proof.html` (see `perf/README.md`; rebuild with `npm run build:perf`).

- `?view=chase|carfront|carside|carrear|facade|establish`, or keys 1–6 and the buttons: the review views. `?view=free` adds orbit controls.
- `?renderer=webgl` (default here), `webgpu` or `webgpu-gl2`; `?shadows=0`, `?ao=0`, `?bloom=0`, `?aa=0`; `?dof=1` turns depth of field on.
- `?dpr=1.5` caps the pixel ratio; `?clean` hides the HUD.
- `?report=1` measures every view (3 s warm-up + 10 s each), shows copyable JSON and logs each view as `GET ./__perf?…`.
- The HUD shows the backend, frame rate (real hardware only), draw calls, rendered triangles (all passes) and asset megabytes.

## Pipeline

| Step | Where | Command |
|---|---|---|
| Kit, buildings, textures, AO bake, export, Cycles targets | kAI's Mac, Blender 5.2.0 LTS | see `art/blender/README.md` |
| Shape check without Blender | anywhere with Python 3.13 + numpy + mathutils | `python art/blender/clay_preview.py . /tmp/clay.glb` |
| Compression (join per material, meshopt, WebP ≤ 2048 px) | Node | `npm run assets:proof` → `public/assets/proof/` |
| Review captures, 1920×1080 | Playwright, headless Chromium | `CAPTURE=1 npx playwright test tests/proof.spec.ts` → `art/renders/browser/` |

Raw exports live in `art/exports/` and never ship; only `public/assets/proof/` is downloaded.
KTX2 needs KTX-Software's `toktx`, which the cloud environment doesn't have, so the proof uses WebP (smaller
download, more GPU memory). KTX2 is a later step on a machine with `toktx`.

## Engine look (src/proof/)

- `look.ts`: every tuned value. Sun 34° up, almost straight down the street. With any real sideways component,
  the east houses shade the whole 6 m street. Blue-violet sky fill, warm ochre bounce, warm haze from 60 m to 2.6 km,
  ACES tone mapping (AgX washed out the storybook colour).
- `sky.ts`: painted equirectangular sky, also used as a weak reflection environment.
- `assets.ts`: loads the glTFs with meshopt. Every mesh casts and receives shadows. Painted cards (`backdrop_*`
  materials) become unlit, alpha-tested, haze-free and tinted cool so they separate from the horizon.
- `views.ts`: the chase view follows the parked car. The façade and wide views share their coordinates with the
  Blender target cameras (`art/blender/lisbon/scene_setup.py`).

## Measured (2026-10-21)

| | Value |
|---|---|
| Scene | 40 objects, 960,783 triangles (12 authored buildings, 22 quieter variants, street, funicular, mid-ground, river, 2 cards) |
| Microcar | 5,976 triangles |
| Raw export | 83.9 MB + 0.4 MB (PNG textures embedded) |
| Download after compression | **17.8 MB** scene + 0.08 MB car, plus about 130 KB gzipped JavaScript |
| Draw calls per frame | 201–225, including the shadow and AO passes (529 primitives before joining) |
| Triangles drawn per frame | about 3.9 M across all passes |
| Blender build on the M4 | 6–7 min including three 1080p Cycles renders; AO bake 29 s |
| Frame rate | **not measured yet**: needs the M4 in Chrome, Safari and Firefox |

The provisional budget (≤ 25 MB to playable) holds for this street. A whole district needs streaming and LODs, so
reassess it at Stage 4 from these numbers.

## Known gaps (first pass)

- Mid-ground blocks are plain boxes with a painted window texture. They read at distance but look flat at the
  right edge of the wide view. They need roof variety and real eaves before the district stage.
- Roof-tile and plaster textures tile visibly at distance (checker effect on the mid-ground roofs; blotchy wash on variant walls).
- The plaster normal map is too strong in close views.
- Shade is warm-dark rather than the blue-violet of the style frame.
- The bridge is cut by the right edge of the wide view.
- No people, cats, gulls or street props beyond pots, laundry and signs yet.

## Pass 2 (2026-10-21), after kAI's review of pass 1

kAI kept the façade detail and asked for: varied mid-ground roofs with real depth and less repetition, the
reference's cooler blue-violet shade with warm sun, a composed wide view, a microcar that reads unmistakably as a
small charming car (with a side-profile view), and a few people and animals. Nothing is approved and the district
is not expanded.

- **Microcar** (`microcar.py`): a lofted two-door body with a sloping bonnet, cut wheel arches with flares, raked
  windscreen, side and rear windows, round headlamps, grille, bumpers and tail lamps. The pastry branding is an
  accessory: a cake tin on a roof rack and a door badge. Wheelbase 1.70 m, wheel radius 0.27 m, 2.65 m long.
- **Mid-ground** (`backdrop.py`): blocks of separate buildings with hip, gable, mansard-with-dormer and terrace
  roofs, cornices, setbacks and chimneys; a two-tower church; a riverfront row with trees. One shared material
  (`mid_wall`) tinted per building through COLOR_0.
- **Repetition:** roof texture repeat about 4×7 m with patches; calmer plaster at half normal strength; world-space
  stains, roof colour drift and rising damp baked into COLOR_0.
- **Shade:** cooler AO tint and fill in Blender; in the engine a blue-violet hemisphere fill (`#6d70d0`) with a muted
  ground bounce and a lower warm environment, sun unchanged.
- **Wide view:** camera moved west and up, aimed at the bridge (Blender (-30, -40, 48) → (115, 320, -49), 40°).
- **Life** (`life.py`): a grandmother with shopping, two walkers, a ginger and a dark cat, pigeons, gulls.
- **New view:** `carside`, from the far pavement (the street is 6 m wide).

| | Pass 1 | Pass 2 |
|---|---|---|
| Scene triangles | 0.96 M | 1.08 M |
| Microcar triangles | 5,976 | 10,352 |
| Download (scene + car) | 17.8 MB + 0.08 MB | **19.45 MB + 0.14 MB** |
| Draw calls per frame (all passes) | 201–225 | 241–285 |

### Frame rate on the M4 (Chrome 155, built-in 60 Hz display, AC power)

Full numbers and conditions are in `perf/results/README.md`.

| Pixel ratio | chase | carside | facade | establish |
|---|---|---|---|---|
| 1.5 (default cap, 2565×1668) | 59.7 fps | 52.1 | 54.4 | 55.3 |
| 2 (full Retina, 3420×2224) | 26.6 fps | 20.6 | 25.2 | 29.7 |

At 1.5 the non-chase views miss vsync about one frame in twenty (1% lows about 29 fps). Draws and triangles are
identical at both ratios while the frame rate halves, so the cost is per pixel (AO, bloom, shadow filtering,
antialiasing at high resolution), not geometry. Optimise resolution scaling and the full-screen passes first.
Safari 26.6.2 is not measured yet (needs someone at the Mac); Firefox is not installed.

### Known gaps (pass 2)

- In the browser the bridge card is fainter than in the Blender target, and the river's ripple texture repeats
  visibly in the wide view.
- The haze turns the far shore into a flat lilac band; the Blender target keeps more depth.
- One headlamp catches a strong specular flare in the car side view.
