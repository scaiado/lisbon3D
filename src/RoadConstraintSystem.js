/**
 * Road Constraint System for Lisbon 3D
 * 
 * Keeps the car on roads using rasterized road masks.
 * Fast O(1) lookup with "rubber band" snap-to-road.
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

import { LISBON_CENTER, projectCoordinate, haversineDistance, lerpCoords } from './utils.js';

// Speed limits by road type (km/h)
export const SPEED_LIMITS = {
  motorway: 120,
  trunk: 90,
  primary: 80,
  secondary: 60,
  tertiary: 50,
  residential: 40,
  living_street: 20,
  pedestrian: 10,
  service: 15,
  track: 10,
  offroad: 20
};

// Road type priority (higher = bigger road)
const ROAD_PRIORITY = {
  motorway: 10,
  trunk: 9,
  primary: 8,
  secondary: 7,
  tertiary: 6,
  residential: 5,
  living_street: 4,
  pedestrian: 3,
  service: 2,
  track: 1
};

// Configuration
const CONFIG = {
  MASK_ZOOM: 16,
  MASK_TILE_SIZE: 256,
  MAX_SEARCH_RADIUS: 30, // meters when searching for road
  SEARCH_STEP: 2,        // meters between search points
  SNAP_STRENGTH: 2,      // how fast to snap (higher = faster)
  OFFROAD_FRICTION: 3,   // speed decay when off-road
  CACHE_SIZE: 50         // max cached mask tiles
};

/**
 * LRU Cache for road mask tiles
 */
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recent)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

/**
 * Road Constraint System
 * Keeps car on roads using rasterized road masks
 */
export class RoadConstraintSystem {
  constructor() {
    this.maskCache = new LRUCache(CONFIG.CACHE_SIZE);
    this.lastValidPosition = null;
    this.offRoadTimer = 0;
    this.isOffRoad = false;
    this.currentRoadType = null;
    
    // Spiral search pattern (precomputed)
    this.spiralPattern = this.generateSpiralPattern();
    
    // Fallback road network (simplified Lisbon center)
    this.fallbackRoads = this.generateFallbackRoads();
  }

  /**
   * Main constraint function - call every frame
   * @param {[number, number]} proposedPos - [lng, lat] where car wants to go
   * @param {number} speed - Current speed km/h
   * @param {number} dt - Delta time in seconds
   * @returns {Object} constrained position and metadata
   */
  constrain(proposedPos, speed, dt) {
    // Quick bounds check for Lisbon
    if (!this.isInLisbonBounds(proposedPos)) {
      return this.handleOutOfBounds(proposedPos);
    }

    // Try to get road info at position
    const roadInfo = this.queryRoadMask(proposedPos);
    
    if (roadInfo.onRoad) {
      // ON ROAD - all good
      this.lastValidPosition = [...proposedPos];
      this.offRoadTimer = 0;
      this.isOffRoad = false;
      this.currentRoadType = roadInfo.roadType;
      
      return {
        position: proposedPos,
        onRoad: true,
        roadType: roadInfo.roadType,
        speedLimit: SPEED_LIMITS[roadInfo.roadType],
        snapDelta: null
      };
    }

    // OFF ROAD - need to snap back
    return this.handleOffRoad(proposedPos, speed, dt);
  }

  /**
   * Query road mask at coordinate
   * @returns {Object} { onRoad, roadType, distance }
   */
  queryRoadMask(pos) {
    // For now, use simplified vector-based approach
    // In production, this would query raster tile
    const nearest = this.findNearestRoad(pos);
    
    if (nearest && nearest.distance < 10) { // 10m threshold
      return {
        onRoad: true,
        roadType: nearest.roadType,
        distance: nearest.distance
      };
    }
    
    return { onRoad: false, roadType: null, distance: nearest?.distance || Infinity };
  }

  /**
   * Handle off-road situation
   */
  handleOffRoad(pos, speed, dt) {
    this.offRoadTimer += dt;
    this.isOffRoad = true;

    // Search for nearest road
    const nearestRoad = this.findNearestRoad(pos, CONFIG.MAX_SEARCH_RADIUS);
    
    if (nearestRoad) {
      // Calculate snap strength (increases over time off-road)
      const snapFactor = Math.min(1, this.offRoadTimer * CONFIG.SNAP_STRENGTH);
      
      // Smoothly interpolate toward road
      const snappedPos = lerpCoords(pos, nearestRoad.position, snapFactor);
      
      return {
        position: snappedPos,
        onRoad: false,
        roadType: nearestRoad.roadType,
        speedLimit: SPEED_LIMITS[nearestRoad.roadType] * 0.5, // Half speed when snapping
        snapDelta: {
          dx: nearestRoad.position[0] - pos[0],
          dy: nearestRoad.position[1] - pos[1]
        },
        distanceToRoad: nearestRoad.distance
      };
    }

    // No road found - use last valid position
    if (this.lastValidPosition) {
      return {
        position: [...this.lastValidPosition],
        onRoad: false,
        roadType: null,
        speedLimit: 5,
        snapDelta: null
      };
    }

    // Absolute fallback
    return {
      position: LISBON_CENTER,
      onRoad: false,
      roadType: null,
      speedLimit: 5
    };
  }

  /**
   * Find nearest road to position
   * @param {[number, number]} pos - [lng, lat]
   * @param {number} maxRadius - max search radius in meters
   * @returns {Object|null} nearest road info
   */
  findNearestRoad(pos, maxRadius = CONFIG.MAX_SEARCH_RADIUS) {
    let nearest = null;
    let minDistance = Infinity;

    // Check spiral pattern around position
    for (const offset of this.spiralPattern) {
      if (offset.distance > maxRadius) break;
      
      const testPos = projectCoordinate(pos, offset.bearing, offset.distance);
      
      // Check against fallback road network
      for (const road of this.fallbackRoads) {
        const dist = this.distanceToRoadSegment(testPos, road);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            position: this.closestPointOnRoad(testPos, road),
            roadType: road.type,
            distance: dist
          };
          
          // Early exit if very close
          if (dist < 3) return nearest;
        }
      }
    }

    return nearest;
  }

  /**
   * Distance from point to road segment
   */
  distanceToRoadSegment(pos, road) {
    // Simplified: check distance to start and end
    const d1 = haversineDistance(pos, road.start);
    const d2 = haversineDistance(pos, road.end);
    
    // Also check distance to midpoint for longer segments
    const mid = [(road.start[0] + road.end[0]) / 2, (road.start[1] + road.end[1]) / 2];
    const d3 = haversineDistance(pos, mid);
    
    return Math.min(d1, d2, d3);
  }

  /**
   * Get closest point on road segment
   */
  closestPointOnRoad(pos, road) {
    // Simple midpoint for now
    // In production, calculate actual projection
    return [(road.start[0] + road.end[0]) / 2, (road.start[1] + road.end[1]) / 2];
  }

  /**
   * Generate spiral search pattern
   */
  generateSpiralPattern() {
    const points = [];
    const maxRadius = CONFIG.MAX_SEARCH_RADIUS;
    const step = CONFIG.SEARCH_STEP;
    
    // Generate points in spiral order (center outward)
    let x = 0, y = 0;
    let dx = 0, dy = -step;
    
    for (let i = 0; i < 500; i++) {
      const distance = Math.sqrt(x * x + y * y);
      if (distance <= maxRadius) {
        const bearing = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
        points.push({ x, y, distance, bearing });
      }
      
      if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
        [dx, dy] = [-dy, dx];
      }
      x += dx;
      y += dy;
    }
    
    return points.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Generate simplified fallback road network
   * This is a minimal Lisbon road skeleton for when OSM data fails
   */
  generateFallbackRoads() {
    const roads = [];
    const center = LISBON_CENTER;
    
    // Avenida da Liberdade (north-south spine)
    roads.push({
      type: 'primary',
      start: [center[0], center[1] - 0.01],
      end: [center[0], center[1] + 0.01]
    });
    
    // Rossio area grid
    for (let i = -3; i <= 3; i++) {
      const offset = i * 0.002;
      // Horizontal streets
      roads.push({
        type: 'secondary',
        start: [center[0] - 0.01, center[1] + offset],
        end: [center[0] + 0.01, center[1] + offset]
      });
      // Vertical streets
      roads.push({
        type: 'secondary',
        start: [center[0] + offset, center[1] - 0.01],
        end: [center[0] + offset, center[1] + 0.01]
      });
    }
    
    // Tag riverside (Cais do Sodré area)
    roads.push({
      type: 'primary',
      start: [center[0] - 0.02, center[1] - 0.008],
      end: [center[0] + 0.02, center[1] - 0.008]
    });
    
    return roads;
  }

  /**
   * Check if position is within Lisbon bounds
   */
  isInLisbonBounds(pos) {
    const [lng, lat] = pos;
    return lng >= -9.3 && lng <= -9.0 && lat >= 38.6 && lat <= 38.85;
  }

  /**
   * Handle out of bounds
   */
  handleOutOfBounds(pos) {
    // Clamp to bounds
    const clamped = [
      Math.max(-9.3, Math.min(-9.0, pos[0])),
      Math.max(38.6, Math.min(38.85, pos[1]))
    ];
    
    return {
      position: clamped,
      onRoad: false,
      roadType: null,
      speedLimit: 5,
      outOfBounds: true
    };
  }

  /**
   * Get current state for debug
   */
  getDebugInfo() {
    return {
      isOffRoad: this.isOffRoad,
      offRoadTimer: this.offRoadTimer,
      currentRoadType: this.currentRoadType,
      cacheSize: this.maskCache.cache.size,
      lastValidPosition: this.lastValidPosition
    };
  }
}

export default RoadConstraintSystem;
