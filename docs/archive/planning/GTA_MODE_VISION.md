# Lisbon3D: GTA Mode Vision Spec

**Date:** March 26, 2026  
**Status:** Architecture phase — agent working on design  
**Agent:** lisbon3d-gta-architect (subagent spawned)

---

## The Vision

Transform Lisbon3D's desktop drive mode from "trash" to **GTA Lisbon** — an indie open-world driving experience through the real streets of Lisbon.

### Core Experience

**Drive Mode Activation:**
- User switches to "Drive Mode"
- Camera switches to third-person/first-person POV
- Player controls a vehicle
- Lisbon becomes a drivable open world

**Visual Style:**
- Remove Mapbox base map (no more tile layers)
- Render ground as game terrain (asphalt, sidewalks, grass, water)
- 3D buildings from OSM data (existing)
- Procedural road surfaces from OSM road data
- Clean, readable, game-like aesthetic

**Driving Mechanics:**
- Physics-based vehicle (weight, momentum, drift)
- On-road vs off-road handling differences
- Speed variation (road type affects max speed)
- Collision detection with:
  - Buildings (solid, non-passable)
  - Walls / fences
  - Water (don't drive into the Tagus!)
  - Terrain elevation (hills, valleys)

**Off-Road Freedom:**
- Can leave roads (parks, plazas, dirt paths)
- Constrained by real-world obstacles
- Different physics on grass vs asphalt

---

## Technical Architecture

### Reference: Hello Terrain
- **URL:** https://hello-terrain.kenny.wtf
- Realtime web terrain engine
- Three.js + React Three Fiber
- Vast virtual worlds at 60fps

### Proposed Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Terrain Engine** | Three.js custom or hello-terrain fork | Ground rendering |
| **Physics** | cannon-es | Vehicle physics, collisions |
| **Vehicle** | Custom raycast vehicle | Driving mechanics |
| **Road Mesh** | OSM data → procedural mesh | Drivable surfaces |
| **Buildings** | Existing OSM extrusion | Collision meshes + visuals |
| **Ground Textures** | Procedural shader or texture splat | Asphalt, grass, sidewalk |
| **Water** | Existing water layer | Collision detection |

### Implementation Phases

**Phase 1: Ground Zero**
- Remove Mapbox tiles in drive mode
- Render flat ground plane
- Simple vehicle controller (WASD)
- Basic camera follow

**Phase 2: Road Network**
- Parse OSM road data
- Generate road surface meshes
- Procedural texturing (asphalt lanes, sidewalks)
- Road width from OSM tags

**Phase 3: Physics World**
- Integrate cannon-es
- Building collision meshes
- Terrain elevation from DEM
- Vehicle physics tuning

**Phase 4: Visual Polish**
- Ground texture variety
- Road markings
- Vehicle model
- Post-processing (bloom, motion blur)

**Phase 5: Game Feel**
- Speed UI
- Mini-map
- Off-road penalty/bonus
- Discovery features

---

## Open Questions

1. **Performance:** Can we render all of Lisbon with physics at 60fps?
2. **DEM Data:** Do we have elevation data for terrain?
3. **Building LOD:** How to handle 100k+ buildings?
4. **Road Network:** Complex intersections and roundabouts?
5. **Mobile:** Does this work on mobile or desktop-only?

---

## Reference: GTA Mechanics

**What makes GTA driving feel good:**
- Weighty vehicles (not floaty)
- Camera lag (follows with delay)
- Particle effects (tire smoke)
- Audio (engine revs, tire screech)
- Handbrake turns
- Damage/deformation (maybe too complex)
- Pedestrians (way too complex)

**MVP for Lisbon3D:**
- Smooth, weighty driving
- Good camera
- Collision feedback
- Simple but satisfying

---

## Inspiration

- **Hello Terrain:** Technical foundation
- **GTA V:** Game feel target
- **Euro Truck Simulator:** Real-world driving on real roads
- **Lisbon:** The city itself — hills, narrow streets, waterfront

---

## Visual References

### Hello Terrain
**URL:** https://hello-terrain.kenny.wtf  
Realtime web terrain engine for technical foundation.

### Cyberpunk Blue Aesthetic (Movie Reference)
**Source:** User provided screenshots — GPS/tracking visualization  
**Key Elements:**
- Dark blue ground/base (not satellite imagery)
- Blue 3D building extrusions (low poly, stylized)
- White road network (clear lane markings)
- Red target markers (highlighted buildings/POIs)
- Speed indicator UI (corner display: "44mph")
- Mission text overlays (Portuguese subtitles)
- Tracking info panel (truck ID, coordinates)
- Clean, minimalist, tech/cyberpunk vibe

**Implementation Notes:**
- Buildings: Solid blue color (not realistic textures)
- Roads: White lines on dark surface
- UI: Floating text overlays for speed/missions
- Night mode aesthetic (dark base, glowing elements)

---

## Success Criteria

- [ ] Can drive from Belém to Parque das Nações
- [ ] Buildings block path (can't drive through)
- [ ] Water = death (splash, reset)
- [ ] 60fps on desktop
- [ ] Fun for 5+ minutes without bugs

---

**Next Step:** Agent to return with architecture plan.
