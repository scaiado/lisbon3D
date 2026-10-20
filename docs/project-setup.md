# Project setup

Browser-first stack chosen in `plan.md` (Stage 0, rev 2). Versions were checked against the npm
registry on 2026-10-20 and are pinned exactly; `package-lock.json` is committed. Install with `npm ci`.

| Package | Version | Role |
| --- | --- | --- |
| three | 0.186.1 | Rendering (r186) |
| vite | 8.3.4 | Dev server and build (Rolldown) |
| typescript | 7.0.2 | Type checking only (`tsc --noEmit`) |
| @types/three | 0.186.0 | three.js types |
| @types/node | 24.19.2 | Types for the Vite and Playwright config files |
| @playwright/test | 1.64.1 | Functional browser tests |

Node: 24 LTS recommended (`.nvmrc`); Vite 8 needs `^20.19.0 || >=22.12.0`.

TypeScript 7.0 has no stable compiler API yet, so tools that import `typescript` (typescript-eslint,
ts-morph) are not used. Revisit when TypeScript 7.1 is the stable release.

## Layout

```
index.html            entry page
src/main.ts           boot, render loop, benchmark flow, WebGPU fallback guard
src/core/             URL options, seeded random
src/render/           renderer routes (WebGPU / forced WebGL 2 / classic WebGL), shared look values
src/world/            look-test scene, palette, scripted camera path
src/bench/            frame statistics, environment report
src/ui/               control panel, results panel, performance overlay
tests/                Playwright functional tests
archive/              earlier prototypes (see archive/README.md)
```
