# Lisbon 3D: Road Constraint & Physics System
## Technical Architecture Document

**Version:** 1.0  
**Author:** Dragon (Security/Punk Rock Hacker)  
**Date:** 2026-03-24  
**Status:** Design Phase  

---

## Executive Summary

This document defines the architecture for constraining vehicle movement to Lisbon's road network using real OSM data, implementing collision detection with buildings/terrain, and delivering a satisfying driving physics model. The system prioritizes **performance over perfection** — clever hacks that work > academic solutions that don't.

---

## 1. Road Constraint System

### 1.1 Core Philosophy

Instead of "perfect" road following (expensive physics engines, complex mesh generation), we use a **rasterized road mask + snap-to-road** approach. Think of it as a 2D collision map where roads are "safe zones" and everything else is "off-road."

### 1.2 Data Requirements (OSM Layers)

```
Required OSM Tags:
├── highway=motorway        → Speed: 120 km/h, snap: 10m
├── highway=trunk           → Speed: 90 km/h, snap: 8m
├── highway=primary         → Speed: 80 km/h, snap: 8m
├── highway=secondary       → Speed: 60 km/h, snap: 6m
├── highway=tertiary        → Speed: 50 km/h, snap: 5m
├── highway=residential     → Speed: 40 km/h, snap: 4m
├── highway=living_street   → Speed: 20 km/h, snap: 3m
├── highway=pedestrian      → Speed: 10 km/h, snap: 2m
├── oneway=yes              → Direction constraint (optional v2)
├── lanes=*                 → Road width multiplier
└── surface=*               → Friction modifier (asphalt vs cobblestone)
```

### 1.3 Road Mask Generation (Preprocessing)

**The Hack:** Generate a low-res "road mask" bitmap for each zoom level.

```javascript
// ROAD_MASK_CONFIG
const ROAD_MASK_ZOOM = 16;  // 1 tile = ~150m real world
const MASK_TILE_SIZE = 256; // pixels
const ROAD_WIDTH_PX = {
  motorway: 8,
  trunk: 6,
  primary: 6,
  secondary: 4,
  tertiary: 3,
  residential: 2,
  living_street: 2
};

// Pipeline: OSM vector tiles → Canvas 2D raster → Road mask bitmap
// Store as: road-masks/{z}/{x}/{y}.png (1-bit alpha, tiny size)
```

**Why this works:**
- Single pixel lookup = O(1) road detection
- No complex geometry math at runtime
- Tiles load on-demand (same as map tiles)
- ~1KB per tile vs 50KB+ for vector geometry

### 1.4 Snap-to-Road Algorithm

```javascript
class RoadConstraintSystem {
  constructor() {
    this.roadMaskCache = new Map(); // LRU cache of loaded mask tiles
    this.lastValidPosition = null;   // Emergency fallback
    this.offRoadTimer = 0;           // Seconds off-road
  }

  /**
   * Core constraint function - call every frame
   * @param {LngLat} proposedPos - Where car wants to go
   * @param {number} speed - Current speed km/h
   * @returns {Object} { position, onRoad, roadType, speedLimit }
   */
  constrain(proposedPos, speed) {
    const tile = this.getTileForCoord(proposedPos);
    const mask = this.getRoadMask(tile);
    
    // Fast path: check if on road
    const pixel = this.coordToMaskPixel(proposedPos, tile);
    const roadType = mask.getRoadType(pixel.x, pixel.y);
    
    if (roadType) {
      // ON ROAD - smooth sailing
      this.lastValidPosition = proposedPos;
      this.offRoadTimer = 0;
      return {
        position: proposedPos,
        onRoad: true,
        roadType,
        speedLimit: SPEED_LIMITS[roadType]
      };
    }
    
    // OFF ROAD - snap back
    return this.handleOffRoad(proposedPos, speed);
  }

  /**
   * The "Rubber Band" Snap Algorithm
   * When off-road, find nearest road point within search radius
   */
  handleOffRoad(pos, speed) {
    this.offRoadTimer += DELTA_TIME;
    
    // Search pattern: spiral outward from current position
    // Max search radius depends on speed (faster = larger search)
    const maxRadius = Math.min(50, 10 + speed * 0.5); // meters
    const spiral = this.generateSpiralSearch(maxRadius);
    
    for (const offset of spiral) {
      const testPos = this.offsetMeters(pos, offset.x, offset.y);
      const tile = this.getTileForCoord(testPos);
      const mask = this.getRoadMask(tile);
      const pixel = this.coordToMaskPixel(testPos, tile);
      const roadType = mask.getRoadType(pixel.x, pixel.y);
      
      if (roadType) {
        // Found road! Apply "rubber band" snap with smoothing
        const snapStrength = Math.min(1, this.offRoadTimer * 2); // Gradual snap
        const snappedPos = this.lerp(pos, testPos, snapStrength);
        
        return {
          position: snappedPos,
          onRoad: false, // Still counted as off-road for penalties
          roadType,
          speedLimit: SPEED_LIMITS[roadType] * 0.5 // Half speed when snapping
        };
      }
    }
    
    // No road found - hard clamp to last valid position
    // This prevents driving into the Tagus River
    return {
      position: this.lastValidPosition || pos,
      onRoad: false,
      roadType: null,
      speedLimit: 5 // Crawl speed
    };
  }

  /**
   * Generate spiral search pattern (center-first)
   * More efficient than grid search for "usually near road" case
   */
  generateSpiralSearch(maxRadiusMeters) {
    const points = [];
    const step = 2; // meters between checks
    let x = 0, y = 0;
    let dx = 0, dy = -step;
    
    for (let i = 0; i < (maxRadiusMeters / step) ** 2; i++) {
      if (Math.abs(x) <= maxRadiusMeters && Math.abs(y) <= maxRadiusMeters) {
        points.push({ x, y });
      }
      if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
        [dx, dy] = [-dy, dx]; // Rotate 90°
      }
      x += dx;
      y += dy;
    }
    return points;
  }
}
```

### 1.5 Road Following Enhancements

```javascript
/**
 * Predictive Road Following (v2 feature)
 * Look ahead along current bearing to find road centerline
 * Provides smoother steering suggestions
 */
function getRoadCenterlineHint(currentPos, bearing, lookAheadMeters = 20) {
  // Sample points ahead at 5m intervals
  const samples = [];
  for (let d = 5; d <= lookAheadMeters; d += 5) {
    const ahead = projectCoordinate(currentPos, bearing, d);
    const roadInfo = roadSystem.query(ahead);
    if (roadInfo.onRoad) {
      samples.push({ distance: d, offset: roadInfo.centerlineOffset });
    }
  }
  
  // Return weighted average of corrections needed
  // Closer samples weighted higher for responsiveness
  // Farther samples weighted higher for smoothness
  return calculateSteeringCorrection(samples);
}
```

---

## 2. Collision Detection System

### 2.1 Building Collision

**The Hack:** Use MapLibre's existing 3D building layer for collision.

```javascript
/**
 * Building Collision Detection
 * Leverages existing building height data from MapTiler
 */
class BuildingCollisionSystem {
  constructor(map) {
    this.map = map;
    this.buildingCache = new Map();
    this.lastQueryTime = 0;
    this.QUERY_COOLDOWN = 100; // ms - throttle building queries
  }

  /**
   * Check if position collides with buildings
   * @param {LngLat} pos - Car position
   * @param {number} carHeight - Height of car in meters
   * @returns {boolean} true if collision
   */
  checkCollision(pos, carHeight = 1.5) {
    const now = performance.now();
    if (now - this.lastQueryTime < this.QUERY_COOLDOWN) {
      return this.lastCollisionResult;
    }
    this.lastQueryTime = now;

    // Query features at car position
    const features = this.map.queryRenderedFeatures(
      this.map.project(pos),
      { layers: ['3d-buildings'] }
    );

    for (const feature of features) {
      const buildingHeight = feature.properties.height || 10;
      const baseHeight = feature.properties.min_height || 0;
      
      // Car can drive under overhangs (base_height > 0)
      // Car collides if building height > car height AND no overhang
      if (buildingHeight > carHeight && baseHeight < 0.5) {
        this.lastCollisionResult = true;
        return true;
      }
    }

    this.lastCollisionResult = false;
    return false;
  }

  /**
   * Get collision response vector (push direction)
   */
  getCollisionResponse(pos) {
    // Sample 8 directions, find escape vector
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const escapeVectors = [];
    
    for (const angle of angles) {
      const testPos = projectCoordinate(pos, angle, 2); // 2m offset
      if (!this.checkCollision(testPos)) {
        escapeVectors.push(angle);
      }
    }
    
    // Return average of escape directions
    return escapeVectors.length > 0 
      ? averageAngle(escapeVectors) 
      : null; // Trapped!
  }
}
```

### 2.2 Terrain Elevation Handling

```javascript
/**
 * Terrain-aware driving
 * Use MapLibre's terrain-RGB to get ground elevation
 */
class TerrainSystem {
  constructor(map) {
    this.map = map;
    this.elevationCache = new Map();
  }

  /**
   * Get ground elevation at coordinate
   */
  async getElevation(lngLat) {
    const key = `${Math.round(lngLat[0]*1000)},${Math.round(lngLat[1]*1000)}`;
    if (this.elevationCache.has(key)) {
      return this.elevationCache.get(key);
    }

    // MapLibre's queryTerrainElevation (if available)
    if (this.map.queryTerrainElevation) {
      const elevation = this.map.queryTerrainElevation(lngLat);
      this.elevationCache.set(key, elevation);
      return elevation;
    }

    // Fallback: use terrain-RGB tile directly
    return this.getElevationFromTerrainRGB(lngLat);
  }

  /**
   * Calculate slope at position (for hill climbing physics)
   */
  async getSlope(lngLat, bearing) {
    const here = await this.getElevation(lngLat);
    const ahead = await this.getElevation(
      projectCoordinate(lngLat, bearing, 5) // 5m ahead
    );
    
    return {
      grade: (ahead - here) / 5, // rise/run
      isUphill: ahead > here,
      elevation: here
    };
  }
}
```

### 2.3 World Boundaries

```javascript
// Lisbon bounding box (rough)
const LISBON_BOUNDS = {
  west: -9.3,
  east: -9.0,
  south: 38.6,
  north: 38.85
};

function clampToWorldBounds(pos) {
  return [
    Math.max(LISBON_BOUNDS.west, Math.min(LISBON_BOUNDS.east, pos[0])),
    Math.max(LISBON_BOUNDS.south, Math.min(LISBON_BOUNDS.north, pos[1]))
  ];
}
```

---

## 3. Driving Physics System

### 3.1 Physics Constants

```javascript
// ============================================
// PHYSICS CONSTANTS - TUNED FOR "FUN" FACTOR
// ============================================

const PHYSICS = {
  // Speed limits by road type (km/h)
  SPEED_LIMITS: {
    motorway: 120,
    trunk: 90,
    primary: 80,
    secondary: 60,
    tertiary: 50,
    residential: 40,
    living_street: 20,
    pedestrian: 10,
    offroad: 20
  },

  // Acceleration curves (km/h per second)
  ACCELERATION: {
    base: 8,           // Base acceleration
    sportMultiplier: 1.5,  // Turbo boost option
    uphillPenalty: 0.7,    // Slower going up
    downhillBonus: 1.2     // Faster going down
  },

  // Braking (km/h per second)
  BRAKING: {
    normal: 15,
    emergency: 30,     // Handbrake
    offroad: 8         // Slippery
  },

  // Friction / Deceleration
  FRICTION: {
    road: 0.5,         // Natural slowdown
    offroad: 2.0,      // Fast slowdown (encourages staying on road)
    air: 0.1           // Coasting
  },

  // Turning physics
  TURNING: {
    baseRadius: 30,    // Meters (minimum turn radius at low speed)
    speedFactor: 0.4,  // How much speed affects radius
    maxAngle: 45,      // Max steering angle (degrees)
    returnSpeed: 3     // How fast wheels center when not steering
  },

  // Car dimensions (meters)
  CAR: {
    length: 4.5,
    width: 1.8,
    height: 1.5,
    wheelbase: 2.7,
    trackWidth: 1.6
  }
};
```

### 3.2 Physics Engine

```javascript
class DrivingPhysics {
  constructor() {
    this.state = {
      speed: 0,        // km/h
      bearing: 0,      // degrees (0 = north)
      steering: 0,     // -1 (full left) to 1 (full right)
      position: null,  // [lng, lat]
      
      // Advanced state
      angularVelocity: 0,
      driftAngle: 0,
      skidding: false
    };
  }

  /**
   * Main physics update - call every frame
   * @param {Object} input - { throttle, brake, steerLeft, steerRight }
   * @param {number} dt - Delta time in seconds
   * @param {Object} environment - { roadType, slope, onRoad }
   */
  update(input, dt, environment) {
    const { speed, bearing, steering } = this.state;
    
    // === SPEED PHYSICS ===
    
    // Target acceleration
    let accel = 0;
    if (input.throttle) {
      accel = PHYSICS.ACCELERATION.base;
      
      // Apply terrain modifiers
      if (environment.slope?.isUphill) {
        accel *= PHYSICS.ACCELERATION.uphillPenalty * (1 - environment.slope.grade);
      } else if (environment.slope?.grade < -0.05) {
        accel *= PHYSICS.ACCELERATION.downhillBonus;
      }
    }
    
    // Apply braking
    let decel = 0;
    if (input.brake) {
      decel = PHYSICS.BRAKING.normal;
    }
    
    // Apply friction (always)
    const friction = environment.onRoad 
      ? PHYSICS.FRICTION.road 
      : PHYSICS.FRICTION.offroad;
    
    // Update speed
    const newSpeed = Math.max(0, 
      speed + (accel - decel - friction) * dt * 3.6 // m/s to km/h
    );
    
    // Apply speed limit
    const limit = environment.roadType 
      ? PHYSICS.SPEED_LIMITS[environment.roadType] 
      : PHYSICS.SPEED_LIMITS.offroad;
    this.state.speed = Math.min(newSpeed, limit);
    
    // === STEERING PHYSICS ===
    
    // Update steering angle
    let targetSteering = 0;
    if (input.steerLeft) targetSteering = -1;
    if (input.steerRight) targetSteering = 1;
    
    // Smooth steering transition
    const steerSpeed = PHYSICS.TURNING.returnSpeed * dt;
    this.state.steering = lerp(this.state.steering, targetSteering, steerSpeed);
    
    // Calculate turn radius based on speed
    // Higher speed = larger minimum radius (understeer)
    const minRadius = PHYSICS.TURNING.baseRadius + 
      (speed * PHYSICS.TURNING.speedFactor);
    
    // Turning rate (degrees per second)
    const maxTurnRate = (this.state.speed / minRadius) * (180 / Math.PI);
    const turnRate = maxTurnRate * Math.abs(this.state.steering);
    
    // Update bearing
    if (this.state.steering < 0) {
      this.state.bearing -= turnRate * dt;
    } else if (this.state.steering > 0) {
      this.state.bearing += turnRate * dt;
    }
    
    // Normalize bearing to 0-360
    this.state.bearing = ((this.state.bearing % 360) + 360) % 360;
    
    // === POSITION UPDATE ===
    
    // Convert speed to coordinate movement
    // At equator: 1° longitude ≈ 111km, 1° latitude ≈ 111km
    // Lisbon: cos(38.7°) ≈ 0.78, so 1° lng ≈ 86km
    const speedMps = this.state.speed / 3.6;
    const moveDistance = speedMps * dt;
    
    // Bearing to radians (0° = North, clockwise)
    const bearingRad = (this.state.bearing * Math.PI) / 180;
    
    // Calculate coordinate delta
    const latDelta = (moveDistance * Math.cos(bearingRad)) / 111000;
    const lngDelta = (moveDistance * Math.sin(bearingRad)) / (111000 * 0.78);
    
    this.state.position = [
      this.state.position[0] + lngDelta,
      this.state.position[1] + latDelta
    ];
    
    return this.state;
  }

  /**
   * Calculate braking distance for current speed
   */
  getBrakingDistance() {
    const speedMps = this.state.speed / 3.6;
    return (speedMps ** 2) / (2 * PHYSICS.BRAKING.normal);
  }

  /**
   * Get recommended speed for turn radius
   */
  getSpeedForTurnRadius(radiusMeters) {
    // v = sqrt(r * a) where a is comfortable lateral acceleration (~3 m/s²)
    const maxLateralG = 3;
    const maxSpeed = Math.sqrt(radiusMeters * maxLateralG);
    return maxSpeed * 3.6; // Convert to km/h
  }
}
```

### 3.3 Speed Governor (Safety)

```javascript
/**
 * Prevent unrealistic speeds and physics explosions
 */
class SpeedGovernor {
  constructor() {
    this.maxReasonableSpeed = 200; // km/h
    this.physicsExplosionThreshold = 500; // km/h (indicates bug)
  }

  validate(state) {
    // Hard cap
    if (state.speed > this.maxReasonableSpeed) {
      state.speed = this.maxReasonableSpeed;
      console.warn('Speed governor activated');
    }
    
    // Physics explosion detection
    if (state.speed > this.physicsExplosionThreshold || isNaN(state.speed)) {
      console.error('Physics explosion detected! Resetting.');
      state.speed = 0;
      state.position = this.lastValidPosition;
    }
    
    this.lastValidPosition = [...state.position];
    return state;
  }
}
```

---

## 4. First-Person Camera System

### 4.1 Camera Specifications

```javascript
const CAMERA_CONFIG = {
  // Position relative to car
  DRIVER_POSITION: {
    height: 1.2,       // Eye level (meters above ground)
    forward: 0.5,      // Meters forward from car center
    lateral: 0         // Centered (could add head lean in v2)
  },

  // Field of View
  FOV: {
    normal: 75,        // Degrees (realistic driving)
    speedBoost: 5,     // +5° at high speeds (speed sensation)
    max: 90            // Hard limit
  },

  // Camera behavior
  BEHAVIOR: {
    followDelay: 0.1,      // Seconds (smooth follow)
    lookAheadDistance: 10, // Meters (where camera "looks")
    maxPitch: 85,          // MapLibre limit
    minPitch: 45,          // Don't look too down
    
    // Head movement
    bobAmount: 0.02,       // Meters (road vibration)
    bobSpeed: 10,          // Hz
    
    // G-force effects
    accelTilt: 2,          // Degrees back when accelerating
    brakeTilt: 3,          // Degrees forward when braking
    turnTilt: 2            // Degrees into turn
  }
};
```

### 4.2 Camera Controller

```javascript
class FirstPersonCamera {
  constructor(map) {
    this.map = map;
    this.targetPosition = null;
    this.currentPosition = null;
    this.targetBearing = 0;
    this.currentBearing = 0;
    this.time = 0;
  }

  /**
   * Update camera position and orientation
   * @param {Object} carState - Current car physics state
   * @param {Object} input - Current input state
   * @param {number} dt - Delta time
   */
  update(carState, input, dt) {
    this.time += dt;
    
    // Calculate ideal camera position (driver's eye position)
    const eyeOffset = this.calculateEyeOffset(carState);
    this.targetPosition = [
      carState.position[0] + eyeOffset.lng,
      carState.position[1] + eyeOffset.lat
    ];
    
    // Smooth position interpolation
    if (!this.currentPosition) {
      this.currentPosition = [...this.targetPosition];
    }
    const lerpFactor = 1 - Math.exp(-dt / CAMERA_CONFIG.BEHAVIOR.followDelay);
    this.currentPosition = lerpCoords(this.currentPosition, this.targetPosition, lerpFactor);
    
    // Calculate target bearing (where we're looking)
    // Look ahead along road, not just car bearing
    const lookAhead = projectCoordinate(
      carState.position, 
      carState.bearing, 
      CAMERA_CONFIG.BEHAVIOR.lookAheadDistance
    );
    this.targetBearing = bearingBetween(this.currentPosition, lookAhead);
    
    // Smooth bearing interpolation (handle 359° → 0° wrap)
    this.currentBearing = lerpAngle(this.currentBearing, this.targetBearing, lerpFactor);
    
    // Calculate dynamic FOV based on speed
    const speedFactor = carState.speed / 100; // Normalize to 100km/h
    const dynamicFOV = CAMERA_CONFIG.FOV.normal + 
      (speedFactor * CAMERA_CONFIG.FOV.speedBoost);
    
    // Calculate camera pitch with G-force effects
    let targetPitch = 60; // Default
    if (input.throttle) targetPitch -= CAMERA_CONFIG.BEHAVIOR.accelTilt;
    if (input.brake) targetPitch += CAMERA_CONFIG.BEHAVIOR.brakeTilt;
    if (Math.abs(carState.steering) > 0.5) {
      targetPitch += CAMERA_CONFIG.BEHAVIOR.turnTilt * Math.sign(carState.steering);
    }
    
    // Add road vibration
    const vibration = Math.sin(this.time * CAMERA_CONFIG.BEHAVIOR.bobSpeed) * 
      CAMERA_CONFIG.BEHAVIOR.bobAmount * (carState.speed / 50);
    targetPitch += vibration;
    
    // Apply to map
    this.map.jumpTo({
      center: this.currentPosition,
      bearing: this.currentBearing,
      pitch: clamp(targetPitch, CAMERA_CONFIG.BEHAVIOR.minPitch, CAMERA_CONFIG.BEHAVIOR.maxPitch),
      zoom: this.speedToZoom(carState.speed)
    });
  }

  /**
   * Convert car speed to camera zoom level
   * Faster = zoomed out slightly for peripheral vision
   */
  speedToZoom(speed) {
    const baseZoom = 18;
    const speedZoomReduction = speed / 100; // -1 zoom at 100km/h
    return Math.max(16, baseZoom - speedZoomReduction);
  }

  /**
   * Calculate eye position offset from car center
   */
  calculateEyeOffset(carState) {
    // Convert car-local offset to world coordinates
    const bearingRad = (carState.bearing * Math.PI) / 180;
    
    const forward = CAMERA_CONFIG.DRIVER_POSITION.forward;
    const lateral = CAMERA_CONFIG.DRIVER_POSITION.lateral;
    
    // Convert meters to coordinate offset
    const lngOffset = (forward * Math.sin(bearingRad) + lateral * Math.cos(bearingRad)) / 86000;
    const latOffset = (forward * Math.cos(bearingRad) - lateral * Math.sin(bearingRad)) / 111000;
    
    return { lng: lngOffset, lat: latOffset };
  }
}
```

---

## 5. Integration Architecture

### 5.1 System Integration

```javascript
/**
 * Main game loop integration
 */
class Lisbon3DDriveMode {
  constructor(map) {
    this.map = map;
    this.physics = new DrivingPhysics();
    this.roadSystem = new RoadConstraintSystem();
    this.buildingCollision = new BuildingCollisionSystem(map);
    this.terrain = new TerrainSystem(map);
    this.camera = new FirstPersonCamera(map);
    this.governor = new SpeedGovernor();
    
    this.isActive = false;
    this.lastTime = 0;
  }

  async update(deltaTime) {
    if (!this.isActive) return;
    
    // 1. Get input
    const input = this.getInputState();
    
    // 2. Apply physics (proposed next state)
    let state = this.physics.update(input, deltaTime, {
      roadType: this.currentRoadType,
      slope: this.currentSlope,
      onRoad: this.onRoad
    });
    
    // 3. Apply road constraints
    const roadResult = this.roadSystem.constrain(state.position, state.speed);
    state.position = roadResult.position;
    this.onRoad = roadResult.onRoad;
    this.currentRoadType = roadResult.roadType;
    
    // 4. Check building collision
    if (this.buildingCollision.checkCollision(state.position)) {
      const escape = this.buildingCollision.getCollisionResponse(state.position);
      if (escape) {
        // Push car away from building
        state.position = projectCoordinate(state.position, escape, 0.5);
        state.speed *= 0.5; // Collision penalty
      }
    }
    
    // 5. Get terrain data
    const slope = await this.terrain.getSlope(state.position, state.bearing);
    this.currentSlope = slope;
    
    // 6. Safety check
    state = this.governor.validate(state);
    
    // 7. Update camera
    this.camera.update(state, input, deltaTime);
    
    // 8. Update UI
    this.updateUI(state);
    
    this.state = state;
  }

  getInputState() {
    return {
      throttle: keys.w,
      brake: keys.s,
      steerLeft: keys.a,
      steerRight: keys.d
    };
  }
}
```

### 5.2 Performance Budgets

| Operation | Target Time | Max Time |
|-----------|-------------|----------|
| Physics Update | < 0.1ms | 0.5ms |
| Road Constraint | < 1ms | 5ms |
| Building Query | < 2ms | 10ms |
| Terrain Query | < 2ms | 5ms |
| Camera Update | < 0.5ms | 1ms |
| **Total Frame** | **< 6ms** | **16ms** |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Implement road mask generation script
- [ ] Create `RoadConstraintSystem` with basic snap-to-road
- [ ] Integrate with existing drive mode
- [ ] Add speed limits by road type

### Phase 2: Physics (Week 2)
- [ ] Implement `DrivingPhysics` class
- [ ] Add acceleration curves and braking
- [ ] Add turning radius physics
- [ ] Terrain slope integration
- [ ] Speed governor

### Phase 3: Collision (Week 3)
- [ ] Building collision detection
- [ ] World boundary constraints
- [ ] Collision response (bounce/push)
- [ ] Off-road penalties

### Phase 4: Camera (Week 4)
- [ ] First-person camera controller
- [ ] Dynamic FOV
- [ ] G-force effects
- [ ] Road vibration

### Phase 5: Polish (Week 5)
- [ ] Predictive road following
- [ ] Smooth snap transitions
- [ ] Performance optimization
- [ ] Edge case handling

---

## 7. Data Pipeline

### 7.1 Road Mask Generation Script

```bash
# Generate road masks from OSM data
# Run once, commit to repo

node scripts/generate-road-masks.js \
  --bounds "-9.3,-9.0,38.6,38.85" \
  --output assets/road-masks/ \
  --zoom 16
```

### 7.2 Required Assets

```
assets/
├── road-masks/
│   ├── 16/
│   │   ├── 31920_24810.png
│   │   └── ...
│   └── manifest.json
└── physics-config.json
```

---

## 8. Testing Strategy

### 8.1 Test Locations (Lisbon)

| Location | Purpose | Expected Behavior |
|----------|---------|-------------------|
| Avenida da Liberdade | Wide straight road | High speed, smooth |
| Alfama narrow streets | Tight corners | Low speed, frequent turning |
| 25 de Abril Bridge | Long straight | Max speed testing |
| Parque Eduardo VII | Off-road area | Snap back to paths |
| Chiado steep hills | Slope testing | Acceleration penalties |

### 8.2 Edge Cases

1. **Driving into Tagus River** → Hard boundary, reset to nearest road
2. **Tunnels** → Use min_height building data for clearance
3. **High-speed collision** → Emergency brake, don't clip through
4. **No road found** → Emergency mode, last valid position

---

## 9. Appendix: Quick Reference

### Coordinate Conversions

```javascript
// Meters to coordinate offset (Lisbon)
function metersToCoords(meters, bearing) {
  const rad = (bearing * Math.PI) / 180;
  return {
    lng: (meters * Math.sin(rad)) / 86000,
    lat: (meters * Math.cos(rad)) / 111000
  };
}

// Haversine distance (meters)
function haversine(a, b) {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  
  const x = Math.sin(dLat/2)**2 + 
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
```

### Utility Functions

```javascript
// Linear interpolation
const lerp = (a, b, t) => a + (b - a) * t;

// Angle interpolation (handles wraparound)
function lerpAngle(a, b, t) {
  const diff = ((b - a + 180) % 360) - 180;
  return a + diff * t;
}

// Clamp
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
```

---

## 10. Summary

**The Punk Rock Approach:**
- ✅ Rasterized road masks for O(1) lookup performance
- ✅ Spiral search for efficient snap-to-road
- ✅ Leverage existing MapLibre layers for collision
- ✅ Simple physics tuned for "fun" over realism
- ✅ Progressive enhancement (works without all features)

**Performance First:**
- Road constraints: < 1ms per frame
- Building queries: throttled, async
- Physics: simple, predictable
- Camera: smooth interpolation

**It Just Works™**

---

*End of Document*
