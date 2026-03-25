/**
 * First-Person Camera System for Lisbon 3D
 * 
 * Driver's eye view with:
 * - Smooth follow with delay
 * - Dynamic FOV based on speed
 * - G-force effects (tilt on accel/brake/turn)
 * - Road vibration
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

import { projectCoordinate, lerp, lerpAngle, clamp } from './utils.js';

// Camera configuration
const CONFIG = {
  // Driver position relative to car (meters)
  DRIVER_POS: {
    height: 1.3,      // Eye level
    forward: 0.4,     // Slightly forward of center
    lateral: 0        // Centered
  },

  // Field of view
  FOV: {
    base: 70,         // Normal FOV
    speedBonus: 8,    // Additional FOV at high speed
    max: 85
  },

  // Camera behavior
  FOLLOW: {
    delay: 0.08,      // Position smoothing (seconds)
    bearingDelay: 0.05, // Rotation smoothing
    lookAhead: 15,    // Meters ahead to look
    minPitch: 5,      // First-person view (looking forward)
    maxPitch: 25      // Slight downward angle max
  },

  // Effects
  EFFECTS: {
    // G-force tilt (degrees)
    accelTilt: 2.5,
    brakeTilt: 3.5,
    turnTilt: 2,
    
    // Vibration
    vibrationAmp: 0.015,  // meters
    vibrationFreq: 12,    // Hz
    
    // Speed shake
    shakeStart: 80,       // km/h when shake begins
    shakeMax: 150         // km/h at max shake
  }
};

/**
 * First Person Camera Controller
 */
export class FirstPersonCamera {
  constructor(map) {
    this.map = map;
    
    // Current camera state
    this.currentPos = null;
    this.currentBearing = 0;
    this.currentPitch = 60;
    
    // Target state
    this.targetPos = null;
    this.targetBearing = 0;
    this.targetPitch = 60;
    
    // Timing
    this.time = 0;
    this.lastUpdate = 0;
    
    // Effect state
    this.accelTilt = 0;
    this.turnTilt = 0;
  }

  /**
   * Update camera based on car state
   * @param {Object} carState - { position, bearing, speed, steering }
   * @param {Object} input - { throttle, brake, steer }
   * @param {number} dt - Delta time
   */
  update(carState, input, dt) {
    this.time += dt;
    
    if (!carState.position) return;
    
    // Calculate driver eye position
    this.targetPos = this.calculateEyePosition(carState);
    
    // Calculate look target (ahead of car)
    const lookTarget = projectCoordinate(
      carState.position,
      carState.bearing,
      CONFIG.FOLLOW.lookAhead
    );
    
    // Target bearing looks at point ahead
    this.targetBearing = this.calculateBearing(this.targetPos, lookTarget);
    
    // Calculate pitch with effects
    this.targetPitch = this.calculateTargetPitch(carState, input, dt);
    
    // Smooth interpolation
    this.smoothUpdate(dt);
    
    // Apply to map
    this.applyToMap();
  }

  /**
   * Calculate eye position in world coordinates
   */
  calculateEyePosition(carState) {
    const bearingRad = (carState.bearing * Math.PI) / 180;
    
    // Offset from car center
    const forward = CONFIG.DRIVER_POS.forward;
    const lateral = CONFIG.DRIVER_POS.lateral;
    
    // Convert to coordinate offsets
    // At Lisbon latitude: 1° lng ≈ 86km, 1° lat ≈ 111km
    const lngOffset = (forward * Math.sin(bearingRad) + lateral * Math.cos(bearingRad)) / 86000;
    const latOffset = (forward * Math.cos(bearingRad) - lateral * Math.sin(bearingRad)) / 111000;
    
    return [
      carState.position[0] + lngOffset,
      carState.position[1] + latOffset
    ];
  }

  /**
   * Calculate target pitch with all effects
   */
  calculateTargetPitch(carState, input, dt) {
    let pitch = 60; // Base pitch
    
    // G-force effects
    if (input.throttle && carState.speed > 10) {
      // Acceleration = tilt back
      this.accelTilt = lerp(this.accelTilt, -CONFIG.EFFECTS.accelTilt, dt * 5);
    } else if (input.brake && carState.speed > 10) {
      // Braking = tilt forward
      this.accelTilt = lerp(this.accelTilt, CONFIG.EFFECTS.brakeTilt, dt * 8);
    } else {
      // Return to center
      this.accelTilt = lerp(this.accelTilt, 0, dt * 3);
    }
    
    pitch += this.accelTilt;
    
    // Turning tilt (into the turn)
    if (Math.abs(carState.steering) > 0.2) {
      const targetTurnTilt = carState.steering * CONFIG.EFFECTS.turnTilt;
      this.turnTilt = lerp(this.turnTilt, targetTurnTilt, dt * 4);
    } else {
      this.turnTilt = lerp(this.turnTilt, 0, dt * 3);
    }
    
    pitch += this.turnTilt;
    
    // Road vibration
    const vibration = Math.sin(this.time * CONFIG.EFFECTS.vibrationFreq * Math.PI * 2) * 
                      CONFIG.EFFECTS.vibrationAmp * (carState.speed / 50);
    pitch += vibration;
    
    // Speed shake (high speed instability)
    if (carState.speed > CONFIG.EFFECTS.shakeStart) {
      const shakeIntensity = (carState.speed - CONFIG.EFFECTS.shakeStart) / 
                            (CONFIG.EFFECTS.shakeMax - CONFIG.EFFECTS.shakeStart);
      const shake = (Math.random() - 0.5) * shakeIntensity * 2;
      pitch += shake;
    }
    
    return clamp(pitch, CONFIG.FOLLOW.minPitch, CONFIG.FOLLOW.maxPitch);
  }

  /**
   * Smoothly interpolate current values toward targets
   */
  smoothUpdate(dt) {
    if (!this.currentPos) {
      this.currentPos = [...this.targetPos];
      this.currentBearing = this.targetBearing;
      this.currentPitch = this.targetPitch;
      return;
    }
    
    // Position smoothing (exponential decay)
    const posLerp = 1 - Math.exp(-dt / CONFIG.FOLLOW.delay);
    this.currentPos[0] = lerp(this.currentPos[0], this.targetPos[0], posLerp);
    this.currentPos[1] = lerp(this.currentPos[1], this.targetPos[1], posLerp);
    
    // Bearing smoothing (handle wraparound)
    const bearingLerp = 1 - Math.exp(-dt / CONFIG.FOLLOW.bearingDelay);
    this.currentBearing = lerpAngle(this.currentBearing, this.targetBearing, bearingLerp);
    
    // Pitch smoothing
    const pitchLerp = 1 - Math.exp(-dt / 0.05);
    this.currentPitch = lerp(this.currentPitch, this.targetPitch, pitchLerp);
  }

  /**
   * Apply camera state to MapLibre
   */
  applyToMap() {
    if (!this.currentPos) return;
    
    // Calculate dynamic zoom based on speed
    // Higher speed = slightly wider view
    const zoom = this.calculateZoom();
    
    this.map.jumpTo({
      center: this.currentPos,
      bearing: this.currentBearing,
      pitch: this.currentPitch,
      zoom: zoom
    });
  }

  /**
   * Calculate zoom level based on speed
   */
  calculateZoom(carSpeed = 0) {
    const baseZoom = 18;
    
    // Slight zoom out at high speeds for peripheral vision
    const speedFactor = carSpeed / 120; // Normalize
    const zoomReduction = speedFactor * 0.8;
    
    return clamp(baseZoom - zoomReduction, 16, 19);
  }

  /**
   * Calculate bearing from point a to point b
   */
  calculateBearing(a, b) {
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
   * Snap to immediate position (no smoothing)
   */
  snapTo(pos, bearing, pitch = 60) {
    this.currentPos = [...pos];
    this.targetPos = [...pos];
    this.currentBearing = bearing;
    this.targetBearing = bearing;
    this.currentPitch = pitch;
    this.targetPitch = pitch;
    
    this.applyToMap();
  }

  /**
   * Get current camera state
   */
  getState() {
    return {
      position: this.currentPos,
      bearing: this.currentBearing,
      pitch: this.currentPitch
    };
  }
}

export default FirstPersonCamera;
