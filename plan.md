# Lisbon3D — Restart Plan (revision 3: visual-first)

Status: **revision 3 awaiting kAI's approval.** Revisions 1–2 (engine, repo, Stage 1) were approved on 2026-10-20 and Stage 1 is done (PR #1, kept as a benchmark only). Revision 3 replaces the greybox-first sequence with a visual direction and asset-pipeline proof (§4–§5, §7); open questions are in §8.
Audited at `main` @ `e9dd1f6` (38 commits, Mar–Oct 2026). Revised 2026-10-20 after kAI reopened the engine decision, and again the same day after kAI corrected the visual brief.

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
  main.ts             boot, renderer init, state machine: title → explore ↔ nata-run → results
  core/               fixed-step sim (60 Hz) + interpolated render, input (keyboard, Gamepad API), settings, quality tiers
  world/              district loader (OSM geography), kit-based building placement from authored recipes,
                      streets/curbs/calçada from the height function, landmark set-pieces, river and backdrop layers
  vehicle/            arcade microcar: raycast suspension, grip/slide model, body roll/pitch/squash, collisions
  camera/             chase rig: look-ahead, slope-aware pitch, wall avoidance in lanes; postcard (photo) mode
  activity/           Nata Run: pickup, 3 drops, warmth meter, stars, results; 5 postcard spots
  life/               tram and funicular on rails, a few tiny cars, pedestrians, gulls (pooled)
  render/             materials, lighting, post chain, perf overlay
  ui/                 DOM HUD (job card, compass ribbon), title, pause, results
art/                  asset SOURCE, never shipped: Blender build scripts, kit definitions, building recipes,
                      texture sources (SVG/painted layers), style frames, asset ledger
public/assets/        shipped, optimised assets: .glb (meshopt) + KTX2 textures
public/data/          compiled district geography (small JSON), attribution
data/raw/             raw OSM extract + extraction record (committed, never shipped)
tools/                district compiler, asset build (Blender → glTF → optimise), validators, benchmark
tests/                Playwright functional tests
docs/                 one doc per major component
```

- **Language/tooling:** strict TypeScript 7.0.2, Vite 8.3.4, three 0.186.1, Playwright 1.64.1, exact pins and committed lockfile.
- **Physics:** custom arcade vehicle first; Rapier 0.21.0 only if needed.
- **Geography vs. look:** OSM gives street layout, footprints, heights and relationships. **It is never the visual design.** What players see comes from the authored Lisbon kit (§4b).
- **Renderer:** the Stage 1 spike stays as a technical benchmark only. It is re-run on the visual-proof scene, which is far more representative than boxes; that run, not the box scene, informs the WebGPU vs WebGL choice.

---

## 4. Creative direction — an illustrated 3D Lisbon

An original game: **a tiny courier in a sunlit, illustrated Lisbon.** The ambition is the composition, light, material richness, detail and sense of place of a premium modern game, expressed as **illustration**, not realism. No objects, people, UI or visual signatures borrowed from any existing game.

**The look in one line:** a hand-illustrated city you can drive through — buildings that read like beautiful architectural drawings coloured with gouache, at true street scale, under warm late light.

- **Façades are the stars.** Each building has a clear composition: rhythm of tall Pombaline windows, real depth (window reveals, sills, cornices, string courses, stone corner pilasters), wrought-iron balconies with real bars, shutters, tile panels, shopfronts with hand-lettered signs, laundry, plants, small damage and repairs. Plaster has a painted wash with visible brush texture and soft staining; azulejo panels have designed patterns (ours, inspired by Lisbon's tile traditions, not copied panels).
- **Silhouettes and rooflines:** terracotta canal-tile roofs with visible tile rows, eaves, chimneys, dormers, mansards in Chiado, roof terraces, TV aerials, the odd palm or bougainvillea. Skylines step down the hill to the river.
- **Ground:** calçada portuguesa with designed patterns (waves, borders), worn granite curbs, cobbles, tram rails set in stone, manholes, painted kerb marks.
- **Light:** one strong warm late-afternoon sun; deep, coloured shade in narrow streets; bounce light glowing off ochre walls; baked ambient occlusion in every corner so nothing floats. Atmospheric haze layers the depth down to the Tejo.
- **Depth and composition:** foreground (props, café tables), midground (the street), background (rooftops, river, far shore and bridge silhouette as layered painted cards). Every review view is composed like an illustration, not a map.
- **Landmarks** get bespoke silhouettes: the Bica funicular car and its stepped street, the Santa Catarina viewpoint with its statue plinth and kiosk, Largo de Camões, the riverfront arcades at Cais do Sodré.
- **Vehicle:** an original 2-seat microcar (~2.4 × 1.3 m) designed as a hero object: rounded body with panel lines, chrome trim, big expressive headlights, a roof rack with the pastry box, a little character in its stance. Designed and modelled properly, not a placeholder.
- **People and animals:** small, simple, stylised figures that suit the illustration (no realistic humans). Cats, gulls, pigeons.
- **Camera:** low chase (~5 m back, ~2 m up, FOV ~55°), looking down steep streets; close-up postcard mode.
- **Interface:** small, typographic, cream and ink, our own tile-inspired icons.

**Explicitly avoided:** bare cuboids, cone roofs, repeated procedural buildings, floating boxes, flat single-colour materials, generic low-poly, oversized UI, anything resembling another game's assets.

### 4b. Asset pipeline

1. **Style frames first.** Before modelling, 2–3 style frames of the proof scene to lock the illustration style (for example: soft gouache painting vs. clean ink-line illustration vs. painted miniature), plus palette and material swatches. You pick one.
2. **Authored kit in Blender.** Modules modelled in Blender 5.2.2 from Python build scripts committed in `art/` (so every asset is reproducible and reviewable as text): window bays with reveals and frames, door and shopfront bays, cornices and string courses, corner pilasters, wrought-iron balconies, shutters, canal-tile roofs, eaves, chimneys, dormers, tile panels, signs, calçada borders, tram rails and wires, street furniture. Dimensions follow real Lisbon proportions.
3. **Authored buildings, not random ones.** Each building is a hand-written recipe in `art/buildings/` (which bays, storeys, colours, tile pattern, signs, details). Procedural variation is limited to small things (weathering, plants, laundry placement) on top of authored choices. Landmarks are modelled one-off.
4. **Illustrated textures.** Trim sheets and atlases authored as layered SVG/vector art (tile patterns, signage, ironwork, mouldings) plus painted wash layers; ambient occlusion, curvature and soft light baked in Blender into the colour maps so the painted look survives a simple real-time lighting model. **Optionally** AI-generated paint textures or concept images, only if you approve it (§8), each recorded in an asset ledger with source and licence.
5. **Export and optimise.** glTF 2.0 (.glb) → glTF-Transform: deduplicate, instance, meshopt geometry compression, KTX2 textures (UASTC for hero colour/normal maps, ETC1S for the rest). Loaded with three.js `GLTFLoader` + `KTX2Loader` + `MeshoptDecoder`.
6. **Two kinds of proof image.** (a) The **in-browser render** at the real chase-camera and street views — this is what the visual acceptance criteria judge, because it's what players get. (b) Optional Blender Cycles "target" renders of the same views, clearly labelled, to show the intended art direction when in-browser and offline differ.

**What I can and can't do with the tools available here (verified 2026-10-20):**
- Blender 5.2.2 is installable here as the official `bpy` Python module from PyPI (Python 3.13; ~400 MB download; blender.org itself is blocked from this sandbox). It runs headless; Cycles renders on 4 CPU cores — fine for stills, slow for animation. Not installed yet: it needs your OK (§8).
- I model by **writing precise Blender scripts**, not by sculpting or painting with a mouse. That suits architecture (mouldings, balconies, tiles, roofs) very well and organic forms (trees, people, animals) less well; those stay simple and stylised.
- I author textures as **vector art and layered procedural paint**, not freehand brushwork. The gouache feel comes from designed brush/wash textures, baked light and colour work. If you allow it, AI image generation (available in this session through Canva) can supply concept frames or painterly texture layers.
- **Honest limit:** premium game art is normally made by environment artists and illustrators over months. The proof will show whether this pipeline reaches your bar on one street. If it doesn't, the realistic next step is a human 3D artist/illustrator for the kit and hero buildings; the pipeline is set up so their Blender/glTF files and textures drop straight in.

---

## 5. Visual proof (next stage, awaiting approval)

**Scene:** the top of the Bica street at the junction of Calçada do Combro / Rua do Loreto, looking down Rua da Bica de Duarte Belo toward the Tejo. About 120 m of street: the steep, narrow Bica slope with its funicular car and rails, the tram-28 street crossing at the top, ~12–16 authored buildings on both sides (two façade families: Pombaline Chiado blocks and narrow Bica houses), rooflines stepping down, and the river, far shore and bridge as layered backdrops. Geography is approximate for the proof (a reference sketch from public maps, no data fetch); OSM accuracy comes at district production.

**Assets in the proof:** façade kit (~25 modules), ~14 authored building recipes, roof kit, calçada and stone ground set, tram/funicular rails and wires, the Bica funicular car (stylised, original), ~20 street props (lamps, bollards, kiosk, café set, planters, signs, bins, laundry), the hero microcar, a few stylised people/animals, sky and river backdrop cards.

**Review images (in-browser, 1920 × 1080, also delivered as live views):**
1. Street-level gameplay view: chase camera behind the microcar at the top of Bica, looking down the street to the river.
2. Close view: one façade and its street edge — tiles, ironwork, shopfront, signage, calçada.
3. Establishing view: higher, wider view down over the Bica rooftops to the river and bridge, reading unmistakably as Lisbon.

**Visual acceptance criteria (judged on the in-browser images; you sign off):**
1. No bare cuboids, cone roofs, flat single-colour surfaces or floating objects anywhere in the three views.
2. Every façade has real relief (reveals, sills, cornices, balconies) and at least one Lisbon-specific detail (tile panel, ironwork, shutters, shopfront lettering, laundry).
3. No two neighbouring buildings share a composition; repeats elsewhere are not noticeable in the three views.
4. Roofline silhouette is varied (tiles, eaves, chimneys, dormers, steps down the hill) against the sky.
5. Ground reads as Lisbon: calçada pattern, granite curbs, rails in stone.
6. Lighting: warm sun, coloured shade, baked occlusion in corners, layered haze toward the river.
7. Composition: clear foreground, midground and background in each view; the microcar is a charming, readable hero at chase distance.
8. One coherent illustration style across buildings, props, car and backdrop.
9. Someone who hasn't seen the project recognises Lisbon from view 1 or 3 without being told.
10. Nothing copied: all models, textures, patterns and lettering are ours, or licensed and listed in the asset ledger.

**Estimated effort (estimate, agent working sessions):** style frames 1 day · kit and landmark modelling 3–4 days · textures and baking 2–3 days · scene assembly and lighting 1–2 days · browser integration and compression 1 day · two review rounds ~1 day each. **Roughly 9–13 working days**, depending on review rounds.

**Browser performance implications (estimates until measured on your M4):**
- Detail costs mostly triangles and texture memory, not draw calls, if kit modules are merged per building and props are instanced. Proof target: ≤ 300 draw calls, ≤ 1.5 M visible triangles at the chase camera, GPU texture memory ≤ 512 MB (KTX2 stays compressed on the GPU).
- Baked lighting/occlusion in textures lets real-time lighting stay simple (one shadowed sun, light post-processing), which is what keeps illustrated detail affordable in a browser.
- Distant city and river are painted backdrop cards and simplified LODs, not full geometry.
- The renderer benchmark from Stage 1 is re-run on the proof scene in Chrome, Safari and Firefox; the WebGPU vs WebGL decision is made then.

---

## 6. First playable milestone — "One afternoon in Chiado"

District ≈ 600 × 450 m: Praça Luís de Camões and the tram 28 corridor, Rua do Loreto / Calçada do Combro, Bica funicular street, Miradouro de Santa Catarina, Rua do Alecrim, Rua Nova do Carvalho, Cais do Sodré waterfront. Built only after the visual proof is approved, from the same kit.

**Nata Run:** collect a box of hot pastéis de nata at a bakery and deliver three orders (viewpoint, riverfront, a steep lane). A warmth meter replaces a hard timer; crashes and big bumps jiggle the box. Stars depend on warmth. Free roam between runs, with 5 hidden postcard spots.

**Acceptance criteria** (performance numbers are targets; met only when measured on real hardware)
1. URL → title → Play → driving in **≤ 15 s** on broadband (measured on your laptop), with the rest of the district streaming in while you drive.
2. **Download budget, revised for illustrated assets (estimates, to be re-set from the proof's measured sizes):** initial load to playable **≤ 25 MB**; whole district **≤ 60 MB**, streamed. The old 15 MB cap is dropped because it would force the box look we are moving away from.
3. **Frame rate on kAI's MacBook Air M4** in Chrome and Safari, default tier, with browser/OS versions and actual resolution recorded: **60 fps target, 1 % lows ≥ 45 fps**. Firefox (WebGL 2) ≥ 45 fps. Ordinary Intel Iris Xe / UHD-class laptop ≥ 30 fps on the low tier. Estimates until benchmarked; headless runs never count.
4. All visual acceptance criteria from §5 hold across the district, not just the proof street.
5. Handling: predictable accelerate/brake/slide/recover; climbs Bica, descends Alecrim; never stuck on curbs or seams; respawn always lands on a road.
6. Camera never ends inside geometry; steep streets read as steep.
7. District closed and traversable; ≥ 6 bespoke landmarks.
8. Nata Run completable in 3–6 min with guidance, results, Retry and Back to exploring.
9. Keyboard and gamepad; pause menu with restart, controls, quality tier, mute.
10. Ambient life: tram, funicular, a few tiny cars, stylised pedestrians, gulls; ambient audio.
11. Works in current Chrome, Edge, Safari and Firefox on macOS and Windows; the WebGL 2 path looks intentionally the same.
12. OSM attribution visible; asset ledger complete; no third-party trademarks or assets; no credentials in the repo.

---

## 7. Staged implementation (visual-first)

Each stage ends with a summary, images, check results, and a stop for approval. Each stage updates `progress.md` and `TODO.txt` and adds a `docs/<component>.md` per major component.

| Stage | Work | Done when |
| --- | --- | --- |
| **1. Clean base + renderer spike** ✓ | Archive, untrack, key removal, new TS/Vite/three app, look-test benchmark (PR #1). **Kept as a technical benchmark only; not merged to production.** | Done; benchmark re-run later on the proof scene. |
| **2a. Visual direction** | Art-direction sheet, reference notes for Bica/Chiado, palette and material swatches, 2–3 style frames of the proof scene. | You pick one style. |
| **2b. Visual proof + asset pipeline** | Blender kit and build scripts, ~14 authored buildings, Bica funicular, props, hero microcar, illustrated textures with baked light, glTF/KTX2 pipeline, three review images in the browser (+ optional Cycles targets). Re-run the renderer benchmark on this scene. | The §5 visual acceptance criteria pass and you approve the look. |
| **3. Car + camera feel in the proof street** | Arcade microcar and chase camera tuned on the real Bica slope and junction, not a greybox. | You approve the feel in a 2-minute drive. |
| **4. District production** | Local OSM export (your one command), district compiler, kit placed on real footprints with authored recipes, landmarks, streaming, budgets. | District passes §6 criteria 2–7 on your M4. |
| **5. Life + Nata Run** | Trams, funicular, traffic, pedestrians, gulls, audio, delivery loop, postcard spots. | §6 criteria 8–10 pass. |
| **6. Polish + ship** | Title flyover, pause/settings, quality tiers, load time, attribution, Vercel preview. | All criteria recorded in `progress.md`. |

**Risks**
- *The scripted pipeline may not reach a premium illustrated look* → that is exactly what Stage 2 tests on one street before anything is scaled; fallback is a human artist for kit and hero assets, using the same pipeline.
- *Asset weight in a browser* → KTX2 + meshopt, merged kit meshes, backdrop cards, streaming; budget re-set from measured proof numbers.
- *Texture tooling here:* KTX2 encoding needs KTX-Software's `toktx` binary; if it can't be installed in this sandbox, WebP textures are the fallback for the proof (smaller download, more GPU memory) and KTX2 is produced locally.
- *Style drift across many assets* → one style frame, shared trim sheets and palette, an asset ledger, and side-by-side reviews.
- *AI-generated imagery* (only if approved) → used only where recorded in the ledger with source and licence; never for logos, signage wording or anything resembling real brands.
- *WebGPU stability* (Stage 1 finding: r186 crashed in Chromium 141) → keep the automatic WebGL 2 fallback; decide the renderer on the proof scene.
- *Narrow lanes vs camera, hill seams* → handled in Stage 3 on the real street.
- *Native later* → glTF assets and recipes are engine-neutral.

**Local OSM export step** (Stage 4, run by kAI; approved route): one command such as `node tools/export-district.ts --bbox 38.7060,-9.1490,38.7125,-9.1405 --out data/raw/district.osm.json` (Node 24). One Overpass request (~1–3 MB) for `highway`, `building` (+ `building:levels`, `height`), `railway=tram|funicular`, `natural=water`, `leisure=park`, `amenity`, `tourism=viewpoint`, with extraction date, query and source written next to the data. The raw extract stays in `data/raw/`, outside `public/`, so it never ships; the compiler produces the small runtime file. Command and bbox finalised at the start of Stage 4.

**Verification**
- Visual: the three review images and live views, judged against §5 by you; a cold viewer for the "reads as Lisbon" test.
- Playwright functional tests each stage (loads, no console errors, assets load, fixed-camera screenshots). Functional only, never frame-rate evidence.
- Asset checks: glTF validation, texture sizes and formats, per-view draw calls and triangles, total download size from the build.
- Benchmark mode (`?bench=60`) on your M4 for real numbers, recorded in `progress.md`.

---

## 8. Decisions

### Answered by kAI, 2026-10-20 (engine and repo)

1. **Engine:** browser-first for this milestone with TypeScript 7.0.2, Vite 8.3.4 and three 0.186.1, exact versions pinned with a committed lockfile, rechecked before installing. `WebGPURenderer` stays behind the cross-browser spike; the WebGL 2 route is first-class. No Godot for this milestone.
2. **Spike and benchmark:** approved. Target device is kAI's **MacBook Air M4** (not M1). kAI runs the benchmark in Chrome, Safari and Firefox; results record browser/OS versions and the actual resolution.
3. **Archive:** layout in §2 approved, including untracking `node_modules/` and `dist/`. The old browser prototype stays runnable from `archive/web-v0`, Git history is preserved and never rewritten, and the exposed key is removed from the five files. kAI rotates the key.
4. **OSM data:** the one-command local extraction at Stage 3; the environment's network settings stay as they are. Record extraction date, query, source and ODbL attribution; keep the raw extract out of the downloaded game assets and ship only the smallest compiled district data. No fetching in Stage 1.

Earlier product decisions: area Chiado → Bica → Cais do Sodré; Nata Run delivery with free roam; working title Lisbon3D.

### Visual brief correction (kAI, 2026-10-20)

The Stage 1 scene is a renderer benchmark, not the art direction. Next is a visual direction and asset-pipeline proof, not a greybox. OSM is geography only; the look comes from an authored, illustrated Lisbon kit. The download cap may be revised for the intended quality. PR #1 is not merged to production, and no implementation stage starts until this revised plan and the visual direction are approved.

### Needed from kAI before Stage 2a

1. **Approve the visual-first sequence** in §7 and the proof scene in §5 (top of Bica at Calçada do Combro / Rua do Loreto, looking down to the river).
2. **Approve installing Blender 5.2.2** (`bpy` from PyPI, ~400 MB) in the build environment, and, at Stage 2b, glTF tooling (`@gltf-transform/cli`, meshoptimizer) and KTX-Software for texture compression. Versions rechecked before installing.
3. **AI-generated imagery:** not at all · concept/style frames only · also painterly texture layers (logged in the asset ledger).
4. **Revised download budget** in §6 (≤ 25 MB to playable, ≤ 60 MB streamed, re-set after the proof): acceptable as a working estimate?
5. **Human artist fallback:** if the proof doesn't reach your bar, are you open to commissioning a 3D environment artist/illustrator for the kit and hero assets?
