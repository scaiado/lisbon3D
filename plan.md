# Lisbon3D — Restart Plan (Stage 0, revision 2)

Status: **approved by kAI on 2026-10-20** (answers in §7). Stage 1 is implemented; see `progress.md` for what is done.
Audited at `main` @ `e9dd1f6` (38 commits, Mar–Oct 2026). Revised 2026-10-20 after kAI reopened the engine decision.

**Product decisions already made by kAI:** area Chiado → Bica → Cais do Sodré · main activity Nata Run delivery with free roam · working title Lisbon3D · replace the current game code and archive useful material · keep Git history, never rewrite it · baked, attributed OSM data with no runtime map services.

---

## 0. Audit summary (what is actually here)

| Area | Finding |
| --- | --- |
| Live entry | `index.html` → `main.js` (76 KB, one class). MapLibre aerial page, then a Three.js 0.160 toy world. Builds with Vite 6. |
| How it plays | Camera **68 m above** the car (car ≈ a 15 px dot), flat ground, hand-typed road polylines, box buildings, arcade steering, circle-vs-box collisions. See `docs/assets/drive-preview.png`. |
| Runtime data | Fetches OSM raster tiles and Overpass live; both failed in this sandbox, so it fell back to procedural streets. |
| Orphaned code | `src/CollisionSystem.js`, `DrivingPhysics.js`, `FirstPersonCamera.js`, `RoadConstraintSystem.js`, `utils.js`, `hybrid-app.js`, `src/physics/*`, `src/rendering/*`, `main-simple.js`, `main-minimal.js`, `public/main-simple.js`, `js/`, `css/`, plus 4 alternate HTML pages. None are loaded by the live entry. |
| Godot | `game/godot` (4.6, ~30 KB GDScript): orthographic camera at 76 m with fixed yaw, box meshes, oversized 3.2 × 5.4 m car, flat ground, tiny sample data. Not run (Godot isn't installed here; I didn't install it). Not treated as a head start for either route. |
| Data pipeline | `scripts/export-lisbon-slice.mjs`: Overpass → local metres → connected road graph, junctions, building filtering. The most reusable logic in the repo. |
| Docs | 10 root planning docs from March (GTA framing, neon UI, MapLibre physics) that don't describe the code. `docs/design-system.md` palette fits the new direction. |
| Assets | SVG logos/icons, two screenshots. `docs/refs/ref-visual-*.jpg` are phone photos of a TV show's UI — not usable as direction. No models, textures, or audio. |
| Hygiene | **1,739 `node_modules/` files committed** (incl. a macOS-only esbuild binary) and `dist/index.html` committed, despite `.gitignore`. No tests, lint, CI. |
| Local folder copy | One commit behind; has an untracked, outdated `AGENTS.md` describing the GTA build. |

### Hardcoded MapTiler key — every location

The key literal appears in **5 tracked files**: `gta-prototype.html:215`, `main-simple.js:10`, `main-minimal.js:9`, `public/main-simple.js:10`, `src/hybrid-app.js:11` (each also builds `api.maptiler.com` URLs from it a few lines later). `docs/pov-research.md:56` and `docs/log/forge-progress.md:63` mention the variable but not the value. The same 5 files exist in the project's local folder copy. The literal is in **7 commits** of public history, back to `1e91819` (2026-03-24), and may be inside past Vercel deployments. Removing it from active code does **not** make it safe — rotation in the MapTiler account is required (kAI will do this). The current live entry (`main.js`) does not use it.

---

## 1. Engine decision

### Verified versions (2026-10-20)

| Component | Latest stable | Source checked | Notes |
| --- | --- | --- | --- |
| Godot | **4.7.2-stable** (18 Aug 2026) | godotengine.org maintenance-release post + download archive | Web export docs (4.7): "Godot 4 can only target WebGL 2.0 (using the Compatibility rendering method)… Godot currently does not support WebGPU". C# projects cannot export to web. |
| three | **0.186.1** (r186, 24 Sep 2026) | npm registry `latest`; GitHub r186 release | three.js manual: WebGPURenderer "is still in an experimental state although its maturity level has been greatly improved"; `WebGLRenderer` "remains the recommended choice for pure WebGL 2 applications". |
| @types/three | **0.186.0** | npm registry | three ships no types. Tagged for TS 5.6–7.1. |
| Vite | **8.3.4** (8 Oct 2026) | npm registry `latest`; vite.dev Vite 8 announcement | You mentioned 8.1; 8.1.x is still patched (8.1.6) but 8.3.4 is the current stable. Rolldown bundler, Oxc transforms. Node `^20.19 \|\| >=22.12`. |
| TypeScript | **7.0.2** (8 Jul 2026) | npm registry `latest`; TS 7.0 announcement (via InfoQ / dev.to summaries) | Native Go compiler. **Ships no stable compiler API until 7.1**, so tools that import `typescript` (typescript-eslint, ts-morph) don't work with it yet. Vite only transpiles TS; we use `tsc --noEmit` for type checks, which 7.0.2 handles. |
| @playwright/test | **1.64.1** (14 Oct 2026) | npm registry `latest` | For functional checks only. |
| Rapier (optional) | **0.21.0** (`@dimforge/rapier3d-compat`, 25 Sep 2026) | npm registry | Pre-1.0. Only added if the Stage 2 spike shows we need it. |
| Node.js | 24 LTS (sandbox has 22.22, also compatible) | Vite engines field | Pin via `.nvmrc` + `engines`. |

### Browser WebGPU reality (caniuse, Oct 2026)

Chrome/Edge desktop: supported. Safari macOS 26: **partial**. Safari iOS 26: supported. **Firefox desktop: disabled by default.** So a meaningful share of laptop players will run any WebGPU-first build on the **WebGL 2 fallback**. WebGL 2 is the real floor for both routes.

### Comparison

| Criterion | Godot 4.7.2 (fresh project) | TypeScript + Vite 8.3 + three r186 |
| --- | --- | --- |
| **Visual quality, native** | Excellent: Forward+ (SDFGI, volumetric fog, SSAO/SSIL, SSR, TAA/FSR), new HDR output, AreaLight3D. | n/a (browser only, unless wrapped). |
| **Visual quality, in a browser** | Capped at the **Compatibility renderer**: no Forward+ GI/fog/SSR/SSAO; mostly baked lighting + glow. Docs note Safari has WebGL 2 issues. | WebGPURenderer + TSL post stack (bloom, GTAO/SSAO, DoF, colour grading) on WebGPU **and** WebGL 2 fallback, needs verifying per effect. Or the stable WebGLRenderer + EffectComposer. Stylized miniature look doesn't need GI; both browser routes can reach it. |
| **Driving / game tooling** | Strong: editor, scenes, animation, VehicleBody3D, Jolt physics, input/gamepad maps, profiler. | Assemble it yourself: custom arcade vehicle (or Rapier), own input, own debug UI. More code, but the car model is custom in either engine for this game feel. |
| **Iteration speed** | Fast in the editor; web build needs export + serve per test. | Very fast hot reload in the browser that *is* the target; code-driven world builder, no export step. |
| **Perf on MacBook Air M4 / ordinary laptops (estimate)** | Native: very good. Web: WebAssembly + WebGL 2, single-threaded export recommended for Safari/macOS; generally heavier than hand-tuned three.js for the same scene. | Good if budgets are enforced (instancing, merged geometry, shadow budget). WebGPU path unproven per browser. Must be measured on real hardware. |
| **Deployability** | Static files; threaded builds need cross-origin isolation headers (single-thread avoids that). | Static files on Vercel as today. |
| **Download size (estimate)** | Engine wasm alone is roughly 8–10 MB compressed before game content (estimate; a custom slim template can reduce it). | three (tree-shaken) + game code ≈ 0.4–0.8 MB gz (estimate); rest is our data/textures/audio. |
| **Browser/device support** | WebGL 2 browsers; mobile works with caveats; web audio limited (no AudioEffects, reverb, or procedural audio in default mode). | WebGL 2 browsers everywhere; WebGPU where available. Web Audio fully available. |
| **Future native (Steam/macOS)** | Best-in-class: native exports, consoles via partners. | Desktop wrapper (Tauri/Electron) is viable for Steam/macOS but not consoles; native quality ≈ browser quality. |

### Recommendation: **browser-first — TypeScript 7.0.2 + Vite 8.3.4 + three 0.186.1**

In plain language: your brief makes "plays in a browser on a normal laptop" the main requirement for this milestone. Godot's big visual advantages live in its Forward+ renderer, and **that renderer can't run in a browser** in 4.7; its web build drops to the Compatibility renderer, adds an ~8–10 MB engine download (estimate), and limits audio. Godot would be the better pick if the primary target were a native Steam/macOS game. For a browser game, three.js lets us spend the whole budget on the art direction, keeps the download small, and we test in the same place players play.

- **Browser version: core product requirement** for this milestone.
- **Native distribution: a later option**, not a goal of this milestone. If native becomes primary later, the content pipeline stays engine-neutral (baked district JSON + glTF props), so a Godot port of the *content* stays possible. The code would not port.

**Renderer: decided by a Stage 1 spike, not assumed.** Default plan is `WebGPURenderer` (import from `three/webgpu`) with TSL node materials, because its post-processing stack is where three.js is investing and the same materials run on its WebGL 2 backend. Because the docs still call it experimental, the spike must pass on **Chrome (WebGPU), Safari macOS (WebGPU partial), Firefox (WebGL 2 fallback) and `forceWebGL: true`**: shadows, tone mapping, fog, bloom, AO, depth of field, instancing, and frame time on your MacBook Air M4. If any required effect fails on the fallback, we switch to `WebGLRenderer` + `three/addons` EffectComposer. That's a contained change, since we'd write no `ShaderMaterial`/`onBeforeCompile` code in either case.

---

## 2. Keep, adapt, archive, replace

- **Keep in place:** Git history; `assets/logos`, `assets/icons/favicon.svg` (until a new identity exists); `docs/design-system.md` palette direction; `vercel.json`; `.gitignore` (extended).
- **Adapt (port to TypeScript in `tools/`):** `scripts/export-lisbon-slice.mjs` → offline district compiler (projection, connected road component, junctions, building filtering); parsing helpers from `src/geo/osmRealitySlice.js`; palette ideas from `src/art/toyPalette.js`; prop *ideas* (tram, gull, kiosk) from `src/art/toyFactories.js`, rebuilt at the new scale.
- **Archive** (`git mv`, out of the runtime, with `archive/README.md` explaining each piece):
  - `archive/web-v0/`: `index.html`, `main.js`, `src/`, `main-simple.js`, `main-minimal.js`, `public/`, `js/`, `css/`, `gta-prototype.html`, `index-hybrid.html`, `index-old.html`, `drive-mode-dashboard.html`, `vite.config.js`, `package.json`, `package-lock.json`. The 5 key-bearing files get the literal replaced with an empty placeholder in the same commit.
  - `archive/godot-v0/`: `game/godot/` (stays openable in Godot 4.6).
  - `docs/archive/`: `GTA_*`, `ARCHITECTURE-*`, `ROAD_PHYSICS_ARCHITECTURE.md`, `ROADMAP*.md`, `DELIVERY_SUMMARY.md`, `QUICKSTART.md`, `README-DESIGN.md`, `DRIVE_MODE_DESIGN.md`, `docs/pov-research.md`, `docs/log/`, social drafts, `docs/refs/`.
- **Untrack (kept on disk, history intact):** `node_modules/`, `dist/` via `git rm -r --cached`.
- **Replace:** map-first entry, overhead camera, flat world, box car/buildings, runtime Overpass/tiles.

---

## 3. Architecture (browser-first)

```
index.html            minimal shell, loading screen
src/
  main.ts             boot, renderer init (await renderer.init()), state machine: title → explore ↔ nata-run → results
  core/               fixed-step sim (60 Hz) + interpolated render, input (keyboard, Gamepad API), settings, quality tiers
  world/              district loader, height function, road/curb/sidewalk/junction mesher, block + façade builder,
                      landmark set-pieces, instanced prop scatter, river, sky
  vehicle/            arcade microcar: raycast suspension against the road height function, grip/slide model,
                      body roll/pitch/squash; collision vs footprint polygons and curbs (2D, swept circle)
  camera/             chase rig: look-ahead, slope-aware pitch, wall avoidance in lanes; postcard (photo) mode
  activity/           Nata Run: pickup, 3 drops, warmth meter, stars, results; 5 postcard spots
  life/               tram on rails, a few tiny cars on splines, pedestrians, gulls (pooled)
  render/             TSL materials, lighting, post chain, perf overlay (fps, frame time, draw calls, triangles)
  ui/                 DOM HUD (job card, compass ribbon), title, pause, results
public/data/          district.json (compiled, committed, target < 1 MB), attribution.json
data/raw/             raw OSM extract + extraction record (committed, never shipped)
tools/                district compiler (TS, run with Node), slice validators, benchmark page
tests/                Playwright functional tests
docs/                 one doc per major component
```

- **Language/tooling:** strict TypeScript 7.0.2 (`tsc --noEmit` in CI), Vite 8.3.4 for dev/build, Playwright 1.64.1. Exact versions pinned (no `^`), `package-lock.json` committed, `npm ci` only. No typescript-eslint until TS 7.1 ships an API; formatting/lint deferred, not blocked on.
- **Physics:** custom arcade vehicle first (deterministic, tiny, tuned for feel). Rapier 0.21.0 is the fallback if Stage 2 shows custom collision isn't good enough.
- **Data:** OSM (ODbL) for one district, extracted once, hand-cleaned, committed, credited in-game. **No runtime calls to Overpass or tile servers.** Elevation hand-authored per street from known gradients, cross-checked against public contour data; 30 m DEMs are too coarse.
- **Content:** procedural but art-directed façade grammar (Pombaline, Bairro Alto narrow houses, tiled vs painted, balconies, shutters, laundry, shopfronts) seeded per building, plus hand-modelled landmarks built in code or as small glTF files. No asset-store packs.

---

## 4. Creative direction

An original game: **a tiny courier in a sunlit miniature Lisbon.** Open-world driving is a mood reference for scale, light and discovery only. Nothing about crime, and nothing borrowed from that genre's look.

- **Style — tactile miniature:** rounded, chunky, readable shapes; matte painted surfaces with subtle roughness variation; soft contact shadows; gentle tilt-shift depth of field when the camera rises. Not generic flat low-poly.
- **Light and palette:** fixed late-afternoon gold. Pastel ochre, rose, sage and lime-wash walls, terracotta roofs, azulejo blue/green accents, a silver-blue Tejo. Warm key light, cool bounce in narrow lanes.
- **Environment:** steep streets you feel in the car; tiled façades, rooftops, laundry lines, calçada wave pavements, tram rails and overhead wires, the Bica funicular, the Santa Catarina viewpoint framing river and bridge, the Rua do Alecrim descent, Pink Street, the Cais do Sodré waterfront. Small surprises: a cat on a step, grill smoke, a tram bell, pigeons scattering.
- **Vehicle:** an original 2-seat microcar (~2.4 × 1.3 m), rounded bubble body, big headlights, squash on bumps, body roll and nose dive, a cheerful little engine voice, three paint options. Traffic is other tiny cars; trams are big by comparison and a playful hazard.
- **Camera:** low chase (~5 m back, ~2 m up, FOV ~55°), looks ahead into turns and down steep hills, drops lower and widens with speed, never clips walls in lanes. Postcard mode: free orbit, DoF, HUD hidden.
- **Interface:** small and typographic. Cream cards, ink text, one accent colour, tile-inspired icons we draw ourselves. HUD = job card + compass ribbon only. Title screen over a slow flyover.

---

## 5. First playable milestone — "One afternoon in Chiado"

District ≈ 600 × 450 m: Praça Luís de Camões and the tram 28 corridor, Rua do Loreto / Calçada do Combro, Bica funicular street, Miradouro de Santa Catarina, Rua do Alecrim, Rua Nova do Carvalho, Cais do Sodré waterfront.

**Nata Run:** collect a box of hot pastéis de nata at a bakery and deliver three orders (viewpoint, riverfront, a steep lane). A warmth meter replaces a hard timer; crashes and big bumps jiggle the box. Stars depend on warmth. Free roam between runs, with 5 hidden postcard spots.

**Acceptance criteria** (performance numbers are targets; they count as met only when measured on real hardware)
1. URL → title → Play → driving in **≤ 10 s** on broadband (measured on your laptop).
2. **Total transfer ≤ 15 MB hard cap, ≤ 10 MB target** (estimate: ≤ 1 MB code, ≤ 1 MB data, rest textures/audio). Measured from the production build's network log.
3. **Frame rate, measured on kAI's MacBook Air M4** in Chrome and Safari, default tier, with browser and macOS versions and the actual render resolution (CSS viewport, device pixel ratio, drawing-buffer pixels) recorded with every result: **60 fps target, 1 % lows ≥ 45 fps**. Firefox (WebGL 2 fallback) on the same machine: ≥ 45 fps default tier. An ordinary Intel Iris Xe / UHD-class laptop: ≥ 30 fps on the low tier. These are estimates until benchmarked; headless runs are never used as evidence.
4. Handling: predictable accelerate/brake/slide/recover; climbs Bica and descends Alecrim; never stuck on curbs or seams; respawn (R) always lands on a road facing along it.
5. Camera never ends inside geometry on any street of the district; steep streets read as steep.
6. District closed and traversable: no holes, floating props, z-fighting; no two neighbouring buildings identical; ≥ 6 hand-built landmarks.
7. Nata Run completable in 3–6 min with clear guidance, results, Retry and Back to exploring.
8. Keyboard and gamepad; pause menu with restart, controls, quality tier, mute.
9. Ambient life: ≥ 1 tram on rails, a handful of tiny cars, pedestrians, gulls; ambient city and engine audio.
10. Works in current Chrome, Edge, Safari and Firefox on macOS and Windows; WebGL 2 fallback looks intentionally the same.
11. OSM attribution visible; no third-party trademarks or assets; no credentials in the repo.
12. A playtester who hasn't seen it calls it "Lisbon" unprompted.

---

## 6. Staged implementation

Each stage ends with a summary, screenshots, check results, and a stop for approval. Each stage updates `progress.md` and `TODO.txt` and adds a `docs/<component>.md` per major component.

| Stage | Work | Done when |
| --- | --- | --- |
| **1. Clean base + renderer spike** | Archive per §2 (git mv), untrack `node_modules`/`dist`, blank the key in the 5 files, new TS/Vite app with pinned deps + lockfile, perf overlay, Playwright smoke test, `tsc` check. **Renderer spike:** one look-test scene (lit block, shadows, fog, bloom, AO, DoF, 2k instanced props) on WebGPURenderer, run with and without `forceWebGL`. | Archived game still runs from `archive/web-v0`; smoke test green; you run the benchmark page on your MacBook Air M4 in Chrome/Safari/Firefox and we pick WebGPURenderer or WebGLRenderer from the numbers and visuals. |
| **2. Car + camera on a greybox hill** | Microcar and chase camera on a test street with a 20 % slope, a narrow lane and a hairpin. Decide custom vs Rapier. | You approve the feel in a 2-minute drive. Feel is locked before any art. |
| **3. District blockout** | District compiler, baked data, height function, roads/curbs/sidewalks/junctions, building massing, collisions, river edge. | Whole district drivable in greybox; compiler validators pass; perf budget has headroom. |
| **4. Art pass** | Lighting/post, façade grammar, roofs, calçada, azulejos, rails/wires, landmarks, props, sky/river. | Screenshot set from 8 fixed cameras approved by you, on both renderer backends. |
| **5. Life + Nata Run** | Tram, traffic, pedestrians, gulls, audio, delivery loop, postcard spots, results. | Criteria 7–9 pass. |
| **6. Polish + ship** | Title flyover, pause/settings, quality tiers, load time, attribution, Vercel preview deploy. | All criteria checked and recorded in `progress.md`. |

**Performance budget (default tier, estimate):** ≤ 250 draw calls, ≤ 600 k visible triangles, one sun shadow with a tight cascade around the car, instanced props, merged static geometry per block, AO baked into vertex colours, few textures ≤ 2K, device pixel ratio capped at 1.5. Low tier: blob shadows, colour grade only.

**Risks**
- *WebGPURenderer maturity / fallback gaps* → Stage 1 spike across 4 browsers, TSL-only materials, a documented switch path to WebGLRenderer.
- *Safari WebGPU partial, Firefox WebGL 2 only* → treat the WebGL 2 path as first-class; test both every stage.
- *TypeScript 7 has no compiler API yet* → no tools that import `typescript`; revisit linting at TS 7.1.
- *Rapier pre-1.0* → only adopted if needed, pinned exactly.
- *Hill seams snag the car* → roads, curbs and sidewalks from one height function; curbs are collision lines, not steps.
- *Art scope* → façade grammar first, few hero landmarks, nothing placeholder-looking ships.
- *Narrow lanes vs camera* → collision-aware rig, tested on every street.
- *OSM extraction blocked here* (this sandbox returns tunnel errors for OSM hosts) → either allow the Overpass host in the environment's network settings, or you run one documented command locally (below). No invented data.
- *Native later* → engine-neutral data; honest that code wouldn't port to Godot.

**Local OSM export step** (Stage 3, run by kAI; approved route): from the repo root, one command such as `node tools/export-district.ts --bbox 38.7060,-9.1490,38.7125,-9.1405 --out data/raw/district.osm.json` (Node 24, type-stripping). It makes one Overpass request (~1–3 MB) for `highway`, `building` (+ `building:levels`, `height`), `railway=tram|funicular`, `natural=water`, `leisure=park`, `amenity`, `tourism=viewpoint`, and writes the extraction date, query and source next to the data. The raw extract lives in `data/raw/`, **outside** `public/`, so it never ships to players; the compiler produces the small runtime file in `public/data/`. The exact command and bbox are finalised at the start of Stage 3.

**Verification**
- Playwright 1.64.1 functional tests each stage: page loads, no console errors, renderer backend reported, scripted drive reaches a checkpoint, screenshots from fixed cameras. **Functional only, never frame-rate evidence.**
- `tsc --noEmit`, district validators (connected graph, spawn on road, no building over a road).
- Benchmark mode (`?bench=60`): 60 s scripted drive reporting average and 1 %-low fps, frame-time percentiles, draw calls, triangles, browser/OS/resolution. kAI runs it on the MacBook Air M4 (and an ordinary laptop if available), and the numbers go into `progress.md`.
- Manual playtest checklist with your sign-off.

---

## 7. Decisions (answered by kAI, 2026-10-20)

1. **Engine:** browser-first for this milestone with TypeScript 7.0.2, Vite 8.3.4 and three 0.186.1, exact versions pinned with a committed lockfile, rechecked before installing. `WebGPURenderer` stays behind the cross-browser spike; the WebGL 2 route is first-class. No Godot for this milestone.
2. **Spike and benchmark:** approved. Target device is kAI's **MacBook Air M4** (not M1). kAI runs the benchmark in Chrome, Safari and Firefox; results record browser/OS versions and the actual resolution.
3. **Archive:** layout in §2 approved, including untracking `node_modules/` and `dist/`. The old browser prototype stays runnable from `archive/web-v0`, Git history is preserved and never rewritten, and the exposed key is removed from the five files. kAI rotates the key.
4. **OSM data:** the one-command local extraction at Stage 3; the environment's network settings stay as they are. Record extraction date, query, source and ODbL attribution; keep the raw extract out of the downloaded game assets and ship only the smallest compiled district data. No fetching in Stage 1.

Earlier product decisions: area Chiado → Bica → Cais do Sodré; Nata Run delivery with free roam; working title Lisbon3D.
