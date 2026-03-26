# 🚗 Lisbon 3D: Drive Mode Roadmap

> Viral 3D driving experience through Lisbon streets
> **Repo:** https://github.com/scaiado/lisbon3D | **Live:** https://lisbon.tinylittlelab.com/

---

## Vision

Transform the current aerial-view map into an immersive **first-person driving experience** through Lisbon. Players navigate real streets with 3D buildings and terrain, then share viral moments on X.

**Core Loop:**
1. Explore map in aerial view
2. Enter Drive Mode → first-person camera
3. Drive through Lisbon streets (constrained to roads)
4. Visit landmarks, hit speed milestones
5. Screenshot viral moments → share

---

## Team TTL-12 Assignments

| Agent | Role | Delivered |
|-------|------|-----------|
| **Kilo** | Camera & Core Implementation | ✅ First-person camera, dashboard UI, transitions |
| **Pixel** | Visual Design System | ✅ Neon night aesthetic, viral moments, CSS framework |
| **Dragon** | Physics & Road Constraints | ✅ Road-following, collision detection, driving physics |

---

## Phase 1: Foundation (Days 1-3) — IN PROGRESS

### 1.1 First-Person Camera ✅
- [x] Street-level camera (0° pitch, driver POV)
- [x] Smooth transitions (aerial ↔ drive mode)
- [x] Mouse look (click-drag to look around)
- [x] Speed-based FOV (75° → 110°)
- [x] Camera shake at high speeds

### 1.2 Dashboard UI ✅
- [x] Analog speedometer (SVG, glows magenta at speed)
- [x] Gear indicator (1-5)
- [x] RPM gauge
- [x] Mini-map radar
- [x] Compass
- [x] Score/distance display

### 1.3 Visual Polish ✅
- [x] Neon night color palette (cyan/magenta/amber)
- [x] Speed lines effect (CSS radial)
- [x] Vignette overlay
- [x] Car interior frame (windshield view)
- [x] Glassmorphism effects

**Files:** `main.js`, `index.html`, `css/drive-mode.css`

---

## Phase 2: Road Constraints (Days 3-6)

### 2.1 Road Network Integration
- [ ] Fetch OSM road data for Lisbon
- [ ] Rasterize road masks (O(1) lookup)
- [ ] Spiral search algorithm for nearest road
- [ ] Snap-to-road when off-road

### 2.2 Driving Physics
- [ ] Speed-based turning radius
- [ ] Acceleration curves with slope effects
- [ ] Braking distances
- [ ] Speed limits by road type:
  - Motorway: 120 km/h
  - Primary: 80 km/h
  - Residential: 50 km/h
  - Pedestrian: 10 km/h

### 2.3 Collision System
- [ ] Building collision using MapLibre 3D layer
- [ ] Height-based collision detection
- [ ] Bounce/push response
- [ ] Performance: <6ms per frame

**Files:** `src/RoadConstraintSystem.js`, `src/DrivingPhysics.js`, `src/CollisionSystem.js`

---

## Phase 3: Viral Moments (Days 6-8)

### 3.1 Checkpoint System ✅
- [x] Landmark markers (São Jorge Castle, Belém Tower, Cristo Rei)
- [x] Proximity detection (100m radius)
- [x] Score bonuses (+500 points)
- [x] Popup animation

### 3.2 Viral Moments
- [ ] **Speed Demon** — Trigger at 75+ km/h
- [ ] **Lisbon Explorer** — All 3 landmarks visited
- [ ] **Distance Milestones** — Every 1km
- [ ] Screenshot hint overlay
- [ ] Social share button

### 3.3 Game Feel
- [ ] Engine sound effects (optional)
- [ ] Tire screech on sharp turns
- [ ] Checkpoint sound
- [ ] Score tick animation

**Files:** `js/drive-mode-ui.js`, `assets/icons/`

---

## Phase 4: Data Pipeline (Days 8-12)

### 4.1 Terrain Enhancement
- [ ] Process DGT LiDAR for full Lisbon
- [ ] Higher resolution terrain tiles
- [ ] Slope data for driving physics

### 4.2 Building Data
- [ ] Integrate CML 3D building dataset
- [ ] Height attributes for all buildings
- [ ] Collision mesh generation

### 4.3 Road Data
- [ ] OSM road network for entire city
- [ ] Road type classification
- [ ] One-way streets
- [ ] Traffic direction hints

**Reference:** `research/lisbon-3d-map-guide.md`

---

## Phase 5: Mobile & Polish (Days 12-15)

### 5.1 Mobile Controls
- [ ] Touch steering (left/right halves)
- [ ] Vertical swipe for gas/brake
- [ ] HUD scaling for small screens
- [ ] Orientation lock (landscape)

### 5.2 Performance
- [ ] Tile size optimization (<500KB)
- [ ] Lazy loading out-of-view tiles
- [ ] Frame rate monitoring
- [ ] Low-end device fallback

### 5.3 UI Polish
- [ ] Loading screen
- [ ] Tutorial overlay (first drive)
- [ ] Settings panel (sensitivity, FOV)
- [ ] Dark/light mode toggle

---

## Phase 6: Launch (Days 15-18)

### 6.1 Pre-Launch
- [ ] Final bug fixes
- [ ] Performance testing
- [ ] Screenshot examples for X post
- [ ] Short demo video (screen recording)

### 6.2 Launch
- [ ] X post: "Built in public — Drive through Lisbon in 3D"
- [ ] Include: Link + screenshot + tech stack
- [ ] Reply with demo video
- [ ] Cross-post to LinkedIn (carefully)

### 6.3 Post-Launch
- [ ] Monitor feedback
- [ ] Track shares/engagement
- [ ] Hotfix critical issues
- [ ] Plan v0.2 features

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Dashboard   │  │  Speedometer │  │   Minimap    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                      MAPLIBRE GL JS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  3D Terrain  │  │  Buildings   │  │  OSM Base    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                      GAME SYSTEMS                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Camera    │  │   Physics    │  │  Road Const. │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Collision   │  │    Input     │  │  Game State  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
lisbon3D/
├── index.html              # Main HTML with dashboard UI
├── main.js                 # Core game logic + camera
├── css/
│   └── drive-mode.css      # Visual design system
├── js/
│   └── drive-mode-ui.js    # UI controller + viral moments
├── src/
│   ├── RoadConstraintSystem.js   # Keep car on roads
│   ├── DrivingPhysics.js         # Speed, turning, slopes
│   ├── CollisionSystem.js        # Building collision
│   ├── FirstPersonCamera.js      # Camera physics
│   └── utils.js                  # Math utilities
├── assets/
│   └── icons/              # SVG icon library
├── docs/
│   ├── ROAD_PHYSICS_ARCHITECTURE.md  # Dragon's spec
│   ├── DRIVE_MODE_DESIGN.md          # Pixel's design
│   ├── QUICKSTART.md                 # Integration guide
│   └── ROADMAP.md                    # This file
└── research/
    └── lisbon-3d-map-guide.md        # Data sources
```

---

## Controls

| Key | Action |
|-----|--------|
| **W / ↑** | Accelerate |
| **S / ↓** | Brake/Reverse |
| **A / ←** | Steer Left |
| **D / →** | Steer Right |
| **P** | Toggle Drive Mode |
| **Mouse Drag** | Look around (in drive mode) |
| **ESC** | Exit drive mode |
| **F3** | Debug panel |

---

## Viral Moment Triggers

| Moment | Trigger | Visual |
|--------|---------|--------|
| 🏁 Checkpoint | Within 100m of landmark | Particle burst + popup |
| 💨 Speed Demon | Speed > 75 km/h | Full-screen badge |
| 🌟 Lisbon Explorer | All 3 landmarks visited | Trophy animation |
| 🎯 Distance King | Every 1km traveled | Milestone toast |

---

## Data Sources

| Data | Source | Status |
|------|--------|--------|
| Terrain | DGT LiDAR | ✅ Integrated |
| Buildings | MapTiler / CML | ⚠️ Partial |
| Roads | OpenStreetMap | 📋 Phase 2 |
| Base Map | OSM | ✅ Active |

---

## Performance Budget

| System | Target |
|--------|--------|
| Frame rate | 60 FPS |
| Physics update | <6ms |
| Tile load | <500KB |
| Initial load | <3s |

---

## Build in Public Strategy

**X Posts:**
1. **Day 1:** "Starting something new — 3D driving through Lisbon using only open data"
2. **Day 5:** "Road constraints working — car actually follows Lisbon streets now"
3. **Day 10:** "First-person camera is 🔥 — feels like a real racing game"
4. **Day 15:** "Shipped: Drive through Lisbon in your browser"

**Hashtags:** #BuildInPublic #IndieDev #Lisbon #3DMapping #OpenData

---

## Next Actions

1. **Integrate Phase 1 code** — Merge Kilo + Pixel implementations
2. **Test locally** — `npm run dev`, verify drive mode works
3. **Connect road constraints** — Wire Dragon's physics system
4. **Deploy to Vercel** — Push to GitHub, verify live site
5. **Post first X update** — Screenshot of current state

---

*Built with ⚡ by TTL-12 | Tiny Little Lab*
