/**
 * Utility Functions for Lisbon 3D
 * 
 * Shared math, coordinate, and geometry utilities
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

// ============================================
// CONSTANTS
// ============================================

export const LISBON_CENTER = [-9.1393, 38.7223];

// Lisbon bounds (approximate)
export const LISBON_BOUNDS = {
  west: -9.3,
  east: -9.0,
  south: 38.6,
  north: 38.85
};

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

// Lisbon latitude factor (cos(38.7°) ≈ 0.78)
const LISBON_LAT_FACTOR = 0.78;

// ============================================
// COORDINATE CONVERSIONS
// ============================================

/**
 * Project a coordinate by distance and bearing
 * @param {[number, number]} pos - [lng, lat] starting position
 * @param {number} bearing - Degrees (0 = north, clockwise)
 * @param {number} distance - Distance in meters
 * @returns {[number, number]} New [lng, lat]
 */
export function projectCoordinate(pos, bearing, distance) {
  const bearingRad = (bearing * Math.PI) / 180;
  
  // Convert meters to coordinate offsets
  // 1° latitude ≈ 111km
  // 1° longitude ≈ 111km * cos(latitude)
  const latOffset = (distance * Math.cos(bearingRad)) / 111000;
  const lngOffset = (distance * Math.sin(bearingRad)) / (111000 * LISBON_LAT_FACTOR);
  
  return [
    pos[0] + lngOffset,
    pos[1] + latOffset
  ];
}

/**
 * Calculate distance between two coordinates (Haversine)
 * @param {[number, number]} a - [lng, lat]
 * @param {[number, number]} b - [lng, lat]
 * @returns {number} Distance in meters
 */
export function haversineDistance(a, b) {
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const deltaLat = (b[1] - a[1]) * Math.PI / 180;
  const deltaLon = (b[0] - a[0]) * Math.PI / 180;

  const sinDLat2 = Math.sin(deltaLat / 2);
  const sinDLon2 = Math.sin(deltaLon / 2);
  
  const aa = sinDLat2 * sinDLat2 + 
             Math.cos(lat1) * Math.cos(lat2) * sinDLon2 * sinDLon2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return EARTH_RADIUS * c;
}

/**
 * Calculate bearing from point a to point b
 * @param {[number, number]} a - [lng, lat] from
 * @param {[number, number]} b - [lng, lat] to
 * @returns {number} Bearing in degrees (0-360)
 */
export function bearingBetween(a, b) {
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - 
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two coordinates
 */
export function lerpCoords(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t)
  ];
}

/**
 * Angle interpolation (handles 359° → 0° wrap)
 */
export function lerpAngle(a, b, t) {
  const diff = ((b - a + 180) % 360) - 180;
  return a + diff * t;
}

/**
 * Clamp value to range
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Check if position is within Lisbon bounds
 */
export function isInLisbonBounds(pos) {
  const [lng, lat] = pos;
  return lng >= LISBON_BOUNDS.west && 
         lng <= LISBON_BOUNDS.east && 
         lat >= LISBON_BOUNDS.south && 
         lat <= LISBON_BOUNDS.north;
}

/**
 * Clamp position to Lisbon bounds
 */
export function clampToLisbonBounds(pos) {
  return [
    clamp(pos[0], LISBON_BOUNDS.west, LISBON_BOUNDS.east),
    clamp(pos[1], LISBON_BOUNDS.south, LISBON_BOUNDS.north)
  ];
}

// ============================================
// MATH UTILITIES
// ============================================

/**
 * Degrees to radians
 */
export function toRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Radians to degrees
 */
export function toDeg(rad) {
  return rad * 180 / Math.PI;
}

/**
 * Normalize angle to 0-360
 */
export function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

/**
 * Shortest angle difference
 */
export function angleDifference(a, b) {
  const diff = ((b - a + 180) % 360) - 180;
  return diff < -180 ? diff + 360 : diff;
}

/**
 * Average multiple angles
 */
export function averageAngle(angles) {
  let sinSum = 0;
  let cosSum = 0;
  
  for (const angle of angles) {
    const rad = toRad(angle);
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  
  return normalizeAngle(toDeg(Math.atan2(sinSum, cosSum)));
}

// ============================================
// VECTOR UTILITIES
// ============================================

/**
 * Create a 2D vector
 */
export function vec2(x, y) {
  return { x, y };
}

/**
 * Vector magnitude
 */
export function vecMag(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Vector normalization
 */
export function vecNormalize(v) {
  const mag = vecMag(v);
  if (mag === 0) return vec2(0, 0);
  return vec2(v.x / mag, v.y / mag);
}

/**
 * Vector dot product
 */
export function vecDot(a, b) {
  return a.x * b.x + a.y * b.y;
}

/**
 * Distance from point to line segment
 */
export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Closest point on line segment
 */
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  if (param < 0) {
    return { x: x1, y: y1 };
  } else if (param > 1) {
    return { x: x2, y: y2 };
  }

  return {
    x: x1 + param * C,
    y: y1 + param * D
  };
}

// ============================================
// TILE UTILITIES
// ============================================

/**
 * Convert coordinate to tile index
 */
export function coordToTile(lng, lat, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y, z: zoom };
}

/**
 * Convert tile to coordinate (NW corner)
 */
export function tileToCoord(x, y, z) {
  const n = Math.pow(2, z);
  const lng = x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = latRad * 180 / Math.PI;
  return [lng, lat];
}

// ============================================
// DEBUG UTILITIES
// ============================================

/**
 * Format coordinate for display
 */
export function formatCoord(pos, precision = 6) {
  return `[${pos[0].toFixed(precision)}, ${pos[1].toFixed(precision)}]`;
}

/**
 * Format speed for display
 */
export function formatSpeed(kmh) {
  return `${Math.round(kmh)} km/h`;
}

/**
 * Format distance for display
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Throttle function execution
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Debounce function execution
 */
export function debounce(fn, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ============================================
// RANDOM UTILITIES
// ============================================

/**
 * Random number between min and max
 */
export function random(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random choice from array
 */
export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  LISBON_CENTER,
  LISBON_BOUNDS,
  projectCoordinate,
  haversineDistance,
  bearingBetween,
  lerp,
  lerpCoords,
  lerpAngle,
  clamp,
  isInLisbonBounds,
  clampToLisbonBounds,
  toRad,
  toDeg,
  normalizeAngle,
  angleDifference,
  averageAngle,
  coordToTile,
  tileToCoord,
  formatCoord,
  formatSpeed,
  formatDistance,
  throttle,
  debounce,
  random,
  randomInt,
  randomChoice
};
