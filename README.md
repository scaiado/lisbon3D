# Lisbon3D

**A tiny courier in a sunlit miniature Lisbon.** A browser driving game in development: a small,
expressive microcar, steep streets, tiled façades, trams and the river. The first playable slice is
Chiado → Bica → Cais do Sodré, with a pastry-delivery run ("Nata Run") and free exploration.

> **Status:** restart in progress. Stage 1 is a renderer spike: a look-test street and a benchmark
> page, not the game yet. The plan is in [`plan.md`](plan.md); progress in [`progress.md`](progress.md).

## Run locally

Node.js 24 LTS (or ≥ 22.12) and npm:

```bash
npm ci
npm run dev          # http://localhost:5173
```

| Check | Command |
| --- | --- |
| Type check | `npm run typecheck` |
| Production build | `npm run build` then `npm run preview` |
| Functional tests | `npx playwright install chromium` once, then `npm test` |

The look test runs three renderer routes (`?renderer=webgpu`, `webgpu-gl2`, `webgl`). To measure
performance on real hardware, see [`docs/benchmark.md`](docs/benchmark.md).

## Repository

- `src/`: the new browser app (TypeScript, Vite 8, three.js r186).
- `docs/`: one short document per component.
- `archive/`: earlier prototypes, kept with full Git history. The old MapLibre + Three.js drive demo
  still runs from `archive/web-v0` (see [`archive/README.md`](archive/README.md)).

## Data and attribution

Street data for the playable district will come from © OpenStreetMap contributors (ODbL), extracted
once and credited in the game. The game makes no runtime calls to map or Overpass services.

---

A [Tiny Little Lab](https://www.tinylittlelab.com/) experiment by Sérgio Caiado.
