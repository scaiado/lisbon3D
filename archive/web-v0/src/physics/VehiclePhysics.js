/**
 * Vehicle Physics System - Lisbon GTA
 * Uses Cannon-es for realistic vehicle dynamics
 */

import * as CANNON from 'cannon-es';

export class VehiclePhysics {
  constructor(world) {
    this.world = world;
    this.vehicle = null;
    this.chassisBody = null;
    this.wheelBodies = [];
    this.wheelMeshes = [];
    
    // Vehicle config
    this.config = {
      chassisMass: 1500,  // kg
      wheelMass: 20,      // kg each
      maxSteer: 0.5,      // radians
      maxForce: 1500,     // engine force
      maxBrake: 1000,     // brake force
      suspensionStiffness: 30,
      suspensionDamping: 0.4,
      suspensionCompression: 0.4,
      friction: 0.8       // road friction
    };
  }

  createVehicle(position = { x: 0, y: 2, z: 0 }) {
    // Chassis body
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
    this.chassisBody = new CANNON.Body({
      mass: this.config.chassisMass,
      shape: chassisShape,
      position: new CANNON.Vec3(position.x, position.y, position.z)
    });

    // Raycast vehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    });

    // Wheel options
    const wheelOptions = {
      radius: 0.35,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: this.config.suspensionStiffness,
      suspensionRestLength: 0.3,
      frictionSlip: this.config.friction,
      dampingRelaxation: this.config.suspensionDamping,
      dampingCompression: this.config.suspensionCompression,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    // Add 4 wheels
    const wheelPositions = [
      { x: -0.8, y: 0, z: 1.2 },   // Front left
      { x: 0.8, y: 0, z: 1.2 },    // Front right
      { x: -0.8, y: 0, z: -1.2 },  // Rear left
      { x: 0.8, y: 0, z: -1.2 }    // Rear right
    ];

    wheelPositions.forEach((pos, i) => {
      wheelOptions.chassisConnectionPointLocal.set(pos.x, pos.y, pos.z);
      this.vehicle.addWheel(wheelOptions);
    });

    // Add to world
    this.vehicle.addToWorld(this.world);

    return this.vehicle;
  }

  // Controls
  accelerate(force = 1) {
    if (!this.vehicle) return;
    const maxForce = this.config.maxForce * force;
    this.vehicle.applyEngineForce(maxForce, 2); // Rear wheels
    this.vehicle.applyEngineForce(maxForce, 3);
  }

  brake(force = 1) {
    if (!this.vehicle) return;
    const brakeForce = this.config.maxBrake * force;
    this.vehicle.setBrake(brakeForce, 0);
    this.vehicle.setBrake(brakeForce, 1);
    this.vehicle.setBrake(brakeForce, 2);
    this.vehicle.setBrake(brakeForce, 3);
  }

  steer(amount = 0) {
    if (!this.vehicle) return;
    const steerAngle = -amount * this.config.maxSteer; // Inverted for natural feel
    this.vehicle.setSteeringValue(steerAngle, 0); // Front wheels
    this.vehicle.setSteeringValue(steerAngle, 1);
  }

  releaseBrake() {
    if (!this.vehicle) return;
    this.vehicle.setBrake(0, 0);
    this.vehicle.setBrake(0, 1);
    this.vehicle.setBrake(0, 2);
    this.vehicle.setBrake(0, 3);
  }

  releaseEngine() {
    if (!this.vehicle) return;
    this.vehicle.applyEngineForce(0, 2);
    this.vehicle.applyEngineForce(0, 3);
  }

  // Sync to visual mesh
  syncToMesh(chassisMesh, wheelMeshes) {
    if (!this.vehicle || !this.chassisBody) return;

    // Sync chassis
    chassisMesh.position.copy(this.chassisBody.position);
    chassisMesh.quaternion.copy(this.chassisBody.quaternion);

    // Sync wheels
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const wheelInfo = this.vehicle.wheelInfos[i];
      if (wheelMeshes[i]) {
        wheelMeshes[i].position.copy(wheelInfo.worldTransform.position);
        wheelMeshes[i].quaternion.copy(wheelInfo.worldTransform.quaternion);
      }
    }
  }

  // Get speed in km/h
  getSpeed() {
    if (!this.chassisBody) return 0;
    return this.chassisBody.velocity.length() * 3.6;
  }

  // Get heading in degrees
  getHeading() {
    if (!this.chassisBody) return 0;
    const q = this.chassisBody.quaternion;
    // Extract yaw from quaternion
    const siny = 2 * (q.w * q.y + q.z * q.x);
    const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
    return Math.atan2(siny, cosy) * (180 / Math.PI);
  }

  destroy() {
    if (this.vehicle) {
      this.vehicle.removeFromWorld(this.world);
    }
    this.vehicle = null;
    this.chassisBody = null;
  }
}
