# Lisbon 3D — Hybrid Architecture Plan

## The Problem with Current Approach
MapLibre GL JS is a **map renderer**, not a game engine. Camera constraints, building scale, and "Godzilla effect" are fundamental limitations.

## The Solution: Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AERIAL MODE (MapLibre GL JS)                               │
│  ─────────────────────────────                              │
│  • Full map view                                            │
│  • Pan/zoom/rotate                                          │
│  • 3D buildings + terrain                                   │
│  • OSM base tiles                                           │
│  • "Enter Drive Mode" button                                │
└─────────────────────────────────────────────────────────────┘
                            ↓ Click "Enter Drive Mode"
┌─────────────────────────────────────────────────────────────┐
│  DRIVE MODE (Three.js + Hello Terrain)                      │
│  ─────────────────────────────────────                      │
│  • Real 3D game engine                                      │
│  • First-person camera (proper height/scale)                │
│  • Lisbon terrain from DGT LiDAR (heightmap)                │
│  • 3D buildings as meshes                                   │
│  • Car physics + controls                                   │
│  • No map tiles — pure 3D world                             │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Aerial Mode (Existing)
- **MapLibre GL JS** — map rendering
- **MapTiler** — terrain + building data
- **OSM** — base tiles

### Drive Mode (New)
- **Three.js** — 3D engine
- **@hello-terrain/three** — terrain rendering
- **React Three Fiber** — React integration (optional)
- **DGT LiDAR** — heightmap for Lisbon terrain
- **CML/OSM** — building footprints → 3D meshes

## Data Pipeline

### Terrain (DGT LiDAR → Heightmap)
```
DGT LiDAR (GeoTIFF)
    ↓
Convert to PNG heightmap
    ↓
Hello Terrain (InstancedMesh + custom shader)
    ↓
Real-time LOD terrain
```

### Buildings (OSM/CML → 3D Meshes)
```
OSM building footprints + heights
    ↓
Convert to 3D mesh instances
    ↓
Three.js InstancedMesh
    ↓
Efficient rendering (thousands of buildings)
```

## Camera Comparison

| Aspect | MapLibre | Three.js |
|--------|----------|----------|
| Height control | Limited | Full (1.6m eye level) |
| Building scale | Off (Godzilla) | 1:1 real world |
| Field of view | Constrained | Full control |
| Frame rate | ~30fps | 60fps+ |
| Physics | None | Full vehicle physics |

## Implementation Phases

### Phase 1: Basic Terrain (MVP)
- [ ] Set up Three.js scene
- [ ] Load Hello Terrain
- [ ] Create Lisbon heightmap from sample LiDAR
- [ ] Basic first-person camera
- [ ] WASD movement

### Phase 2: Buildings
- [ ] Import OSM building data
- [ ] Create InstancedMesh for buildings
- [ ] Add colors/materials
- [ ] Optimize for performance

### Phase 3: Integration
- [ ] Mode switcher (Aerial ↔ Drive)
- [ ] Smooth transition
- [ ] HUD overlay
- [ ] Car model

### Phase 4: Polish
- [ ] Lighting (day/night)
- [ ] Shadows
- [ ] Sound effects
- [ ] Viral moments

## File Structure

```
lisbon3D/
├── index.html                 # Entry point
├── src/
│   ├── main.js               # MapLibre aerial mode
│   ├── drive-mode/
│   │   ├── index.js          # Drive mode entry
│   │   ├── terrain.js        # Hello Terrain setup
│   │   ├── buildings.js      # 3D building meshes
│   │   ├── car.js            # Car physics/model
│   │   ├── camera.js         # First-person camera
│   │   └── hud.js            # HUD overlay
│   └── shared/
│       └── constants.js      # Lisbon bounds, etc.
├── data/
│   ├── lisbon-heightmap.png  # DGT LiDAR → heightmap
│   └── buildings.json        # OSM building data
└── assets/
    ├── models/               # Car model, etc.
    └── textures/             # Road textures, etc.
```

## Key Differences

### MapLibre Approach (Current)
- Camera "hovers" above terrain
- Buildings rendered as extruded polygons
- Limited camera angles
- Map tiles always visible

### Hello Terrain Approach (New)
- Camera at ground level (driver's seat)
- Buildings as true 3D meshes
- Full 6DOF camera
- Pure 3D world, no map tiles

## Expected Result

**Before (MapLibre):**
- Drone view looking down
- Tiny buildings
- Map visible
- "Godzilla driving"

**After (Three.js + Hello Terrain):**
- Street level view
- Proper 1:1 scale
- Immersive 3D world
- Racing game feel

## Next Steps

1. Install Three.js + Hello Terrain
2. Create basic scene with terrain
3. Add camera at street level
4. Test movement
5. Integrate with existing aerial mode

---

*Architecture decision: 2026-03-25*
*Rationale: MapLibre is a map renderer, not a game engine. For true first-person driving, we need a real 3D engine.*
