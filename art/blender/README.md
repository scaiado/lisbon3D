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

An ordinary five-door European city hatchback, slightly compact for the game. It is generic: no make or model, no
brand-like grille, logo or signature lamps.
- **Shape:** two-box, with a short bonnet, a raked windscreen and a roof that dips toward the rear. Sloped hatch glass
  under a small spoiler lip with the third brake light.
- **Glasshouse:** front and rear door glass, a small rear quarter glass and the hatch glass, with A, B and C pillars.
  The B pillar is black, and every window has a dark belt seal. The glass is tinted and translucent, so the seats,
  dashboard and steering wheel (left-hand drive) show through.
- **Body:** body-coloured bumpers with black intakes, black arch lips and sills, a shoulder line, door shut lines and
  pull handles, mirrors, a fuel flap, and hatch shut lines.
- **Lights and plates:** swept-back headlamps projected onto the body corners, vertical tail lamps with amber
  indicators, and blank EU-style plates (blue band, no characters).
- **Wheels:** plain 5-spoke alloys.
- **Paint and branding:** soft teal; the only branding is a 0.28 m pastry roundel on each front door.

| | Blender | glTF |
|---|---|---|
| Origin | ground, midway between the axles | same |
| Facing | +Y | -Z |
| Length / width / height | 3.55 m / 1.62 m (1.82 m with mirrors) / 1.50 m | |
| Wheelbase | 2.36 m (axles at y = ±1.18) | z = ∓1.18 |
| Overhangs | front 0.68 m, rear 0.51 m | |
| Wheel radius = axle height | 0.29 m | y = 0.29 |
| Track | 1.40 m (wheel centres x = ±0.70) | |
| Ground clearance | 0.14 m | |
| Triangles | 11,116 | |

The glass material `car_glass` has alpha 0.62 (glTF `alphaMode` BLEND). Studio previews (front three-quarter, side,
rear three-quarter, rear): `art/renders/car/`. Regenerate them with `car_preview.py`, and the export with
`build_proof.py -- --car-only`. In the scene the car is parked at (0.85, 7.0, road), pitched to the slope.

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
