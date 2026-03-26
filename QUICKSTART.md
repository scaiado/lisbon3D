# Quick Start Guide: Road Physics System

## What Was Delivered

**Dragon** (Security/Punk Rock Hacker) has designed and implemented a complete Road Constraint & Physics System for Lisbon 3D.

### Files Created

```
lisbon3D/
├── ROAD_PHYSICS_ARCHITECTURE.md    # Full technical spec
├── ROADMAP.md                       # Implementation plan
├── main.js                          # Updated integration
└── src/
    ├── RoadConstraintSystem.js      # Keep car on roads
    ├── DrivingPhysics.js            # Realistic car physics
    ├── CollisionSystem.js           # Building collision
    ├── FirstPersonCamera.js         # Driver's eye view
    └── utils.js                     # Shared utilities
```

---

## How It Works

### 1. Road Constraint System

**The Hack:** Instead of complex geometry, use a simplified road network with spiral search.

```javascript
// Car tries to drive somewhere
const proposedPos = [lng, lat];

// System checks if on road
const roadInfo = roadSystem.constrain(proposedPos, speed, dt);

// If off-road, smoothly snaps back
if (!roadInfo.onRoad) {
  car.position = roadInfo.position; // Snapped position
  car.speed *= 0.5; // Penalty
}
```

**Features:**
- Speed limits by road type (motorway: 120km/h, residential: 40km/h)
- Gradual "rubber band" snap when off-road
- Fallback road network for Lisbon center
- Boundary constraints (can't drive to Sintra by accident)

### 2. Driving Physics

**Key Behaviors:**
- **Speed-based turning:** Faster = wider turn radius
- **Slope effects:** Uphill slower, downhill faster
- **Gears:** Forward/reverse/neutral
- **Speed governor:** Prevents physics explosions

```javascript
// Physics constants
PHYSICS.ACCELERATION.base = 12;      // km/h per second
PHYSICS.BRAKING.normal = 20;          // km/h per second
PHYSICS.TURNING.baseRadius = 25;      // meters at low speed
```

### 3. Collision Detection

**Uses MapLibre's existing 3D buildings layer:**

```javascript
// Query buildings at car position
const features = map.queryRenderedFeatures(point, { layers: ['3d-buildings'] });

// Check height collision
if (buildingHeight > carHeight) {
  // Bounce away
  car.position = findEscapeRoute();
  car.speed *= 0.3;
}
```

### 4. First-Person Camera

**Features:**
- Smooth follow with delay (feels heavy, realistic)
- Dynamic FOV (+8° at high speed)
- G-force tilt (pitch back when accelerating)
- Road vibration
- Speed shake at 80+ km/h

---

## Integration Steps

### Step 1: Add Source Files

Copy these files to your project:
```bash
# From the delivered files
cp -r src/ /your-project/src/
cp main.js /your-project/main.js
```

### Step 2: Update index.html

Make sure the script tag uses module type:
```html
<script type="module" src="./main.js"></script>
```

### Step 3: Install Dependencies

No new dependencies! Uses existing:
- maplibre-gl
- ES6 modules

### Step 4: Test

```bash
# Start server
npx serve . -p 5173

# Open browser
open http://localhost:5173

# Press 🚗 Enter Drive Mode
# Use W/S to drive, A/D to steer
# Press F3 for debug info
```

---

## Customization

### Adjust Physics Feel

Edit `src/DrivingPhysics.js`:

```javascript
PHYSICS.ACCELERATION.base = 20;  // Faster acceleration
PHYSICS.BRAKING.normal = 30;      // Stronger brakes
PHYSICS.TURNING.baseRadius = 15;  // Tighter turns
```

### Adjust Camera

Edit `src/FirstPersonCamera.js`:

```javascript
CONFIG.FOV.base = 80;              // Wider view
CONFIG.FOLLOW.delay = 0.05;        // Snappier follow
CONFIG.EFFECTS.accelTilt = 5;      // More tilt
```

### Adjust Road Snapping

Edit `src/RoadConstraintSystem.js`:

```javascript
CONFIG.MAX_SEARCH_RADIUS = 50;     // Search further
CONFIG.SNAP_STRENGTH = 3;          // Snap harder
```

---

## Known Limitations

### Current (Fallback)
- Uses simplified grid road network
- Roads are straight segments
- No one-way streets
- No lane information

### Future (With OSM Data)
- Real Lisbon road network
- Curved roads
- One-way enforcement
- Lane-specific driving

---

## Next Steps

1. **Test current implementation** - See how it feels
2. **Export OSM data** - Real Lisbon roads
3. **Add sound** - Engine, tires, brakes
4. **Add particles** - Dust when off-road
5. **Multiplayer** - Race other players

---

## Debug Mode

Press **F3** to see:
- Current speed & bearing
- Steering angle
- Road type
- On/off-road status
- Collision count

Use this to tune physics and find bugs.

---

## Performance Tips

If frame rate drops:

1. **Reduce query frequency** - In `CollisionSystem.js`, increase `QUERY_COOLDOWN`
2. **Simplify road network** - Fewer segments = faster queries
3. **Reduce camera effects** - Disable vibration/shake
4. **Use Chrome DevTools** - Profile to find bottlenecks

Target: **60fps** = 16ms per frame
Current budget: ~4ms for all systems

---

## Troubleshooting

### Car flies into space
- Physics explosion detected
- Check `LIMITS.maxSpeed` in DrivingPhysics.js
- Enable debug mode (F3) to see values

### Car drives through buildings
- Building layer not loaded
- Check MapTiler key
- Verify `3d-buildings` layer exists

### Car won't snap to roads
- Check fallback roads exist
- Verify position is within Lisbon bounds
- Increase `MAX_SEARCH_RADIUS`

### Camera makes me sick
- Increase `FOLLOW.delay` for smoother motion
- Reduce `FOV.speedBonus`
- Disable `EFFECTS.vibration`

---

## Architecture Summary

```
Input (WASD) → Physics Engine → Road Constraint → Collision → Camera → Render
                    ↑               ↓                ↓
               Speed limits   Snap to road    Building bounce
               Slope effects  Speed limits    Boundary clamp
```

**Data Flow:**
1. Player presses W → throttle input
2. Physics calculates new speed/position
3. Road system constrains to road network
4. Collision system checks buildings
5. Camera smooths and renders

---

*Questions? Check ROAD_PHYSICS_ARCHITECTURE.md for the full technical spec.*
