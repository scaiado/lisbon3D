# Style-frame ledger (Stage 2a)

All frames below are **AI-generated concept art for internal review only**. None of them ships in the game,
and no part of them is traced or reused as building art. In-game assets will be modelled and painted for the
proof scene and reviewed separately.

| Frame | Direction | Source | Canva media id | Status |
|---|---|---|---|---|
| A v1 | Gouache miniature | Canva AI image generation (via the Canva connector), 2026-10-20 | MAHYl3PQydI | Rejected: car read as a copy of a classic real small car |
| B v1 | Ink-line illustration | same | MAHYl5_ezg8 | Rejected: same car problem |
| C v1 | Painterly storybook realism | same | MAHYl6gaf-I | Rejected: same car problem; too close to A |
| A v2 | Gouache miniature | same | MAHYlwJ4RQw | For review |
| B v2 | Ink-line / cel look | same | MAHYl5Pyl28 | For review |
| C v2 | Storybook realism | same | MAHYl-niaEI | For review |

Board: Canva design `DAHYlwV98nQ` ("Lisbon3D style frames"), pages 2–4 hold A v2, B v2, C v2.
Page 1 is the auto-generated cover with Canva stock photos; it is not ours and is not used.

Prompts: each prompt is the BRIEF.md scene plus its direction paragraph. v2 changed the vehicle to an
invented pastry-delivery microcar (one-seat cab, wraparound windscreen, rounded rear cargo box with a pastry icon)
and pushed the three styles further apart.

## Licence notes
- Generated with Canva's AI image tools under the Canva account owner's Canva Terms of Use and AI product terms.
- Treated as reference/mood material only. AI output may not be protectable by copyright, so we do not rely on
  owning it, and we do not ship it.
- Review against BRIEF.md checklist: no text, logos, brands or real artworks found at preview size.
  The funicular, bridge silhouette and azulejo patterns are generic depictions of public places, not copied artwork.

## Review limits
The cloud environment cannot download from canva.com (proxy returns 403), so the frames were reviewed at 600×338
preview size. Full-resolution 1920×1080 PNGs are available from the Canva board.

# Proof-scene assets (Stage 2b, Blender kit)

Everything in `art/exports/bica.glb` and `art/exports/microcar.glb` is made by our own scripts in `art/blender/`.
No downloaded models, textures, fonts, scans or AI-generated images are used. The STYLE-C frame is a mood target only;
nothing was traced or sampled from it. Licence: ours (project code and output).

| Asset | Made by | Source | Notes |
|---|---|---|---|
| Plaster wash + normal (`plaster`, `plaster_n`) | `lisbon/textures.py` `plaster()` | procedural (numpy noise), seed 11–18 | neutral; tinted per building by the material colour factor |
| Lioz stone + normal | `lioz()` | procedural, seeds 21–25 | |
| Granite | `granite()` | procedural, seeds 31–33 | kerbs, nosings, socles |
| Granite setts + normal | `setts()` | procedural, seeds 41–46 | running bond |
| Calçada + normal | `calcada()` | procedural voronoi, seeds 51–55 | our own wide-wave pattern |
| Canal roof tiles | `roof_tile()` | procedural, seeds 61–65 | the tile relief is real geometry (`kit_roof.py`) |
| Azulejos: blue rings, blue lattice, green diamond | `azulejo_blue/lattice/green()` | procedural distance fields, seeds 71–73 | our own patterns, inspired by Lisbon tile traditions, not copied panels |
| Painted wood + normal, painted metal | `wood_paint()`, `paint_metal()` | procedural | tinted per material |
| Window glass | `glass()` | procedural gradient | painted reflection |
| Shop signs | `signs()` | procedural pictograms (cup, tart, fish, key) | no lettering, no brands |
| Fabric atlas | `fabric()` | procedural | awnings, laundry |
| Foliage | `foliage()` | procedural voronoi | pots, plants |
| Mid-ground façade | `far_facade()` | procedural | tinted per block |
| River, sky, far shore, bridge cards | `river()`, `sky()`, `far_shore()`, `bridge()` | procedural | the bridge is a generic suspension-bridge silhouette |
| Pastry-box decal | `pastry_box()` | procedural | invented tart roundel on the microcar |
| All geometry (buildings, street, funicular, props, backdrop, microcar) | `lisbon/*.py` | Blender 5.2.0 LTS Python scripts | 12 authored building recipes plus derived variants; funicular and microcar are original designs |
| Hero car (Beetle-inspired; fifth version is a cabriolet) | `lisbon/microcar.py` | Blender Python | inspired by the classic Beetle's general form at kAI's request; modelled from scratch, with no VW or other real badge, logo or emblem, and blank plates |
| Blank EU-style number plate texture | `textures.py` `plate()` | procedural | blue band with a ring of dots; no characters |
| People, cats, gulls, pigeons | `lisbon/life.py` | Blender Python | stylised storybook figures, no faces drawn, no likeness of real people |
| Mid-ground city, church, riverfront trees | `lisbon/backdrop.py` | Blender Python | generic Lisbon forms, not specific buildings |
| Ambient occlusion (vertex colour `COLOR_0`) | `lisbon/bake.py` | Cycles AO bake | tinted toward the blue-violet shade; no sun light baked |

Review status: generated and reviewed by Claude at texture-sheet and render level; awaiting kAI's visual review.
