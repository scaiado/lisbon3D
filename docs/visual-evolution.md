# Lisbon 3D — Visual Evolution Log

Track every version with screenshots to see the build progress.

---

## v0.0 — Skeleton (March 24, 2026) ✅ CURRENT

**Screenshot:** `assets/snapshots/v0.0-skeleton.jpg`

**What's visible:**
- ✅ MapLibre GL JS 3D viewer with 60° pitch
- ✅ OSM base tiles with attribution
- ✅ 3D terrain enabled (Lisbon's hills visible)
- ✅ Real building extrusions from MapTiler data
- ✅ Height-based coloring (gray scale by building height)
- ✅ Landmark markers (São Jorge Castle, Belém Tower, Cristo Rei)
- ✅ Interactive controls (pitch, zoom, navigation)
- ✅ Terrain toggle button
- ✅ Scale bar and compass

**Key Features:**
- Full Lisbon city center visible
- Commerce Square (Praça do Comércio) marked
- Street grid clearly visible from aerial view
- Buildings extruded with actual heights
- Real-time pitch and zoom controls

**Data Sources:**
- Terrain: MapTiler Terrain RGB
- Buildings: MapTiler 3D buildings
- Base: OpenStreetMap

**Status:** FULLY FUNCTIONAL v0 — Ready for public demo

---

## v0.1 — Terrain Unlocked

**Screenshot:** `assets/snapshots/v0.1-terrain.png`

**New:**
- Real 3D terrain from MapTiler
- Lisbon's hills visible
- Proper elevation

---

## v0.2 — Building Data

**Screenshot:** `assets/snapshots/v0.2-buildings.png`

**New:**
- Actual Lisbon building footprints
- Height-based extrusions
- Color coding by building type/height

---

## v0.3 — Visual Polish

**Screenshot:** `assets/snapshots/v0.3-polish.png`

**New:**
- Lisbon-inspired color palette
- UI components from Pixel
- Layer toggles
- Loading animations

---

## v1.0 — Public Launch

**Screenshot:** `assets/snapshots/v1.0-launch.png`

**Complete:**
- Full Lisbon 3D experience
- All open data integrated
- Public on GitHub Pages
- Build-in-public thread complete

---

## How to Capture

```bash
# Manual screenshot
# Press Cmd+Shift+4, select map area
# Save to: assets/snapshots/vX.Y-description.png

# Or use browser dev tools:
# 1. Open DevTools → Console
# 2. Run: await fetch('/api/screenshot') 
# 3. Save output to snapshots folder
```

## Naming Convention

`v{major}.{minor}-{description}.png`

Examples:
- `v0.0-skeleton.png`
- `v0.1-terrain.png`
- `v0.5-first-render.png`

---

*Start capturing from v0.0 — the evolution is the story.*
