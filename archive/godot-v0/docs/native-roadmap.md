# Native Roadmap

## Milestone 1 — Playable Native Slice

- Import generated Lisbon slice JSON.
- Render connected roads, sidewalks, buildings, parks, trees, and water.
- Drive with an arcade controller and top-down toy camera.
- Keep the web prototype as the visual/data sandbox.

## Milestone 2 — Real World Model Upgrade

- Move world cleanup into the offline Lisbon slice compiler.
- Export explicit road segments, junctions, spawn metadata, and safe prop placement.
- Replace box buildings with real footprint polygon meshes.
- Build intersection polygons instead of independent road ribbons.
- Generate block meshes between roads and buildings.
- Add collision bodies for buildings, water, and large trees.

## Milestone 3 — Game Feel

- Tune steering, grip, drift, and boost.
- Add engine layers, tire chirps, curb hits, and ambient Lisbon sound.
- Add controller support and pause/settings.
- Add route/checkpoint goals for five-minute play sessions.

## Milestone 4 — Steam/macOS Readiness

- Add title screen and settings.
- Add build/export presets outside source control.
- Run performance capture on target Mac.
- Prepare store capsule/screenshot capture from the native build.
