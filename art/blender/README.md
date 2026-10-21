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
| `lisbon/funicular.py`, `backdrop.py`, `microcar.py` | funicular car, mid-ground blocks, river and painted cards, hero microcar |
| `lisbon/bake.py` | Cycles AO bake to vertex colour, tinted toward the blue-violet shade (no sun baked) |
| `lisbon/scene_setup.py` | sun, fill and review cameras for the Blender target renders only |

## Textures: procedural numpy, not baked node setups

The brief asked for procedural node setups baked to images. Instead, the textures are generated directly with numpy
inside Blender. They are still fully procedural and seeded, so they are reproducible as text. This way they tile
exactly (the noise is built in the frequency domain and the cell patterns wrap), they need no Cycles bake time, and the
geometric patterns (calçada waves, azulejos, setts, roof tiles) are exact. All 21 generate in about 8 s. Sizes: 2048 for plaster
and calçada, 1024 for most others, 256–512 for small ones. Every texture is listed in `art/style-frames/LEDGER.md`.

## Measured (2026-10-21, Apple M4, CPU)

| Step | Time |
|---|---|
| Street + 34 buildings + funicular/backdrop geometry | ~9 s |
| AO bake (38 objects, 48 samples, CPU) | 27 s |
| Cycles renders 1920×1080, 96 samples | 108 s / 133 s / 81 s |
| Whole run | 6 min |

| Output | Triangles | Size |
|---|---|---|
| Scene (`bica.glb`): 40 objects | 960,783 | 83.9 MB raw (PNG textures embedded) |
| Microcar (`microcar.glb`) | 5,976 | 0.4 MB |

Authored buildings: w01 78.8k, w02 28.8k, w03 28.2k, w04 46.1k, w05 22.8k, w06 31.9k, e01 67.1k, e02 29.7k,
e03 20.8k, e04 49.2k, e05 25.6k, e06 34.7k triangles. The derived variants are 13.6k–30.1k triangles each. The street is 34.8k.

**Budget notes:** triangles are within the 1.5 M ceiling. The raw export has **529 mesh×material primitives**, over
the 300 target. The optimizer's join-per-material step needs to bring that under the target, or the variants can share
materials more aggressively.

## Known issues in the Blender target renders (first pass)

- Views 1 and 2 are underexposed: the low sun leaves the narrow street almost entirely in shade, and the fill is too weak.
- There is no sky gradient, haze or bloom in Cycles: the world is a flat colour. The far-shore and bridge cards barely show (view 3: top edge only).
- View 3 (rooftops to the river) is the strongest so far: tile geometry, dormers, chimneys and the roofline stepping down all read.
- The mid-ground blocks look flat up close at the right of view 3.
