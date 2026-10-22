# Playable slice: Nata Run in the Bica

`play.html` (source `src/play/`) is the Stage 3 playable slice: drive the proof street of the Bica and run one
pastry delivery. It reuses the visual-proof street (`bica.glb`), lighting and look unchanged.

## How to play

- **W / ↑** accelerate, **S / ↓** brake and then reverse, **A D / ← →** steer, **Space** handbrake.
- **C** cycles the camera (chase, far chase, bumper). **R** puts the car back at the last safe spot on the road.
  **M** mutes. **Enter** restarts after a run. A gamepad works too (right trigger drive, left trigger brake, left stick steer, A handbrake).
- Pick up a box of pastéis de nata at Pastelaria Bica Doce (just inside the top of the Bica), then deliver to five
  doors down the hill. Each stop is a glowing ring with a beam and a sign; stop inside the ring (under ~5 km/h)
  for a short handover. The order card (top left) names the next door, its distance and an arrow toward it.
- The clock runs from the first move. Knocks bruise the pastries (the six natas, top right); hard hits cost more,
  hitting the funicular costs most. Tips reward quick legs and intact pastries. Results: time, pastry condition,
  tips and up to three stars (3★ ≤ 80 s and ≥ 85 %, 2★ ≤ 120 s and ≥ 55 %).
- The Bica funicular sets off down the hill when the run starts. Nothing overtakes it in a 6 m street, so if you
  catch it you ride behind it; it stops and rings its bell rather than push a car that gets in front of it.

URL options: `?clean` hides the HUD, `?dpr=` caps the pixel ratio. Resolution adapts below the cap to hold
~55–60 fps, since the proof showed the cost is per pixel.

## How it works

| Module | Role |
| --- | --- |
| `vehicle.ts` | Arcade-leaning car model at a fixed 120 Hz step: throttle/brake/reverse, speed-sensitive steering, tyre grip with handbrake slides, gravity along the slope, an EV "hold" at rest, a sprung body (pitch, roll, bumps, short hops off steps) from four wheel contacts. |
| `collision.ts` | Reads `bica_collision.bin`: a 0.2 m heightfield of drivable ground plus a signed distance to walls (int8, 2 cm units). The car is four circles against the distance field; moving obstacles (the funicular) are boxes. Hits push the car out, kill the normal speed and report impacts. |
| `camera.ts` | Critically damped chase camera with heading lag, look-ahead and speed-based FOV; keeps itself inside the street (pulls in toward the car when the distance field says it would enter a wall) and above the ground; shake on impacts. |
| `delivery.ts` | `NataRun`: phases ready → pickup → deliver → finished, handover timer, condition, tips, stars, markers. |
| `funicular.ts` | Moves the street's `funicular_*` meshes down the track as an obstacle. |
| `hud.ts`, `audio.ts`, `input.ts` | Overlay, synthesised sound (motor whine, cobble rumble, thumps, chimes, bell; no audio files), keyboard and gamepad. |
| `gameplay.ts` | Reads `bica_gameplay.json` (spawn, bakery, stops, funicular track) exported from Blender, with a built-in fallback. |

`window.__lisbonPlay` exposes the simulation (`step(input, seconds)` runs it without rendering) for tests and
captures.

## Moving parts and compression

The funicular is found by material name: every part of it uses a `funicular_*` material, and the overhead wire is a
separate static object. The optimizer marks those materials before `dedup` and `join`, which would otherwise merge
them with lookalike street materials (the tram's wheels with the rails, its brass and pole with the street's) and
leave parts behind at the authored spot or drag street geometry along with the tram.

## Assets

- `public/assets/play/player_car.glb` (0.20 MB): a plain modern EV saloon (Tesla-like silhouette, pearl white, no
  badges), made in Blender on kAI's Mac (`art/blender/`), with `wheel_*` nodes that the game spins and steers.
- `public/assets/play/bica_gameplay.json` (17 KB): door and stop positions from the Blender street build.
- `public/assets/play/bica_collision.bin` (0.6 MB): baked by `tools/bake_collision.py` from the compressed street
  model (needs numpy; run it after the street changes). Ground is what lies within -0.6..+0.4 m of the street
  surface; walls are anything from +0.4 to +2.0 m. Backdrop, mid-ground, river, funicular and animals are ignored.

Total download for the slice: about 20 MB (street 19.45 MB, car, collision, ~0.9 MB of code).

## Tests

`tests/play.spec.ts`: the car drives down the hill and is stopped by a wall; a scripted careful driver delivers all
five orders (in about 36 s, pastries 100 %). Run with `npx playwright test tests/play.spec.ts`.

## Known gaps

- Only the proof street is drivable: the top cross street ends in invisible walls and the bottom of the Bica is
  closed at the funicular's lower station. The district is the next stage, after review.
- No traffic, and the people and animals in the street don't react (animals are left out of collision).
- Some dark hanging boards in the street read as black from downhill (an art fix for the Blender kit).
- Frame rate in play is not yet measured on the M4 (the proof street measured 52–60 fps at 1.5× in Chrome).
