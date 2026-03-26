# Lisbon 3D: Road Physics Implementation Roadmap

**Status:** Architecture Complete → Ready for Integration  
**Priority:** High (Core Feature)  
**Estimated Time:** 2-3 weeks  

---

## Phase 1: Foundation (Days 1-3)

### ✅ DONE - Architecture
- [x] Technical architecture document
- [x] Road Constraint System design
- [x] Driving Physics engine
- [x] Collision Detection system
- [x] First-Person Camera specs

### TODO - Core Implementation
- [ ] Create `/src/` directory structure
- [ ] Port `utils.js` to project
- [ ] Port `RoadConstraintSystem.js`
- [ ] Port `DrivingPhysics.js`
- [ ] Port `CollisionSystem.js`
- [ ] Port `FirstPersonCamera.js`
- [ ] Update `main.js` with new systems

### Testing
- [ ] Car stays on roads in central Lisbon
- [ ] Speed limits work (residential vs primary)
- [ ] Off-road snapping functional

---

## Phase 2: OSM Road Data (Days 4-6)

### Road Network Import
- [ ] Export OSM road data for Lisbon center
- [ ] Parse `highway=*` tags
- [ ] Generate vector road network
- [ ] Replace fallback grid with real data

### Optimization
- [ ] Spatial indexing (quadtree or grid)
- [ ] LRU caching for road queries
- [ ] Measure query performance (< 1ms target)

### Testing
- [ ] Alfama narrow streets
- [ ] Avenida da Liberdade wide roads
- [ ] Bridge approaches

---

## Phase 3: Building Collision (Days 7-9)

### Collision Detection
- [ ] Query 3D buildings from MapTiler
- [ ] Height-based collision (car vs building)
- [ ] Overpass detection (tunnels/bridges)
- [ ] Collision response (bounce/push)

### Testing
- [ ] Drive through Chiado without clipping
- [ ] Baixa Pombalina grid navigation
- [ ] Emergency reverse when trapped

---

## Phase 4: Terrain & Physics Polish (Days 10-12)

### Terrain Integration
- [ ] Elevation queries from terrain-RGB
- [ ] Slope calculation
- [ ] Uphill/downhill physics
- [ ] Max slope enforcement

### Physics Tuning
- [ ] Acceleration feels responsive
- [ ] Braking distances realistic
- [ ] Turning at speed feels good
- [ ] Speed limits enforced smoothly

### Testing
- [ ] Parque Eduardo VII hills
- [ ] Castelo de São Jorge approach
- [ ] Smooth driving on flat

---

## Phase 5: Camera & UX (Days 13-15)

### First-Person Camera
- [ ] Driver eye position
- [ ] Smooth follow with delay
- [ ] Dynamic FOV based on speed
- [ ] G-force tilt effects
- [ ] Road vibration

### UI/UX
- [ ] Speedometer styling
- [ ] Road type indicator
- [ ] Off-road warnings
- [ ] Debug panel (F3)

### Testing
- [ ] Camera feels immersive
- [ ] No motion sickness
- [ ] Smooth transitions

---

## Phase 6: Integration & Polish (Days 16-18)

### Integration
- [ ] All systems working together
- [ ] Performance budget met (< 6ms/frame)
- [ ] Memory leaks checked
- [ ] Mobile performance

### Polish
- [ ] Car visual polish
- [ ] Particle effects (dust off-road)
- [ ] Sound design (engine, brakes)
- [ ] Checkpoint system integration

### Testing
- [ ] Full Lisbon drive test
- [ ] Edge cases (river, tunnels)
- [ ] Stress test (high speed)

---

## Deliverables Checklist

| Deliverable | Status | Location |
|-------------|--------|----------|
| Architecture Doc | ✅ Complete | `ROAD_PHYSICS_ARCHITECTURE.md` |
| Road Constraint System | ✅ Complete | `src/RoadConstraintSystem.js` |
| Driving Physics | ✅ Complete | `src/DrivingPhysics.js` |
| Collision System | ✅ Complete | `src/CollisionSystem.js` |
| First-Person Camera | ✅ Complete | `src/FirstPersonCamera.js` |
| Utility Functions | ✅ Complete | `src/utils.js` |
| Integration | ✅ Complete | `main.js` (updated) |
| OSM Road Data | ⏳ Pending | Needs export |
| Performance Tests | ⏳ Pending | Chrome DevTools |
| User Testing | ⏳ Pending | Team feedback |

---

## Quick Commands

```bash
# Start dev server
cd /Users/caiado/.openclaw/workspace/projects/lisbon3D
npx serve . -p 5173

# Or with Python
python3 -m http.server 5173

# Open in browser
open http://localhost:5173
```

## Debug Keys

| Key | Function |
|-----|----------|
| W/S | Accelerate/Brake |
| A/D | Steer |
| P | Toggle Drive Mode |
| R | Reset to center |
| F3 | Toggle Debug Panel |

---

## Performance Budgets

| System | Target | Max |
|--------|--------|-----|
| Physics | 0.1ms | 0.5ms |
| Road Constraint | 1ms | 5ms |
| Collision | 2ms | 10ms |
| Camera | 0.5ms | 1ms |
| **Total** | **3.6ms** | **16ms** |

---

*End of Roadmap*
