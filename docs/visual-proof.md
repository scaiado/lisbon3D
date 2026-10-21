# Visual proof (Stage 2b)

The top of the Bica, looking down to the Tejo, built in Blender and rendered in the browser in direction C
(storybook realism, see `art/style-frames/STYLE-C.md`). This is a look proof, not gameplay: the microcar is parked.

## Run it

```bash
npm ci
npm run dev            # then open http://localhost:5173/proof.html
```

- `?view=chase|facade|establish`, or keys 1–3 and the buttons: the three review views. `?view=free` adds orbit controls.
- `?renderer=webgl` (default here), `webgpu` or `webgpu-gl2`; `?shadows=0`, `?ao=0`, `?bloom=0`, `?aa=0`; `?dof=1` turns depth of field on.
- `?dpr=1.5` caps the pixel ratio; `?clean` hides the HUD.
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
