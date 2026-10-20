/**
 * Collision Detection System for Lisbon 3D
 * 
 * Handles:
 * - Building collision (using MapLibre queryRenderedFeatures)
 * - Terrain collision/elevation
 * - World boundary constraints
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

import { haversineDistance, clampToLisbonBounds, projectCoordinate } from './utils.js';

// Configuration
const CONFIG = {
  // Query settings
  QUERY_COOLDOWN: 50,      // ms between building queries
  QUERY_RADIUS: 20,        // Pixels around car center to query
  
  // Collision response
  BOUNCE_FACTOR: 0.3,      // Speed retained after collision
  PUSH_DISTANCE: 1.0,      // Meters to push away
  
  // Building layers
  BUILDING_LAYERS: ['3d-buildings'],
  
  // Elevation
  ELEVATION_SAMPLE_DISTANCE: 5, // Meters ahead to check slope
  MAX_SLOPE_ANGLE: 45          // Max driveable slope (degrees)
};

/**
 * Collision System
 */
export class CollisionSystem {
  constructor(map) {
    this.map = map;
    this.lastQueryTime = 0;
    this.lastResult = { collision: false };
    
    // Cache for building queries
    this.buildingCache = new Map();
    
    // Collision history for debug
    this.collisionHistory = [];
  }

  /**
   * Check for collision at position
   * @param {[number, number]} pos - [lng, lat]
   * @param {number} carHeight - Height of car in meters
   * @returns {Object} Collision info
   */
  checkCollision(pos, carHeight = 1.5) {
    const now = performance.now();
    
    // Throttle queries
    if (now - this.lastQueryTime < CONFIG.QUERY_COOLDOWN) {
      return this.lastResult;
    }
    this.lastQueryTime = now;
    
    // Convert to screen coordinates for query
    const screenPoint = this.map.project(pos);
    
    // Query building features
    const features = this.map.queryRenderedFeatures(
      [screenPoint.x, screenPoint.y],
      { layers: CONFIG.BUILDING_LAYERS, radius: CONFIG.QUERY_RADIUS }
    );
    
    for (const feature of features) {
      const props = feature.properties || {};
      const buildingHeight = props.height || props.render_height || 10;
      const minHeight = props.min_height || props.render_min_height || 0;
      
      // Collision if:
      // 1. Building is tall enough to hit car
      // 2. Car is not under an overhang (minHeight > 0 means elevated)
      if (buildingHeight > carHeight && minHeight < 0.5) {
        const result = {
          collision: true,
          type: 'building',
          height: buildingHeight,
          position: pos,
          feature: feature
        };
        
        this.lastResult = result;
        this.logCollision(result);
        return result;
      }
    }
    
    const result = { collision: false };
    this.lastResult = result;
    return result;
  }

  /**
   * Get collision response (where to push the car)
   * @param {[number, number]} pos - Current position
   * @param {number} currentBearing - Car's current bearing
   * @returns {Object|null} Response info or null if trapped
   */
  getCollisionResponse(pos, currentBearing) {
    // Sample 8 directions to find escape route
    const directions = [0, 45, 90, 135, 180, 225, 270, 315];
    const validDirections = [];
    
    for (const offset of directions) {
      const testBearing = (currentBearing + offset) % 360;
      const testPos = projectCoordinate(pos, testBearing, CONFIG.PUSH_DISTANCE);
      
      if (!this.checkCollision(testPos).collision) {
        validDirections.push({
          bearing: testBearing,
          position: testPos,
          angleDiff: Math.abs(offset > 180 ? 360 - offset : offset)
        });
      }
    }
    
    if (validDirections.length === 0) {
      // Trapped! Emergency reverse
      return {
        type: 'emergency',
        bearing: (currentBearing + 180) % 360,
        position: projectCoordinate(pos, currentBearing + 180, CONFIG.PUSH_DISTANCE * 2),
        message: 'TRAPPED - emergency reverse'
      };
    }
    
    // Pick direction closest to current bearing
    validDirections.sort((a, b) => a.angleDiff - b.angleDiff);
    const best = validDirections[0];
    
    return {
      type: 'bounce',
      bearing: best.bearing,
      position: best.position,
      speedMultiplier: CONFIG.BOUNCE_FACTOR
    };
  }

  /**
   * Check and handle world boundaries
   */
  checkBoundaries(pos) {
    const clamped = clampToLisbonBounds(pos);
    
    const wasClamped = pos[0] !== clamped[0] || pos[1] !== clamped[1];
    
    return {
      position: clamped,
      wasClamped,
      boundary: wasClamped ? this.getBoundarySide(pos) : null
    };
  }

  /**
   * Get which boundary was hit
   */
  getBoundarySide(pos) {
    const bounds = { west: -9.3, east: -9.0, south: 38.6, north: 38.85 };
    const sides = [];
    
    if (pos[0] <= bounds.west) sides.push('west');
    if (pos[0] >= bounds.east) sides.push('east');
    if (pos[1] <= bounds.south) sides.push('south');
    if (pos[1] >= bounds.north) sides.push('north');
    
    return sides;
  }

  /**
   * Check terrain elevation and slope
   * @param {[number, number]} pos - Position
   * @param {number} bearing - Facing direction
   * @returns {Object} Elevation info
   */
  async checkTerrain(pos, bearing) {
    // Try to get elevation from MapLibre if available
    let elevation = 0;
    let aheadElevation = 0;
    
    if (this.map.queryTerrainElevation) {
      try {
        elevation = this.map.queryTerrainElevation(pos) || 0;
        
        // Sample ahead for slope
        const aheadPos = projectCoordinate(pos, bearing, CONFIG.ELEVATION_SAMPLE_DISTANCE);
        aheadElevation = this.map.queryTerrainElevation(aheadPos) || elevation;
      } catch (e) {
        // Fallback to flat
        elevation = 0;
        aheadElevation = 0;
      }
    }
    
    // Calculate slope
    const rise = aheadElevation - elevation;
    const run = CONFIG.ELEVATION_SAMPLE_DISTANCE;
    const grade = rise / run;
    const angle = Math.atan(grade) * 180 / Math.PI;
    
    return {
      elevation,
      aheadElevation,
      grade,
      angle,
      isUphill: grade > 0.02,
      isDownhill: grade < -0.02,
      isTooSteep: Math.abs(angle) > CONFIG.MAX_SLOPE_ANGLE
    };
  }

  /**
   * Log collision for debugging
   */
  logCollision(collision) {
    this.collisionHistory.push({
      ...collision,
      timestamp: performance.now()
    });
    
    // Keep last 50
    if (this.collisionHistory.length > 50) {
      this.collisionHistory.shift();
    }
    
    if (this.collisionHistory.length > 10) {
      console.warn('Multiple collisions detected! Check for physics issues.');
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo() {
    return {
      lastQuery: this.lastQueryTime,
      lastResult: this.lastResult,
      collisionCount: this.collisionHistory.length,
      recentCollisions: this.collisionHistory.slice(-5)
    };
  }

  /**
   * Clear collision history
   */
  clearHistory() {
    this.collisionHistory = [];
    this.lastResult = { collision: false };
  }
}

export default CollisionSystem;
