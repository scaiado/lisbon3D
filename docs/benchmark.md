# Benchmark page

Stage 1 component. Measures frame times on real hardware. Headless or software-GPU runs never count.

## Running it on the MacBook Air M4

1. Plug the laptop in, close other heavy apps, and use a normal browser window (not full screen),
   ideally the same size for every run.
2. Open the preview URL (or `npm run build && npm run preview` locally, then http://localhost:4173).
3. In the panel, choose a renderer and click **Run 60 s benchmark**. Don't touch the window during
   the 3 s warm-up and 60 s run.
4. Fill in browser + version, macOS version and power state, then **Copy JSON** (or Download) and
   paste it into the project thread.

Run each renderer in each browser:

| Browser | `webgpu` | `webgpu-gl2` | `webgl` |
| --- | --- | --- | --- |
| Chrome | ✔ | ✔ | ✔ |
| Safari | ✔ | ✔ | ✔ |
| Firefox (WebGPU is off by default, so `webgpu` falls back to WebGL 2) | ✔ | ✔ | ✔ |

Direct links: `?renderer=webgpu&bench=60`, `?renderer=webgpu-gl2&bench=60`, `?renderer=webgl&bench=60`.

## What a result contains

- `route`, `backend` (what actually ran), `gpu` (adapter or WebGL renderer string), `options`
  (effects, pixel-ratio cap, density, and `fallbackReason` if WebGPU failed and the page reloaded).
- `summary`: frames, seconds, average fps, 1 % low fps (average of the slowest 1 % of frames),
  median / p95 / p99 / worst frame time, frames over 50 ms, average and max draw calls and triangles.
- `environment`: user agent and (Chromium only) high-entropy hints with the browser's full version and
  platform version, screen size, CSS viewport, device pixel ratio, render pixel ratio, drawing-buffer
  size in pixels (the real resolution rendered), CPU threads, and bytes transferred by the page load.
- `tester`: device, browser + version, macOS version, power, notes — typed by you, because Safari and
  Firefox hide most of these.

## Caveats

- Frame rate is capped by the display refresh rate (60 Hz on the MacBook Air), so 60 fps means
  "at least 60". p95/p99 frame times show the headroom better.
- `transfer.totalKB` is 0 for cached files; use a hard reload for a cold-load number.
- Draw-call and triangle counts are per route and not directly comparable (see `docs/renderer-spike.md`).
