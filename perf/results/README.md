# M4 frame-rate results (proof pass 2, 2026-10-21)

Bundle `perf/dist` at 6ceac97 (bica.glb 19.45 MB, microcar.glb 0.14 MB), served with `python3 -m http.server`,
`proof.html?report=1` (3 s warm-up, 10 s per view). The numbers come from the server log of `GET ./__perf`.

**Machine:** Apple M4, 10 cores, 24 GB; macOS 26.6.2 (25G83); on AC power (battery at 80%).

**Display:** the built-in Liquid Retina, 1710×1112 points at 2× and 60 Hz. An external Samsung U32R59x at 30 Hz was
also attached.

**Browser:** Google Chrome 155.0.8059.85, in a separate temporary profile with extensions disabled, full screen
on the built-in display. WebGL 2 through ANGLE Metal (Apple M4).

**Background load:** macOS photo analysis (`mediaanalysisd`) was using ~1.4 CPU cores throughout and couldn't be
stopped.

Triangles and draws are per frame across all passes (main, shadow, AO). The scene itself is 1.08 M triangles.

## Chrome, default pixel-ratio cap 1.5 (drawing buffer 2565 × 1668)

| View | Avg fps | 1% low | p95 ms | Draws | Triangles |
|---|---|---|---|---|---|
| chase | 59.7 | 38.5 | 18.4 | 285 | 4.36 M |
| carside | 52.1 | 29.0 | 33.4 | 241 | 4.31 M |
| facade | 54.4 | 29.0 | 33.2 | 255 | 4.34 M |
| establish | 55.3 | 29.5 | 33.2 | 247 | 4.33 M |

## Chrome, `&dpr=2`: full Retina (drawing buffer 3420 × 2224)

| View | Avg fps | 1% low | p95 ms | Draws | Triangles |
|---|---|---|---|---|---|
| chase | 26.6 | 19.3 | 51.0 | 285 | 4.36 M |
| carside | 20.6 | 11.9 | 66.7 | 241 | 4.31 M |
| facade | 25.2 | 19.4 | 50.9 | 255 | 4.34 M |
| establish | 29.7 | 19.7 | 49.5 | 247 | 4.33 M |

## Reading

- At the default 1.5 cap, the chase view holds 60 fps. The other views average 52–55 fps, but they drop frames to
  ~30 fps (p95 ≈ 33 ms means vsync is missing one frame in twenty).
- Going from 1.5× to 2× pixels (1.78× the pixels) more than halves the frame rate, while draws and triangles stay
  the same. So the cost is per pixel (fill rate and the full-screen passes: AO, bloom, shadows, antialiasing), not
  geometry or draw calls. The first things to optimise are resolution scaling and the cost of the post-processing
  passes, not the art.

## Not measured

- **Safari 26.6.2:** it loaded the page and both models but never reported. Its window opened on the 30 Hz external
  display and couldn't be moved or made full screen: macOS automation access for this session is waiting on an
  on-screen permission prompt. The likely causes are a throttled background window or a WebKit-only script error.
  It needs a run by someone at the Mac: open the URL in Safari, make it full screen on the built-in display, and wait
  about 60 s.
- **Firefox:** not installed.
- `m4-chrome-dpr1.5-external30hz-invalid.json` is a discarded first Chrome run. It went full screen on the 30 Hz
  external monitor, so every view is capped at 30 fps. It's kept only for the record.
