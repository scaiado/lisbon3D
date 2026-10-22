# Lisbon GTA — Architecture Document

**Hybrid Approach: MapLibre Base + Three.js Overlay**

---

## 1. Overview

The Lisbon GTA experience combines two rendering systems into a seamless hybrid:

- **MapLibre GL JS** handles the base map: tiles, terrain, roads, and geographic context
- **Three.js** overlays the 3D layer: buildings, vehicles, and visual effects
- **Drive Mode** transitions the user into a first-person immersive 3D experience

The two systems share a synchronized camera, allowing Three.js objects to appear grounded in the real-world map. Outside of drive mode, the map behaves as a standard interactive 3D map. When drive mode is activated, map labels are hidden, 3D buildings appear, and vehicle physics engage.

---

## 2. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Base map | MapLibre GL JS | Tiles, terrain, roads, labels |
| 3D rendering | Three.js | Buildings, vehicles, effects |
| Physics | Cannon-es | Vehicle dynamics, collision |
| Geodata | OpenStreetMap (Overpass API) | Building footprints, road geometry |
| Coordinate math | MapLibre projection matrix | lng/lat ↔ meters conversion |

---

## 3. Coordinate System

Two coordinate spaces are used and must be kept in sync at all times.

### MapLibre Space
- Units: longitude / latitude / altitude
- Origin: world center (Mercator projection)
- Used for: tile rendering, GPS positioning, map interactions

### Three.js Space
- Units: meters
- Axes: X = east, Y = up, Z = south
- Origin: a fixed anchor point (e.g., city center) converted from lng/lat at startup

### Conversion

```js
// lng/lat/alt → Three.js world position
function lngLatToWorld(lng, lat, alt = 0) {
  const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], alt);
  const scale = mercatorCoord.meterInMercatorCoordinateUnits();
  return new THREE.Vector3(
    (mercatorCoord.x - originMercator.x) / scale,
    alt,
    (mercatorCoord.y - originMercator.y) / scale
  );
}
```

The MapLibre projection matrix is applied to the Three.js camera each frame to keep them synchronized (see Rendering Pipeline).

---

## 4. Rendering Pipeline

### Custom MapLibre Layer

Three.js is injected as a custom `CustomLayerInterface` in MapLibre. This gives direct access to the WebGL context and render loop.

```js
const threeLayer = {
  id: 'three-js-overlay',
  type: 'custom',
  renderingMode: '3d',

  onAdd(map, gl) {
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    // ... initialize scene objects
  },

  render(gl, matrix) {
    // Sync camera matrix from MapLibre
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    map.triggerRepaint();
  }
};

map.addLayer(threeLayer);
```

### Frame Sync

Each frame the MapLibre projection matrix is fed directly into the Three.js camera. No separate animation loop is needed — MapLibre drives the render cycle, and Three.js resets WebGL state before each draw to avoid conflicts.

### Building Rendering: InstancedMesh

Buildings are rendered with `THREE.InstancedMesh` for performance. Each building footprint becomes a box instance with a per-instance transform matrix encoding position, width, depth, and height.

```js
const geometry = new THREE.BoxGeometry(1, 1, 1); // unit box, scaled per instance
const material = new THREE.MeshLambertMaterial({ color: 0xc8a882 });
const mesh = new THREE.InstancedMesh(geometry, material, MAX_BUILDINGS);

buildings.forEach((b, i) => {
  const matrix = buildingToMatrix(b); // position + scale
  mesh.setMatrixAt(i, matrix);
});
mesh.instanceMatrix.needsUpdate = true;
```

### Ground Shader

A custom fragment shader applied to ground tiles detects road vs. non-road areas using OSM road data baked into a texture. This drives visual surface type for physics (tarmac vs. pavement vs. grass).

---

## 5. Physics

Vehicle physics run on **Cannon-es**, a maintained fork of Cannon.js.

### Vehicle Model: RaycastVehicle

```
         [chassis body]
        /       |       \
[FL wheel] [FR wheel] [RL wheel] [RR wheel]
    |           |          |          |
 raycast     raycast    raycast    raycast
    ↓           ↓          ↓          ↓
  ground      ground    ground    ground
```

The `RaycastVehicle` fires downward rays from each wheel mount. The contact point and normal determine suspension compression, traction, and surface response.

### Static Collision: Buildings

Building footprints are added to the physics world as `Box` shapes attached to static `Body` instances. Only buildings within the active physics radius (~200m) are added; others are culled.

### Ground Raycast for Surface Type

Beyond wheel contact, a downward ray from the car body queries the ground to determine surface type (road / sidewalk / off-road). Surface type modulates:
- Friction coefficient
- Engine sound pitch
- Tyre smoke particle density

### Spatial Hash for Collision Culling

A spatial hash grid (cell size ~50m) indexes all physics bodies. On each step, only cells overlapping the car's AABB are checked for broadphase, keeping the collision pair count near-constant regardless of total building count.

---

## 6. Data Pipeline

### Fetch OSM Buildings

Buildings are fetched from the Overpass API when the viewport changes significantly (≥ 200m pan or zoom change).

```
[User moves map]
      ↓
[Compute viewport bbox]
      ↓
[Overpass API: buildings in bbox]
      ↓
[Parse GeoJSON footprints]
      ↓
[Build Three.js InstancedMesh]
      ↓
[Build Cannon-es static bodies]
      ↓
[Cache by tile key]
```

### Overpass Query

```
[out:json];
(
  way["building"]({{bbox}});
  relation["building"]({{bbox}});
);
out body;
>;
out skel qt;
```

### LOD Strategy

| Distance from camera | Detail level |
|---|---|
| 0–100m | Full geometry + physics body |
| 100–300m | Simplified mesh, no physics |
| 300m+ | Impostor quad or culled |

LOD updates are triggered on camera movement, not every frame, to avoid rebuild thrashing.

### Cache

Building tile data is cached in a `Map<string, BuildingTile>` keyed by OSM tile ID. Tiles are evicted when more than 2 tiles away from the current viewport. Physics bodies are also pooled and reused rather than created/destroyed.

---

## 7. Drive Mode Flow

### Enter Drive Mode

```
1. User clicks "Drive" button
2. Hide map labels layer (MapLibre layer visibility: none)
3. Hide POI / road name overlays
4. Show Three.js buildings (set visible: true on InstancedMesh)
5. Spawn car body at current map center (lngLatToWorld)
6. Enable Cannon-es world step loop
7. Lock camera to car — switch to first-person perspective
8. Show HUD (speed, gear, minimap)
9. Enable touch / keyboard input handlers
```

### Active Drive State

```
[Input] → [Apply engine/steering forces to RaycastVehicle]
                    ↓
         [Cannon-es world.step(1/60)]
                    ↓
         [Sync car mesh to physics body position]
                    ↓
         [Update camera: position = carPos + firstPersonOffset]
                    ↓
         [MapLibre.setCenter(carLngLat)]  ← keeps tiles loaded
                    ↓
         [map.triggerRepaint()]
```

### Exit Drive Mode

```
1. Disable input handlers
2. Remove car physics body
3. Re-enable map labels
4. Restore camera to bird's-eye view at car's last position
5. Hide HUD
6. Stop Cannon-es step loop
```

---

## 8. Mobile Optimization

### Building LOD (Distance-Based)

On mobile, LOD thresholds are tightened:

| Platform | Full geometry cutoff | Cull distance |
|---|---|---|
| Desktop | 300m | 600m |
| Mobile | 150m | 300m |

Device class is detected via `navigator.hardwareConcurrency` and `deviceMemory`.

### Frustum Culling

Three.js frustum culling is enabled on all objects. For `InstancedMesh`, a custom per-instance frustum check skips invisible buildings before updating the matrix buffer.

### Physics at 30 fps, Visuals at 60 fps

Physics are stepped at a fixed 30 fps regardless of display refresh rate. Visual interpolation blends between the last two physics frames to produce smooth motion at 60 fps.

```js
const PHYSICS_STEP = 1 / 30;
let accumulator = 0;

function gameLoop(dt) {
  accumulator += dt;
  while (accumulator >= PHYSICS_STEP) {
    world.step(PHYSICS_STEP);
    savePreviousState();
    accumulator -= PHYSICS_STEP;
  }
  const alpha = accumulator / PHYSICS_STEP;
  interpolateVisuals(alpha); // lerp position/rotation
}
```

### Touch Controls

```
Left joystick  → steer (left / right)
Right joystick → throttle (up) / brake (down)
Double-tap     → handbrake
Swipe up/down  → camera pitch
Pinch          → zoom (map mode only)
```

Touch inputs are handled via `Hammer.js` or raw `PointerEvent` listeners. Controls overlay uses absolute-positioned CSS elements sized in `dvh`/`dvw` for consistent mobile layout.

---

## 9. Key Interfaces

```ts
interface BuildingTile {
  tileKey: string;
  buildings: BuildingData[];
  mesh: THREE.InstancedMesh;
  bodies: CANNON.Body[];
  loaded: boolean;
}

interface BuildingData {
  id: string;
  footprint: [number, number][]; // lng/lat pairs
  height: number;               // metres
  levels?: number;
}

interface CarState {
  body: CANNON.RaycastVehicle;
  mesh: THREE.Group;
  lngLat: [number, number];
  speed: number;               // m/s
  heading: number;             // degrees
}

interface ThreeLayerContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  origin: maplibregl.MercatorCoordinate;
}
```

---

## 10. Open Questions / Future Work

- **Pedestrians**: NPC pedestrians using OSM sidewalk data + simple path agents
- **Traffic**: Procedural vehicle traffic following OSM road graph
- **Building interiors**: Portal-based room rendering for select landmark buildings
- **Weather**: Rain/fog postprocessing with physics friction modulation
- **Multiplayer**: WebSocket position sync for shared sessions
- **Procedural damage**: Cannon-es compound shapes for destructible props

---

*Last updated: 2026-03-25*
