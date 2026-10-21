# Blender proof kit (STYLE-C)

Reproducible Python build scripts for the Bica-to-Tejo proof scene and the hero microcar.
Tested with **Blender 5.2.0 LTS** (macOS arm64). Nothing to install: the scripts use only Blender's bundled Python and numpy.

## Run

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/build_proof.py -- --render v1,v2,v3
```

Options after `--`: `--only w01,e01` (subset of buildings), `--no-bake`, `--no-export`, `--render v1,v2,v3`,
`--preview` (960×540 previews into `out/previews/`), `--samples N`.

Outputs:
- `art/exports/bica.glb`: static scene, Y-up metres, origin on the street centreline at the top junction, street descending
  toward -Z. Nodes are `building_*`, `street`, `funicular`, `props_*` and `backdrop_*`, merged per building, one primitive per material.
  PNG textures are embedded and the baked AO is in `COLOR_0`. Compression happens later, in the cloud optimizer.
- `art/exports/microcar.glb`: origin on the ground between the wheels, facing -Z.
- `art/renders/*_blender_target.png`: Cycles target renders of the three review views, labelled "Blender target render".
- `art/blender/out/` (gitignored): `proof.blend`, generated PNG textures, previews, `build.log`.

## Layout

| File | What it builds |
|---|---|
| `build_proof.py` | entry point: build, AO bake, export, renders |
| `lisbon/geo.py` | MeshBuilder: per-material faces, box-projected UVs, weighted bevel, hardened normals |
| `lisbon/textures.py` | all textures, generated procedurally (see below) |
| `lisbon/materials.py` | glTF-friendly materials: texture × tint × vertex AO, roughness, normal maps |
| `lisbon/kit_facade.py` | walls with real openings, reveals, lioz frames, sash windows, louvred shutters, balconies and ironwork, doors, shopfronts, awnings, azulejo tile geometry, cornices |
| `lisbon/kit_roof.py` | canal-tile roofs as geometry (stepped rows, hips, ridge caps), beirado eaves, chimneys, dormers, aerials |
| `lisbon/street.py` | sloped Bica (18%), stepped calçada pavements, granite kerbs and nosings, sett road, funicular rails in granite, cross street with tram rails, overhead wire |
| `lisbon/recipes.py` | 12 authored buildings (Pombaline and Bica families), plus quieter derived variants down to the river end |
| `lisbon/buildings.py` | recipe → one merged building with lean and bow, corner façades, pots, laundry, birdcages |
| `lisbon/funicular.py` | stepped funicular car on the rails, overhead wire |
| `lisbon/backdrop.py` | mid-ground city: blocks of individual buildings (hip, gable, mansard with dormers, terraces), a church with two bell towers, riverfront row and trees, river, far-shore and bridge cards |
| `lisbon/microcar.py` | hero microcar (see below) |
| `lisbon/life.py` | three people, two cats, pigeons and gulls, placed by hand and dropped onto real surfaces with ray casts |
| `lisbon/glb_pack.py` | post-export: COLOR_0 as normalized 8-bit RGBA instead of float (saves ~13 MB raw), buffer repack |
| `car_preview.py` | studio renders of the microcar (side, front and rear three-quarters, chase) and a backface-culled check |
| `lisbon/bake.py` | Cycles AO bake to vertex colour, tinted toward the blue-violet shade (no sun baked) |
| `lisbon/scene_setup.py` | sun, fill and review cameras for the Blender target renders only |

## Textures: procedural numpy, not baked node setups

The brief asked for procedural node setups baked to images. Instead, the textures are generated directly with numpy
inside Blender. They are still fully procedural and seeded, so they are reproducible as text. This way they tile
exactly (the noise is built in the frequency domain and the cell patterns wrap), they need no Cycles bake time, and the
geometric patterns (calçada waves, azulejos, setts, roof tiles) are exact. All 21 generate in about 8 s. Sizes: 2048 for plaster
and calçada, 1024 for most others, 256–512 for small ones. Every texture is listed in `art/style-frames/LEDGER.md`.

## Measured (2026-10-21, Apple M4, CPU, third pass)

| Step | Time |
|---|---|
| Street, 34 buildings, funicular, mid-ground, people and animals | ~12 s |
| AO bake (41 objects, 48 samples, CPU) | 35–36 s |
| Cycles renders 1920×1080, 96 samples (views 1–4) | 161 s / 180 s / 92 s / 177 s |
| Whole run with four renders | 11 min (72 s without renders) |

| Output | Triangles | Size |
|---|---|---|
| Scene (`bica.glb`): 43 objects, 557 primitives | 1,080,663 | 78.8 MB raw (PNG textures embedded, 8-bit COLOR_0) |
| Microcar (`microcar.glb`) | 10,352 | 0.5 MB |

Largest pieces: authored buildings 21k–79k each, mid-ground city 109k, street 35k, funicular 8k, people 5.7k, animals 2.7k.
Raw size breakdown: positions 18.9 MB, normals 18.9 MB, UVs 12.6 MB, colours 6.3 MB, indices 7.0 MB, textures 14.8 MB.

## Hero car (`microcar.py`, exported as `microcar.glb`)

A small, charming old car clearly inspired by the classic Beetle, in the STYLE-C look. It has no real-world badges,
logos or VW emblem; the bonnet carries only a plain chrome strip.
- **Body:** one continuous rounded arch in side profile. A short convex front lid rises from just above the bumper to a
  small, fairly upright windscreen (about 35° from vertical). The domed roof peaks above the B pillar and falls in one
  unbroken curve over the rear window and the engine lid to the bumper. Strong tumblehome.
- **Fenders:** four separate bulbous fenders standing proud of the body, with round chrome-ringed headlamps in the
  front ones and upright oval tail lamps on the rear ones. Running boards with black rubber tops sit between them.
- **Glass:** a curved-top door window and a small quarter window each side, the windscreen and a small oval rear
  window, all with thin chrome trim. The glass is translucent, showing two front seats, a rear bench, a thin steering
  wheel on the left and a body-colour dashboard.
- **Details:** chrome blade bumpers with overriders, cream steel wheels with domed chrome hubcaps and whitewall tyres,
  round door mirrors, chrome handles, horn grilles, bullet indicators on the front fenders, louvres on the engine lid,
  and blank EU-style plates.
- **Paint:** soft pastel mint (`car_paint`, #A6D1BD) with cream wheels.
- **Branding:** subtle only, a 0.26 m pastry roundel on each door.

| | Blender | glTF |
|---|---|---|
| Origin | ground, midway between the axles | same |
| Facing | +Y | -Z |
| Wheelbase | 2.40 m (axles at y = ±1.20) | z = ∓1.20 |
| Body nose / tail | y = +2.01 / -2.06 (bumpers +2.13 / -2.18) | z = -2.01 / +2.06 |
| Overall length | 4.05 m body, ~4.28 m over the bumpers | |
| Width / height | 1.54 m over the fenders, 1.40 m body / 1.50 m | |
| Wheel radius = axle height | 0.31 m | y = 0.31 |
| Track | 1.31 m front, 1.35 m rear | |
| Ground clearance | ~0.34 m (running boards, the lowest part of the body); classic tall stance | |

Studio previews (front three-quarter, side, rear three-quarter, rear) are in `art/renders/car/beetle_*.png`.
Regenerate them with `car_preview.py`, and the export with `build_proof.py -- --car-only`. In the scene the car is
parked at (0.85, 7.0, road), pitched to the slope.

## Review cameras (Blender coordinates: X west, Y downhill/south, Z up; vertical FOV)

| View | Position | Target | FOV |
|---|---|---|---|
| view1_chase | (0.35, -3.2, 2.25) | (0.0, 40.0, -5.5) | 50° |
| view2_facade | (1.3, 9.2, pave+1.55) | (-3.1, 14.6, pave+3.2) | 50° |
| view3_establishing | (-30.0, -40.0, 48.0) | (115.0, 320.0, -49.0) | 40° |
| view4_carside | (-2.6, 7.0, road+1.0) | (0.85, 7.0, road+0.75) | 55° |

glTF = (x, z, -y). The car is parked at (0.85, 7.0, road_z(7.0)), pitched to the 18% slope, for the target renders.

## Blender target renders

Second pass: sun 34° up, almost straight down the street; the painted `sky` texture as the camera background, with a blue-violet fill
for lighting; warm mist-pass haze.
Third pass (kAI's refinement notes):
- Mid-ground rebuilt as blocks of individual buildings with varied rooflines (hip, gable, mansard with dormers, terraces), cornices,
  setbacks, chimneys and balcony lines. Plus a church with two bell towers, the riverfront row and trees.
- Less repetition: the roof texture now has 16×16 tiles per period with large patches of older and newer tiles, and each roof plane
  gets its own UV offset. The plaster wash is calmer and its normal map is about half as strong. Vertex colours carry soft
  non-repeating world-space stains on walls, colour drift on roofs and rising damp near the pavement.
- Cooler shade: the AO tint goes toward #3D4080 and the fill toward #7C84C8. The sun stays warm.
- Wide view recomposed toward the bridge, with the river, far shore and layered city in frame.
- New microcar; people and animals added; the car side-profile view added.
