# Lisbon3D GTA-Style Drive Mode — Implementation Architecture

**Date:** 2026-03-26  
**Status:** Architecture Complete → Ready for Prototype  
**Goal:** Transform Lisbon3D's drive mode into a GTA-style urban driving experience

---

## Executive Summary

Based on analysis of:
- Current Lisbon3D codebase (main-simple.js, drive-mode-ui.js)
- Existing architecture docs (ARCHITECTURE-LISBON-GTA.md, ROAD_PHYSICS_ARCHITECTURE.md)
- Source modules (DrivingPhysics, RoadConstraintSystem, CollisionSystem, etc.)
- Hello Terrain reference (https://hello-terrain.kenny.wtf)

**Recommended Approach:** Hybrid Architecture V2 — MapLibre Aerial + Three.js Drive Mode with Physics

---

## Current State Analysis

### What Works (main-simple.js)
- ✅ MapLibre GL JS base map with OSM tiles
- ✅ 3D buildings from MapTiler
- ✅ Basic drive mode toggle with WASD controls
- ✅ Simple car physics (speed, acceleration, turning)
- ✅ First-person camera with vibration effects
- ✅ Speedometer HUD UI
- ✅ Drive mode UI controller (drive-mode-ui.js)

### What Doesn't Work
- ❌ MapLibre camera constraints limit "driver's eye" view
- ❌ Building scale feels wrong (Godzilla effect)
- ❌ No collision detection with buildings
- ❌ No road constraints — can drive anywhere
- ❌ No water/terrain collision
- ❌ No off-road vs on-road physics difference
- ❌ No proper vehicle physics (suspension, drifting, etc.)

---

## Proposed Architecture: Hybrid V2

```
┌─────────────────────────────────────────────────────────────────┐
│  AERIAL MODE (MapLibre GL JS)                                   │
│  ─────────────────────────────                                  │
│  • Full interactive map view                                    │
│  • Pan/zoom/rotate with standard controls                       │
│  • 3D buildings + terrain from MapTiler                         │
│  • OSM base tiles visible                                       │
│  • "Enter GTA Mode" button                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Click "Enter GTA Mode"
┌─────────────────────────────────────────────────────────────────┐
│  GTA DRIVE MODE (Three.js + Cannon-es Physics)                  │
│  ─────────────────────────────────────────────                  │
│  • Real 3D game engine with physics simulation                  │
│  • True first-person camera (1.6m eye level)                    │
│  • Cannon-es RaycastVehicle with suspension                     │
│  • OSM road data → Drivable surface mesh                        │
│  • Building footprints → Collision meshes                       │
│  • Procedural ground texturing (asphalt/sidewalk/grass)         │
│  • Water collision (Tagus River boundaries)                     │
│  • Off-road physics vs on-road physics                          │
│  • No map tiles — pure immersive 3D world                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Systems Architecture

### 1. Mode Switching System

```javascript
class ModeManager {
  modes = {
    AERIAL: 'aerial',    // MapLibre view
    TRANSITION: 'transition', // Animation between modes
    DRIVE: 'drive'       // Three.js + Physics
  }
  
  async enterDriveMode() {
    // 1. Capture current map position
    // 2. Fade out MapLibre UI
    // 3. Initialize Three.js scene at same location
    // 4. Spawn vehicle
    // 5. Fade in drive HUD
    // 6. Enable physics loop
  }
}
```

### 2. Three.js Scene Setup

```javascript
class DriveScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    
    // Hello Terrain-inspired terrain
    this.terrain = new TerrainSystem();
    
    // Physics world
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    
    // Vehicle
    this.vehicle = new VehiclePhysics(this.world);
    
    // Environment
    this.buildings = new BuildingRenderer(this.scene);
    this.roads = new RoadMeshBuilder(this.scene);
    this.ground = new GroundTexturing(this.scene);
  }
}
```

### 3. Vehicle Physics (Cannon-es RaycastVehicle)

From `src/physics/VehiclePhysics.js` (already implemented):

```javascript
export class VehiclePhysics {
  constructor(world) {
    this.world = world;
    this.config = {
      chassisMass: 1500,      // kg
      maxSteer: 0.5,          // radians
      maxForce: 1500,         // engine force
      maxBrake: 1000,         // brake force
      suspensionStiffness: 30,
      suspensionDamping: 0.4,
      friction: 0.8           // road friction
    };
  }
  
  createVehicle(position) {
    // RaycastVehicle with 4 wheels
    // Proper suspension physics
    // Realistic weight transfer
  }
}
```

**Key Features:**
- Raycast wheels (like GTA/Racing games)
- Suspension compression/damping
- Engine force to rear wheels (RWD)
- Brake force to all wheels
- Steering with realistic ackermann

### 4. Road System

From `src/RoadConstraintSystem.js` (already implemented):

```javascript
export class RoadConstraintSystem {
  SPEED_LIMITS = {
    motorway: 120,
    primary: 80,
    secondary: 60,
    residential: 40,
    offroad: 20
  }
  
  constrain(proposedPos, speed, dt) {
    // 1. Check if on road using rasterized mask
    // 2. If off-road, spiral search for nearest road
    // 3. Apply "rubber band" snap with smoothing
    // 4. Return speed limit based on road type
  }
}
```

**Implementation Strategy:**
- Pre-generate road mask tiles from OSM data
- O(1) pixel lookup for road detection
- Spiral search algorithm for snap-to-road
- Different friction/speed limits per road type

### 5. Building Collision System

From `src/CollisionSystem.js` (already implemented):

```javascript
export class CollisionSystem {
  checkCollision(pos, carHeight = 1.5) {
    // Query MapLibre building features at position
    // Check height vs car height
    // Return collision response vector
  }
  
  getCollisionResponse(pos, bearing) {
    // Sample 8 directions
    // Find escape vector
    // Apply bounce force
  }
}
```

**Three.js Implementation:**
- Convert OSM building footprints to Cannon-es Box shapes
- Spatial hash for efficient collision culling
- 200m physics radius around vehicle
- LOD: Full physics near, simplified far

### 6. Building Renderer

From `src/rendering/BuildingRenderer.js` (already implemented):

```javascript
export class BuildingRenderer {
  constructor(scene, maxBuildings = 5000) {
    // InstancedMesh for performance
    this.mesh = new THREE.InstancedMesh(geometry, material, maxBuildings);
    
    // Colors by building type
    this.colors = {
      residential: 0xd4c5b5,
      commercial: 0x9db4c0,
      industrial: 0x8b7355,
      retail: 0xc9a959,
      office: 0xb8c5d6
    };
  }
}
```

**Key Features:**
- InstancedMesh for 5000+ buildings at 60fps
- Per-building color based on type
- Dynamic LOD based on camera distance
- Frustum culling

### 7. First-Person Camera

From `src/FirstPersonCamera.js` (already implemented):

```javascript
export class FirstPersonCamera {
  CONFIG = {
    DRIVER_POS: { height: 1.3, forward: 0.4 },
    FOV: { base: 70, speedBonus: 8 },
    EFFECTS: {
      accelTilt: 2.5,    // Lean back when accelerating
      brakeTilt: 3.5,    // Lean forward when braking
      turnTilt: 2,       // Lean into turns
      vibrationAmp: 0.015 // Road vibration
    }
  }
  
  update(carState, input, dt) {
    // Calculate driver eye position
    // Apply G-force effects
    // Add road vibration
    // Smooth interpolation
  }
}
```

### 8. Ground Texturing System

**New System Needed:**

```javascript
class GroundTexturing {
  constructor() {
    // Shader-based ground texturing
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        roadMask: { value: roadTexture },
        asphaltTex: { value: asphaltTexture },
        sidewalkTex: { value: sidewalkTexture },
        grassTex: { value: grassTexture }
      },
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader
    });
  }
}
```

**Texture Types:**
- Asphalt (roads, parking)
- Sidewalk (pedestrian areas)
- Cobblestone (historic areas like Alfama)
- Grass (parks, off-road)
- Water (Tagus River boundaries)

### 9. Water Collision

```javascript
class WaterSystem {
  LISBON_WATER_BOUNDS = [
    // Tagus River polygon
    [[-9.3, 38.6], [-9.0, 38.6], [-9.0, 38.7], [-9.3, 38.7]]
  ]
  
  checkWaterCollision(pos) {
    // Point-in-polygon test
    // Return true if car would be in water
  }
  
  handleWaterCollision(vehicle) {
    // Stop vehicle
    // Reset to last valid position
    // Show "Splash!" message
  }
}
```

---

## Data Pipeline

### OSM Data Flow

```
OpenStreetMap (Overpass API)
    ↓
Fetch buildings in viewport bbox
    ↓
Parse GeoJSON footprints + heights
    ↓
┌─────────────────┬─────────────────┐
↓                 ↓                 ↓
Three.js          Cannon-es         Road Mesh
InstancedMesh     Static Bodies     Drivable Surface
(Buildings)       (Collision)       (Roads)
```

### Required OSM Tags

```javascript
const OSM_TAGS = {
  // Buildings
  BUILDING: ['building', 'building:levels', 'height'],
  
  // Roads
  HIGHWAY: [
    'motorway',    // 120 km/h
    'trunk',       // 90 km/h
    'primary',     // 80 km/h
    'secondary',   // 60 km/h
    'tertiary',    // 50 km/h
    'residential', // 40 km/h
    'living_street', // 20 km/h
    'pedestrian'   // 10 km/h
  ],
  
  // Road attributes
  ONEWAY: 'oneway',
  LANES: 'lanes',
  SURFACE: ['asphalt', 'cobblestone', 'concrete']
}
```

---

## Coordinate System

```javascript
// Two coordinate spaces must be synced

// MapLibre Space (lng/lat/alt)
// Origin: world center (Mercator projection)

// Three.js Space (meters)
// Origin: fixed anchor point (Lisbon center)
// Axes: X = east, Y = up, Z = south

function lngLatToWorld(lng, lat, alt = 0) {
  const mercator = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], alt);
  const scale = mercator.meterInMercatorCoordinateUnits();
  
  return new THREE.Vector3(
    (mercator.x - origin.x) / scale,
    alt,
    (mercator.y - origin.y) / scale
  );
}
```

---

## Performance Budgets

| System | Target | Max | Strategy |
|--------|--------|-----|----------|
| Physics Step | < 2ms | 5ms | 30fps fixed, interpolate |
| Building Render | < 3ms | 8ms | InstancedMesh, LOD |
| Road Render | < 2ms | 5ms | Simplified mesh, shader |
| Terrain | < 4ms | 10ms | Hello Terrain style LOD |
| Total Frame | < 16ms | 33ms | 60fps target |

### LOD Strategy

| Distance | Buildings | Physics | Detail |
|----------|-----------|---------|--------|
| 0-100m | Full geometry | Active | High |
| 100-300m | Simplified mesh | None | Medium |
| 300m+ | Impostor/culled | None | Low |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up Three.js scene with proper lighting
- [ ] Integrate Cannon-es physics world
- [ ] Create vehicle physics with RaycastVehicle
- [ ] Basic WASD controls
- [ ] Simple ground plane

**Success Criteria:** Can drive a box around a flat world

### Phase 2: Terrain & Camera (Week 2)
- [ ] Integrate Hello Terrain-style terrain system
- [ ] Load Lisbon heightmap (DGT LiDAR)
- [ ] Implement first-person camera with G-force effects
- [ ] Camera follow vehicle with smooth interpolation

**Success Criteria:** Driving on bumpy terrain with proper camera feel

### Phase 3: Buildings (Week 3)
- [ ] Fetch OSM building data via Overpass API
- [ ] Create InstancedMesh building renderer
- [ ] Generate Cannon-es collision boxes
- [ ] Implement building collision response

**Success Criteria:** Can't drive through buildings, proper collision bounce

### Phase 4: Roads (Week 4)
- [ ] Generate road mesh from OSM data
- [ ] Create road mask system
- [ ] Implement road constraint physics
- [ ] Different speed limits per road type
- [ ] Visual road texturing (asphalt markings)

**Success Criteria:** Car stays on roads, different speeds per road type

### Phase 5: Integration (Week 5)
- [ ] Mode switching (Aerial ↔ Drive)
- [ ] Smooth transition animation
- [ ] Sync position between modes
- [ ] Water collision (Tagus boundaries)
- [ ] World boundary constraints

**Success Criteria:** Seamless mode switching, can't drive into river

### Phase 6: Polish (Week 6)
- [ ] Ground texturing (sidewalks, grass, cobblestone)
- [ ] Shadow rendering
- [ ] Particle effects (dust, exhaust)
- [ ] Sound effects (engine, collision)
- [ ] Mobile touch controls

**Success Criteria:** Feels like a mini GTA Lisbon

---

## File Structure

```
lisbon3D/
├── index.html                    # Entry point
├── src/
│   ├── main.js                   # Aerial mode (MapLibre)
│   ├── gta-mode/
│   │   ├── index.js              # GTA mode entry
│   │   ├── scene.js              # Three.js scene setup
│   │   ├── vehicle.js            # Vehicle controller
│   │   ├── camera.js             # First-person camera
│   │   ├── terrain.js            # Terrain system
│   │   ├── roads.js              # Road mesh + constraints
│   │   ├── buildings.js          # Building renderer
│   │   ├── physics.js            # Physics world
│   │   ├── ground.js             # Ground texturing
│   │   └── water.js              # Water collision
│   ├── shared/
│   │   ├── constants.js          # Lisbon bounds, etc.
│   │   ├── utils.js              # Coordinate math
│   │   └── mode-manager.js       # Mode switching
│   └── ui/
│       ├── drive-hud.js          # Speedometer, etc.
│       └── controls.js           # Input handling
├── data/
│   ├── lisbon-heightmap.png      # DGT LiDAR → heightmap
│   ├── road-masks/               # Rasterized road masks
│   └── buildings/                # Cached OSM building data
└── assets/
    ├── textures/                 # Asphalt, grass, etc.
    ├── models/                   # Car model
    └── sounds/                   # Engine, effects
```

---

## Key Technical Decisions

### 1. Physics Engine: Cannon-es
**Why:** Pure JavaScript, maintained fork of Cannon.js, works with Three.js, supports RaycastVehicle

### 2. Terrain: Custom LOD (Hello Terrain-inspired)
**Why:** Need real elevation for Lisbon's hills, MapLibre terrain is for visualization not physics

### 3. Buildings: InstancedMesh + Cannon-es Boxes
**Why:** Performance for 5000+ buildings, accurate enough collision

### 4. Roads: Rasterized Masks + Mesh
**Why:** O(1) lookup for constraints, mesh for visual rendering

### 5. Coordinate Sync: Mercator conversion
**Why:** Industry standard, MapLibre/Three.js both support it

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance issues | Medium | InstancedMesh, physics LOD, 30fps physics |
| OSM data quality | Medium | Fallback roads, cache data locally |
| Browser compatibility | Low | WebGL 2.0, fallback to aerial mode |
| Scope creep | High | Phase gates, MVP first |
| Mobile performance | High | Reduced LOD, touch controls, 30fps cap |

---

## Success Metrics

- [ ] 60fps on desktop (M4 Mac Mini)
- [ ] 30fps on mobile (iPhone 14+)
- [ ] < 2s mode switch time
- [ ] Drive across Lisbon without physics glitches
- [ ] Collision feels "GTA-like" (bouncy but constrained)
- [ ] Camera feels "in the driver's seat"

---

## Next Steps

1. **Review this architecture** with stakeholders
2. **Set up Phase 1 prototype** — basic Three.js + vehicle physics
3. **Test terrain system** with sample Lisbon heightmap
4. **Iterate** based on "feel" — driving physics is art, not science

---

*Architecture by kAI (Subagent)*  
*Based on existing work by Dragon (Security/Punk Rock Hacker)*  
*Reference: https://hello-terrain.kenny.wtf*
