# Checks and tests

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | Strict TypeScript 7 type check (`tsc --noEmit`). Vite only strips types. |
| `npm run build` | Production build with Vite 8. |
| `npm test` | Playwright functional tests (builds and serves the app on port 4173). |
| `npm run check` | All three, in order. |

## Playwright

`tests/spike.spec.ts` loads each renderer route, waits for rendered frames, checks which backend ran,
fails on console errors, saves a canvas screenshot, and runs a 2 s benchmark to check results are
produced. These are **functional checks only**: headless browsers use a software GPU, so their frame
rates mean nothing.

First run on a new machine: `npx playwright install chromium`. On a machine that already has a
Chromium (like the cloud build sandbox), point to it instead:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test
```

Only Chromium runs in CI-style checks for now; Safari and Firefox are covered by the manual
benchmark runs on real hardware (`docs/benchmark.md`).
