# Lisbon Toy Drive — Godot Native Prototype

This folder is the native-game foundation for the Steam/macOS direction. The web app remains the public sandbox; this Godot project is where the serious game world should move.

## Requirements

- Godot 4.6.x
- Node.js 24+ for the Lisbon slice exporter

## Data Pipeline

Generate the playable Lisbon slice:

```bash
npm run export:godot-slice
```

That writes `game/godot/data/lisbon_slice.json`, which is intentionally ignored because it is generated data. The committed `lisbon_slice.sample.json` keeps the Godot project runnable without network access.

The exporter:

- Fetches OSM/Overpass data for central Lisbon.
- Projects lng/lat into the same local meter coordinate system as the web prototype.
- Keeps one connected playable road component near the spawn.
- Filters buildings away from road buffers.
- Exports roads, buildings, greenery, water, and metadata for Godot.

## Godot Project

Open `game/godot/project.godot` in Godot.

Current vertical slice:

- Generates a toy Lisbon world from `lisbon_slice.json` or the sample file.
- Builds road ribbons, sidewalks, simple buildings, green patches, trees, and a monument.
- Adds an arcade car controller, top-down chase camera, and generated engine tone.

## Direction

Keep the first native milestone focused:

1. One beautiful Baixa/Avenida slice.
2. Clean connected roads.
3. No broken intersections or blocked drive paths.
4. Rich toy Lisbon greenery/materials.
5. Five minutes of satisfying driving before expanding scope.
