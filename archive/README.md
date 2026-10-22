# Archive

Earlier Lisbon3D work, moved here on 2026-10-20 when the project restarted (see `plan.md`).
Everything was moved with `git mv`, so `git log --follow <file>` still shows each file's full history.
Nothing in this folder is loaded by the current game.

## `web-v0/` — browser prototype (March–October 2026)

The last playable browser version: a MapLibre aerial map with an "Enter Drive Mode" button that
switches to a Three.js 0.160 toy world, plus earlier experiments.

Run it on its own (it keeps its original dependencies and lockfile):

```bash
cd archive/web-v0
npm ci
npm run dev        # then open the printed URL and choose "Enter Drive Mode"
```

| Path | What it is | Worth reusing |
| --- | --- | --- |
| `index.html`, `main.js` | The last live entry point: aerial map, toy drive mode, optional Overpass fetch. | Ideas only. |
| `src/art/` | Toy palette and procedural props (tram, people, gulls, kiosk). | Prop ideas, rebuilt at the new scale in later stages. |
| `src/geo/osmRealitySlice.js` | Overpass query and OSM parsing. | Parsing helpers, for the Stage 3 district compiler. |
| `scripts/export-lisbon-slice.mjs` | Overpass → local metres → connected road graph, junctions, building filtering. | Yes: basis of the Stage 3 compiler. |
| `src/*System.js`, `src/physics`, `src/rendering`, `src/utils.js`, `src/hybrid-app.js` | Orphaned MapLibre-camera systems; not loaded by `main.js`. | No. |
| `main-simple.js`, `main-minimal.js`, `public/`, `gta-prototype.html`, `index-hybrid.html`, `index-old.html` | Earlier entry points. | No. |
| `css/`, `js/`, `drive-mode-dashboard.html`, `assets/icons/drive-mode-icons.svg` | Neon "night drive" UI experiment. | No; the new direction is different. |

**MapTiler key:** a MapTiler key was hardcoded in five of these files. On 2026-10-20 the value was
replaced with an empty string in `gta-prototype.html`, `main-simple.js`, `main-minimal.js`,
`public/main-simple.js` and `src/hybrid-app.js`. The old value is still in Git history (7 commits since
`1e91819`), so it must be rotated in the MapTiler account; removing it from the files does not make it safe.
The prototype's main entry (`main.js`) never used it.

## `godot-v0/` — native experiment (May 2026)

A Godot 4.6 project that builds a top-down toy world from exported OSM data. Frozen; the restart is
browser-first for the first playable milestone. Open `archive/godot-v0/project.godot` in Godot 4.6.x.

## Also archived

- `docs/archive/planning/`: March planning documents (GTA framing, MapLibre physics plans, neon UI,
  old roadmaps, deployment notes). They describe systems that no longer exist.
- `docs/archive/log/`: early agent progress logs.
- `docs/archive/social/`: social post drafts.
- `docs/archive/refs/`: phone photos of a TV show's map UI. Third-party footage, kept only as history;
  not an art reference.
