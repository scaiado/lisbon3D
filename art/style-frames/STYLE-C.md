# Chosen direction: C, storybook realism (kAI, 2026-10-21)

Reference image: `previews/C-storybook-realism-preview.png` (600×338; full 1920×1080 on the Canva board, see LEDGER.md).
It is a **mood target only**. Don't trace it or use it as a texture. Everything we build is modelled and painted by us.

## In one line
A stylised film-like Lisbon: sculpted, slightly chunky, slightly exaggerated forms with hand-painted materials,
in rich golden-hour light with deep blue-violet shade and layered haze down to the river.

## Form and level of detail
- **Proportions:** real Lisbon scale. Push a little: windows and balconies about 10% larger, cornices and sills chunkier,
  and walls with a slight lean or bow (≤1°) so nothing is ruler-straight. Use bevels everywhere (2–4 cm); no razor edges.
- **Façades** carry the frame:
  - Deep window reveals (20–30 cm) with lioz-limestone frames, sills and lintels; green or ochre shutters; glazing bars.
  - Iron balconies with real bars and a simple scroll motif; cornices and string courses; stone base courses and corner pilasters.
  - Azulejo panels as tile geometry over a painted pattern.
  - Plaster in pastel washes: ochre, rose, cream, lime-wash white, faded blue.
  - Small damage, stains and repairs.
- **Roofs:** terracotta canal tiles with real corrugated rows, eaves with a tile edge, chimneys, aerials, one or two dormers.
  The roofline steps down the hill.
- **Ground:**
  - Calçada portuguesa with our own wave pattern, granite kerbs, and a stone-sett road with funicular rails set in stone.
  - Some steps on the steep pavements.
- **Hero objects:**
  - Our invented pastry-delivery microcar: one-seat rounded cab, wraparound windscreen, glossy teal, cream rounded
    cargo box with a simple pastry icon, small oval lamps, chunky wheels.
  - A stylised yellow funicular car with a stepped body for the slope. It is ours, not a replica.
- **Detail density:** high in the first 30 m, simplified mid-ground, painted cards for far shore, bridge and sky.
- **Avoid:** bare cuboids, cone roofs, flat single-colour surfaces, floating objects, generic low-poly, real brands or text.

## Palette (targets, tune by eye against the reference)
| Use | Hex |
|---|---|
| Sun / highlight | `#FFD7A0` |
| Ochre plaster | `#D9A14E` |
| Rose plaster | `#D98E7A` |
| Cream / lime-wash | `#EFE2C6` |
| Terracotta roof | `#B8552E` |
| Azulejo blue | `#2F5D8C` (with `#7FA7C9` light and `#E9E4D6` glaze white) |
| Azulejo green | `#3E7A5E` |
| Shutter green | `#2E5B45` |
| Lioz stone | `#E6D7BC` |
| Funicular yellow | `#F2B632` |
| Microcar teal | `#2A9C9A` (cargo box `#F1E6CC`) |
| Shade (multiply tone) | `#3A3F6B` (blue-violet) |
| River | `#9CC3CF` with sun glints `#FFE9C2` |
| Haze | `#F3D2A6` |

## Light and shading
- One low warm sun from the west/south-west (late afternoon, 15–20° elevation), raking across the façades.
  Its colour is about `#FFD7A0` and it casts strong, soft-edged shadows.
- Shade is coloured, not grey: a blue-violet sky fill plus warm bounce from the ochre walls.
- Baked ambient occlusion in every corner and reveal, so nothing floats. Bake to vertex colour or a lightmap in Blender.
- Painted albedo: low-frequency brush wash and edge wear baked into colour maps. Roughness is mostly high;
  glass and the car paint are glossy.
- Haze: warm atmospheric perspective that increases toward the river. Gentle bloom on the sun and highlights.
- No outlines; this is not direction B.

## Review views (in-browser, 1920×1080)
1. Chase camera behind the microcar at the top of the Bica, looking down to the river (like the reference).
2. A close view of one façade and its street edge.
3. A higher establishing view over the Bica rooftops to the river and bridge.
