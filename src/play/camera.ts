import { type PerspectiveCamera, Vector3 } from 'three';
import { type CollisionMap, distanceAt, floorAt } from './collision';
import type { Vehicle } from './vehicle';

export type CameraMode = 'chase' | 'far' | 'bumper';
export const CAMERA_MODES: readonly CameraMode[] = ['chase', 'far', 'bumper'];

/**
 * Chase camera for a narrow street: it trails the direction of travel with a little lag, looks ahead more as speed
 * builds, widens its field of view with speed, never leaves the street (it slides in toward the car instead of
 * clipping into a façade), stays above the cobbles on the hill, and shakes briefly on knocks.
 */
export class ChaseCamera {
  mode: CameraMode = 'chase';
  private readonly position = new Vector3();
  private readonly velocity = new Vector3();
  private readonly look = new Vector3();
  private heading = 0;
  private shake = 0;
  private time = 0;
  private placed = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly map: CollisionMap
  ) {}

  bump(strength: number): void {
    this.shake = Math.min(0.35, this.shake + strength);
  }

  snap(): void {
    this.placed = false;
  }

  update(car: Vehicle, dt: number): void {
    this.time += dt;
    const speed = Math.abs(car.speed);
    // Trail the direction of travel when moving forward, the car's nose otherwise.
    const travel = speed > 1.5 && car.speed > 0 ? Math.atan2(-car.vx, -car.vz) : car.yaw;
    if (!this.placed) this.heading = car.yaw;
    this.heading += wrap(travel - this.heading) * Math.min(1, dt * (this.mode === 'bumper' ? 12 : 3.2));
    const fwd = new Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));

    const carPos = new Vector3(car.x, car.y, car.z);
    let desired: Vector3;
    let look: Vector3;
    if (this.mode === 'bumper') {
      const nose = new Vector3(-Math.sin(car.yaw), 0, -Math.cos(car.yaw));
      desired = carPos.clone().addScaledVector(nose, car.spec.length * 0.18).add(new Vector3(0, 1.25 + car.pitch * 1.4, 0));
      look = desired.clone().addScaledVector(nose, 20).add(new Vector3(0, Math.sin(car.pitch) * 20 - 0.6, 0));
    } else {
      const far = this.mode === 'far';
      const distance = (far ? 9.5 : 6.4) + Math.min(speed, 16) * (far ? 0.14 : 0.1);
      const height = (far ? 3.6 : 2.35) + Math.min(speed, 16) * 0.03;
      desired = carPos.clone().addScaledVector(fwd, -distance).add(new Vector3(0, height, 0));
      look = carPos.clone().addScaledVector(fwd, 3 + Math.min(speed, 16) * 0.35).add(new Vector3(0, 1.0, 0));
      // On the hill the street ahead drops away: look down it rather than over it.
      const ahead = floorAt(this.map, look.x, look.z);
      if (ahead !== null) look.y = Math.min(look.y, ahead + 1.2);
      desired = this.keepInStreet(carPos.clone().add(new Vector3(0, 1.4, 0)), desired);
      const below = floorAt(this.map, desired.x, desired.z);
      if (below !== null) desired.y = Math.max(desired.y, below + 1.5);
    }

    if (!this.placed) {
      this.position.copy(desired);
      this.velocity.set(0, 0, 0);
      this.look.copy(look);
      this.placed = true;
    } else if (this.mode === 'bumper') {
      this.position.copy(desired);
      this.look.lerp(look, Math.min(1, dt * 14));
    } else {
      // Critically damped spring: firm enough to feel attached, soft enough to read the motion.
      const w = 7.5;
      const accel = desired.clone().sub(this.position).multiplyScalar(w * w).addScaledVector(this.velocity, -2 * w);
      this.velocity.addScaledVector(accel, dt);
      this.position.addScaledVector(this.velocity, dt);
      this.look.lerp(look, Math.min(1, dt * 9));
    }

    this.camera.position.copy(this.position);
    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.position.add(new Vector3(Math.sin(this.time * 53) * s * 0.3, Math.sin(this.time * 71 + 1) * s * 0.25, Math.sin(this.time * 61 + 2) * s * 0.2));
      this.shake *= Math.exp(-dt * 9);
    }
    const fov = (this.mode === 'bumper' ? 66 : 58) + Math.min(speed, 18) * 0.75;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look);
  }

  /** Slides the camera in toward the car until it is at least 0.4 m clear of every façade. */
  private keepInStreet(anchor: Vector3, desired: Vector3): Vector3 {
    const clear = (p: Vector3): boolean => distanceAt(this.map, p.x, p.z) > 0.4;
    if (clear(desired)) return desired;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (clear(anchor.clone().lerp(desired, mid))) lo = mid;
      else hi = mid;
    }
    const result = anchor.clone().lerp(desired, lo);
    // Lift a little as it closes in, so the car stays in view over its roof.
    result.y += (1 - lo) * 1.2;
    return result;
  }
}

function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
