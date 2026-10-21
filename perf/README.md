# Proof frame-rate measurement

`perf/dist/` is a prebuilt static copy of the visual proof (`npm run build:perf`), so it can be measured on the
target Mac without installing anything. `perf/dist/assets/proof` is a symlink to `public/assets/proof`, so the
bundle always serves the committed compressed assets.

```sh
cd perf/dist
python3 -m http.server 8080
```

Open `http://localhost:8080/proof.html?report=1` in the browser and leave the tab in front, full-screen, without
touching it. Each of the four views is held for a 3 s warm-up and then recorded for 10 s. When the run ends, a
panel shows the results, with a Copy JSON button for the full report. Each view is also requested as
`GET /__perf?view=…&fps=…&low1=…&p95ms=…&draws=…&tris=…&gpu=…`, so the numbers appear in the server log even if
nobody copies the panel. Those requests get a 404, which is expected.

Options: `&seconds=20` and `&warmup=5` change the timings; `&dpr=2` raises the render pixel-ratio cap (default 1.5).

Rebuild after any change in `src/` with `npm run build:perf`, and commit the result.
