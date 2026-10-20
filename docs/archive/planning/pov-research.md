# Lisbon 3D POV Mode — Research & Fixes Needed

## Current Issues (From Screenshot)

1. **Movement Not Working** — Keys detected but camera stuck
2. **View Too Close/Towering** — Buildings look massive, disorienting
3. **No Road Data** — Can't snap to streets

---

## 🔧 Fix 1: Better Camera Movement

**Problem:** `map.setCenter()` doesn't work well at high zoom/pitch in 3D mode.

**Solution:** Use `map.easeTo()` or `map.flyTo()` with camera options:

```javascript
// Instead of setCenter (which resets pitch/zoom):
map.easeTo({
  center: [lng, lat],
  zoom: map.getZoom(),
  pitch: map.getPitch(),
  bearing: map.getBearing(),
  duration: 0  // Instant for smooth walking
});
```

Or use **camera position directly**:
```javascript
const camera = map.getFreeCameraOptions();
camera.position = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altitude);
map.setFreeCameraOptions(camera);
```

---

## 🛣️ Fix 2: Road Data from OSM

**Source:** OpenStreetMap highways (roads, streets, paths)

**How to get Lisbon roads:**

### Option A: Overpass API (Real-time)
```
https://overpass-api.de/api/interpreter?data=[out:json];way["highway"~"primary|secondary|tertiary|residential"](38.7,-9.2,38.75,-9.1);out geom;
```

### Option B: Geofabrik Extract
Download Portugal roads from: `https://download.geofabrik.de/europe/portugal.html`

### Option C: MapTiler Streets Layer (Already available!)
MapTiler v3 tiles include road data:
```javascript
map.addSource('roads', {
  type: 'vector',
  url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`
});

map.addLayer({
  id: 'roads',
  type: 'line',
  source: 'roads',
  'source-layer': 'road',
  paint: {
    'line-color': '#ffffff',
    'line-width': 2
  }
});
```

---

## 📐 Fix 3: Proper Street View Camera

**Reference:** Google Street View uses:
- **Height:** 1.6-2m above ground
- **Zoom:** ~17 (not 19)
- **Pitch:** 0° (looking forward, not down)
- **Smooth movement:** Interpolated along road paths

**Implementation:**
```javascript
// Better POV settings
const POV_CONFIG = {
  zoom: 17,           // Balanced detail
  pitch: 0,           // Look forward, not down
  altitude: 1.7,      // Eye level in meters
  speed: 10,          // Meters per second
  snapToRoads: true   // Use OSM road network
};
```

---

## 🗺️ Road Snapping Algorithm

```javascript
// Pseudo-code for snapping to nearest road
function snapToRoad(position) {
  // 1. Query OSM road data within 50m
  // 2. Find nearest road segment
  // 3. Project position onto that line
  // 4. Return snapped position + heading
}

// During movement:
const target = calculateMovement();
const snapped = snapToRoad(target);
map.easeTo({
  center: snapped.position,
  bearing: snapped.heading,  // Follow road direction
  duration: 100
});
```

---

## 🎨 Fix 4: Better Visuals

**Add road markings:**
- White/yellow center lines
- Building footprints at 25% opacity
- Street labels (always visible)
- Trees/lamp posts (from OSM data)

**Lighting:**
- Ambient light (soft shadows)
- Directional light (sun position)
- Fog for depth (fade distant buildings)

---

## 📦 Tools for Richer Environment

| Tool | Purpose |
|------|---------|
| **OSM2World** | Convert OSM → detailed 3D (trees, benches, etc.) |
| **Mapbox Streets v8** | Built-in 3D buildings + roads |
| **CesiumJS** | Better for true 3D street view |
| **deck.gl** | Advanced 3D layers on MapLibre |

---

## 🚀 Quick Wins

1. **Change POV to zoom 17, pitch 0°** — Looking forward like a car
2. **Use easeTo for movement** — Smoother than setCenter
3. **Add road layer from MapTiler** — Already have the data
4. **Hide buildings below certain zoom** — Reduce clutter

---

## Code Example: Smooth POV Movement

```javascript
function walkPOV(direction) {
  const bearing = map.getBearing();
  const rad = (bearing * Math.PI) / 180;
  
  // Current position
  const center = map.getCenter();
  
  // Calculate new position (move 5 meters)
  const speed = 0.00005; // ~5 meters at zoom 17
  const newLng = center.lng + Math.sin(rad) * speed * direction;
  const newLat = center.lat + Math.cos(rad) * speed * direction;
  
  // Smooth move (preserves pitch/zoom)
  map.easeTo({
    center: [newLng, newLat],
    duration: 50,  // 50ms = smooth 20fps
    easing: (t) => t  // Linear = constant speed
  });
}

// WASD calls
if (keys.w) walkPOV(1);   // Forward
if (keys.s) walkPOV(-1);  // Backward
```

---

## Next Steps

1. Fix movement with `easeTo`
2. Change to zoom 17, pitch 0°
3. Add road layer from existing MapTiler data
4. Hide buildings at street level (or make transparent)
5. Later: Add OSM road snapping

---

*Research compiled for Lisbon 3D POV fixes*
