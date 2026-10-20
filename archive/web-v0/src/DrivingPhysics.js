/**
 * Driving Physics System for Lisbon 3D
 * 
 * Realistic yet fun driving physics with:
 * - Speed-based turning radius
 * - Acceleration/deceleration curves
 * - Terrain slope effects
 * - Speed governor
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

import { projectCoordinate, clamp, lerp, lerpAngle } from './utils.js';

// ============================================
// PHYSICS CONSTANTS
// ============================================

export const PHYSICS = {
  // Acceleration (km/h per second)
  ACCELERATION: {
    base: 12,           // Normal acceleration
    sport: 18,          // Sport mode multiplier
    uphillPenalty: 0.6, // 40% slower going uphill
    downhillBonus: 1.3, // 30% faster going downhill
    reverse: 8          // Reversing
  },

  // Braking (km/h per second)
  BRAKING: {
    normal: 20,
    emergency: 40,
    offroad: 10
  },

  // Friction / natural deceleration
  FRICTION: {
    road: 0.8,          // Coasting slowdown on road
    offroad: 3.5,       // Fast slowdown off-road
    air: 0.2            // Air resistance at high speeds
  },

  // Turning physics
  TURNING: {
    baseRadius: 25,     // Minimum turn radius at low speed (meters)
    speedFactor: 0.35,  // How speed increases radius
    maxSteeringAngle: 40, // Max wheel angle (degrees)
    returnSpeed: 4,     // How fast steering centers (degrees/sec)
    speedSteeringReduction: 0.5 // Less steering at high speeds
  },

  // Car dimensions (meters)
  CAR: {
    length: 4.2,
    width: 1.8,
    height: 1.4,
    wheelbase: 2.6,
    trackWidth: 1.6,
    weight: 1500        // kg (for future physics)
  },

  // Safety limits
  LIMITS: {
    maxSpeed: 200,      // Absolute speed cap (km/h)
    physicsExplosion: 500 // Indicates bug if exceeded
  }
};

/**
 * Driving Physics Engine
 */
export class DrivingPhysics {
  constructor() {
    this.reset();
  }

  /**
   * Reset physics state
   */
  reset() {
    this.state = {
      speed: 0,           // km/h (positive = forward, negative = reverse)
      bearing: -20,       // degrees (0 = north, clockwise)
      steeringAngle: 0,   // degrees (-40 to 40)
      position: null,     // [lng, lat]
      
      // Internal
      gear: 'neutral',    // 'forward', 'reverse', 'neutral'
      engineRPM: 0,
      wheelSpin: 0
    };
    
    this.history = [];   // For debug/rewind
    this.lastValidState = null;
  }

  /**
   * Main physics update
   * @param {Object} input - { throttle, brake, steer, reverse }
   * @param {number} dt - Delta time in seconds
   * @param {Object} env - { speedLimit, slope, onRoad, roadType }
   * @returns {Object} Updated state
   */
  update(input, dt, env) {
    const state = this.state;
    
    // === GEAR SELECTION ===
    if (input.reverse && state.speed < 5) {
      state.gear = 'reverse';
    } else if (input.throttle && state.speed >= -5) {
      state.gear = 'forward';
    } else if (Math.abs(state.speed) < 1) {
      state.gear = 'neutral';
    }

    // === ACCELERATION ===
    let acceleration = 0;
    
    if (input.throttle && state.gear === 'forward') {
      acceleration = PHYSICS.ACCELERATION.base;
      
      // Apply terrain modifiers
      if (env.slope) {
        if (env.slope.isUphill) {
          const gradeFactor = Math.max(0.3, 1 - env.slope.grade * 2);
          acceleration *= PHYSICS.ACCELERATION.uphillPenalty * gradeFactor;
        } else if (env.slope.grade < -0.03) {
          // Downhill - gravity helps
          acceleration *= PHYSICS.ACCELERATION.downhillBonus;
        }
      }
    } else if (input.throttle && state.gear === 'reverse') {
      acceleration = -PHYSICS.ACCELERATION.reverse;
    }

    // === BRAKING ===
    let braking = 0;
    if (input.brake) {
      braking = PHYSICS.BRAKING.normal;
    }

    // === FRICTION ===
    const frictionType = env.onRoad ? 'road' : 'offroad';
    let friction = PHYSICS.FRICTION[frictionType];
    
    // Air resistance increases with speed squared
    const airResistance = PHYSICS.FRICTION.air * (state.speed / 100) ** 2;
    friction += airResistance;

    // === SPEED UPDATE ===
    const netForce = acceleration - (Math.sign(state.speed) * braking) - 
                     (Math.sign(state.speed) * friction);
    
    state.speed += netForce * dt;
    
    // Stop completely when very slow
    if (Math.abs(state.speed) < 0.5) {
      state.speed = 0;
    }

    // === SPEED LIMITING ===
    // Apply road speed limit
    const limit = env.speedLimit || 50;
    state.speed = clamp(state.speed, -30, limit); // -30 reverse, limit forward
    
    // Absolute safety cap
    state.speed = clamp(state.speed, -PHYSICS.LIMITS.maxSpeed, PHYSICS.LIMITS.maxSpeed);

    // === STEERING PHYSICS ===
    
    // Input steering (-1 to 1)
    const targetSteering = clamp(input.steer || 0, -1, 1);
    
    // Steering is less effective at high speeds
    const speedFactor = 1 - (Math.abs(state.speed) / 200) * PHYSICS.TURNING.speedSteeringReduction;
    
    // Update steering angle with smooth transition
    const maxSteering = PHYSICS.TURNING.maxSteeringAngle * speedFactor;
    const targetAngle = targetSteering * maxSteering;
    
    const steerSpeed = PHYSICS.TURNING.returnSpeed * dt * 60;
    state.steeringAngle = lerp(state.steeringAngle, targetAngle, Math.min(1, steerSpeed));

    // === TURNING RADIUS ===
    
    // Calculate actual turn radius based on speed and steering
    const absSpeed = Math.abs(state.speed);
    const minRadius = PHYSICS.TURNING.baseRadius + (absSpeed * PHYSICS.TURNING.speedFactor);
    
    // Turn radius from steering angle
    if (Math.abs(state.steeringAngle) > 0.1) {
      const steeringRad = (state.steeringAngle * Math.PI) / 180;
      const turnRadius = minRadius / Math.abs(Math.sin(steeringRad));
      
      // Calculate angular velocity (degrees per second)
      const speedMps = absSpeed / 3.6;
      const angularVelocity = (speedMps / turnRadius) * (180 / Math.PI);
      
      // Apply rotation
      const turnDirection = Math.sign(state.steeringAngle);
      const reverseMult = state.speed < 0 ? -1 : 1; // Reverse steering when going backward
      
      state.bearing += angularVelocity * dt * turnDirection * reverseMult;
    }

    // Normalize bearing
    state.bearing = ((state.bearing % 360) + 360) % 360;

    // === POSITION UPDATE ===
    if (state.speed !== 0 && state.position) {
      const speedMps = state.speed / 3.6;
      const moveDistance = speedMps * dt;
      
      // Project new position
      state.position = projectCoordinate(
        state.position, 
        state.bearing, 
        moveDistance
      );
    }

    // === SAFETY CHECKS ===
    if (isNaN(state.speed) || Math.abs(state.speed) > PHYSICS.LIMITS.physicsExplosion) {
      console.error('Physics explosion! Resetting.');
      this.reset();
      state.position = this.lastValidState?.position || null;
    }

    // Save valid state for recovery
    if (!isNaN(state.speed) && state.position) {
      this.lastValidState = { ...state };
    }

    // Store history
    this.history.push({ ...state, timestamp: performance.now() });
    if (this.history.length > 100) this.history.shift();

    return state;
  }

  /**
   * Get braking distance for current speed
   */
  getBrakingDistance() {
    const speedMps = Math.abs(this.state.speed) / 3.6;
    return (speedMps ** 2) / (2 * PHYSICS.BRAKING.normal);
  }

  /**
   * Get recommended speed for a turn radius
   */
  getSpeedForTurnRadius(radiusMeters) {
    // Comfortable lateral acceleration ~3 m/s²
    const maxLateralAcc = 3;
    const maxSpeed = Math.sqrt(radiusMeters * maxLateralAcc);
    return maxSpeed * 3.6; // km/h
  }

  /**
   * Check if car can make a turn at current speed
   */
  canMakeTurn(radiusMeters) {
    const recommendedSpeed = this.getSpeedForTurnRadius(radiusMeters);
    return Math.abs(this.state.speed) <= recommendedSpeed * 1.2; // 20% tolerance
  }

  /**
   * Get state summary
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set position externally (e.g., after constraint)
   */
  setPosition(pos) {
    this.state.position = [...pos];
  }

  /**
   * Set bearing externally
   */
  setBearing(bearing) {
    this.state.bearing = bearing;
  }

  /**
   * Debug info
   */
  getDebugInfo() {
    return {
      speed: this.state.speed.toFixed(1),
      bearing: this.state.bearing.toFixed(1),
      steering: this.state.steeringAngle.toFixed(1),
      gear: this.state.gear,
      brakingDistance: this.getBrakingDistance().toFixed(1)
    };
  }
}

export default DrivingPhysics;
