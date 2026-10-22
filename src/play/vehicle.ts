import { type CollisionMap, awayFrom, distanceAt, floorAt } from './collision';

/**
 * Arcade car handling tuned for a narrow, steep, cobbled street: quick steering that calms down with speed, strong
 * electric pull-away, gravity along the slope, an EV hold on hills, a body that rides on four sampled wheel contacts
 * (so steps and kerbs pitch and roll it), and collisions that slide along walls instead of stopping dead.
 *
 * Axes are glTF/three: x east, y up, z south. A heading (yaw) of 0 faces -z, down the Bica.
 */
export interface CarSpec {
  wheelbase: number;
  track: number;
  wheelRadius: number;
  length: number;
  width: number;
  /** Signed offset of the body's centre along the car from the axle midpoint (+ toward the nose). */
  centreOffset: number;
}

export interface DriveInput {
  throttle: number;
  /** Brake, then reverse once stopped. */
  brake: number;
  /** -1 left .. +1 right. */
  steer: number;
  handbrake: boolean;
}

export interface Impact {
  speed: number;
  x: number;
  z: number;
  kind: 'wall' | 'landing' | 'funicular';
}

/** Something moving the car can hit: an oriented box on the ground plane. */
export interface MovingObstacle {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  /** Velocity along z (m/s). */
  vz: number;
}

const G = 9.81;
const TUNING = {
  topSpeed: 17,
  reverseSpeed: 5.5,
  accel: 6.8,
  brake: 12,
  reverseAccel: 4,
  drag: 0.011,
  rolling: 0.35,
  maxSteer: 0.62,
  steerRate: 7,
  steerReturn: 10,
  grip: 14,
  handbrakeGrip: 2.2,
  suspension: 15,
  damping: 0.75
};

export class Vehicle {
  x = 0;
  z = 0;
  /** Body ride height (y of the axle-midpoint ground reference). */
  y = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  steer = 0;
  pitch = 0;
  roll = 0;
  /** Forward speed (m/s, negative when reversing). */
  speed = 0;
  /** Longitudinal acceleration of the last step, for body squat and dive. */
  accel = 0;
  wheelSpin = 0;
  braking = false;
  reversing = false;
  airborne = false;
  /** Wheel contact heights from the last step, for dust and sound. */
  readonly contacts = [0, 0, 0, 0];
  readonly impacts: Impact[] = [];

  private pitchRate = 0;
  private rollRate = 0;

  constructor(
    readonly spec: CarSpec,
    private readonly map: CollisionMap
  ) {}

  place(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.vx = this.vz = this.vy = this.steer = this.speed = this.accel = 0;
    this.pitchRate = this.rollRate = 0;
    const ground = this.ground();
    this.y = ground.height;
    this.pitch = ground.pitch;
    this.roll = ground.roll;
  }

  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  step(dt: number, input: DriveInput, obstacles: readonly MovingObstacle[] = []): void {
    const fwd = this.forward();
    const right = { x: -fwd.z, z: fwd.x };
    let vf = this.vx * fwd.x + this.vz * fwd.z;
    let vl = this.vx * right.x + this.vz * right.z;

    // Steering: fast in, faster back to centre, and less lock at speed so the car stays planted.
    const lock = TUNING.maxSteer / (1 + (vf * vf) / 160);
    const target = Math.max(-1, Math.min(1, input.steer)) * lock;
    const rate = Math.abs(target) > Math.abs(this.steer) && Math.sign(target) === Math.sign(this.steer || target) ? TUNING.steerRate : TUNING.steerReturn;
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));

    // Longitudinal: motor, brakes, reverse, drag, and gravity along the slope.
    const ground = this.ground();
    let a = -G * Math.sin(ground.pitch);
    this.braking = false;
    if (input.throttle > 0 && vf > -0.5) {
      const fade = Math.max(0, 1 - Math.max(0, vf) / TUNING.topSpeed);
      a += input.throttle * TUNING.accel * Math.sqrt(fade);
    } else if (input.throttle > 0) {
      a += input.throttle * TUNING.brake;
      this.braking = true;
    }
    if (input.brake > 0) {
      if (vf > 0.4) {
        a -= input.brake * TUNING.brake;
        this.braking = true;
      } else if (vf > -TUNING.reverseSpeed) {
        a -= input.brake * TUNING.reverseAccel * (vf > 0 ? 2 : 1);
      }
    }
    a -= TUNING.drag * vf * Math.abs(vf) + TUNING.rolling * Math.sign(vf) * Math.min(1, Math.abs(vf));
    if (input.handbrake) a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 5);
    const holding = input.throttle === 0 && input.brake === 0 && Math.abs(vf) < 0.35;
    if (this.airborne) a = 0;
    vf = holding ? 0 : vf + a * dt;
    this.accel = holding ? 0 : a;
    this.reversing = vf < -0.2;

    // Lateral grip pulls the velocity onto the heading; the handbrake lets the tail slide.
    const grip = this.airborne ? 0.3 : input.handbrake ? TUNING.handbrakeGrip : TUNING.grip;
    vl *= Math.exp(-grip * dt);
    const yawRate = (vf * Math.tan(this.steer)) / this.spec.wheelbase * (input.handbrake ? 1.35 : 1);
    this.yaw -= yawRate * dt;

    const nf = this.forward();
    const nr = { x: -nf.z, z: nf.x };
    this.vx = nf.x * vf + nr.x * vl;
    this.vz = nf.z * vf + nr.z * vl;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.collide(obstacles);
    this.speed = this.vx * nf.x + this.vz * nf.z;
    this.wheelSpin += (this.speed / this.spec.wheelRadius) * dt;
    this.ride(dt);
  }

  /** Circles along the body against the distance field and moving boxes: push out, slide, report impacts. */
  private collide(obstacles: readonly MovingObstacle[]): void {
    const fwd = this.forward();
    const radius = this.spec.width / 2;
    const reach = this.spec.length / 2 - radius;
    const offsets = [-reach, -reach / 3, reach / 3, reach].map((o) => o + this.spec.centreOffset);
    for (let iteration = 0; iteration < 3; iteration++) {
      let pushed = false;
      for (const offset of offsets) {
        const cx = this.x + fwd.x * offset;
        const cz = this.z + fwd.z * offset;
        const depth = radius - distanceAt(this.map, cx, cz);
        if (depth > 0) {
          const n = awayFrom(this.map, cx, cz);
          if (n.x === 0 && n.z === 0) continue;
          this.resolve(n.x, n.z, depth, cx, cz, 0, 'wall');
          pushed = true;
        }
        for (const box of obstacles) {
          const hit = circleBox(cx, cz, radius, box);
          if (hit) {
            this.resolve(hit.nx, hit.nz, hit.depth, cx, cz, box.vz * hit.nz, 'funicular');
            pushed = true;
          }
        }
      }
      if (!pushed) break;
    }
  }

  private resolve(nx: number, nz: number, depth: number, cx: number, cz: number, surfaceSpeed: number, kind: Impact['kind']): void {
    this.x += nx * depth;
    this.z += nz * depth;
    const vn = this.vx * nx + this.vz * nz - surfaceSpeed;
    if (vn >= 0) return;
    // Mostly inelastic, with some scrape along the wall.
    this.vx -= nx * vn * 1.15;
    this.vz -= nz * vn * 1.15;
    this.vx *= 0.94;
    this.vz *= 0.94;
    if (-vn > 0.8) this.impacts.push({ speed: -vn, x: cx, z: cz, kind });
  }

  /** Wheel contacts give the ride height, pitch and roll; the body follows on a damped spring and can drop. */
  private ride(dt: number): void {
    const ground = this.ground();
    if (this.y > ground.height + 0.06) {
      this.airborne = true;
      this.vy -= G * dt;
      this.y += this.vy * dt;
      if (this.y <= ground.height) {
        if (-this.vy > 1.2) this.impacts.push({ speed: -this.vy, x: this.x, z: this.z, kind: 'landing' });
        this.y = ground.height;
        this.vy = 0;
        this.airborne = false;
      }
    } else {
      this.airborne = false;
      const k = TUNING.suspension;
      const pull = (ground.height - this.y) * k * k - 2 * TUNING.damping * k * this.vy;
      this.vy += pull * dt;
      this.y += this.vy * dt;
      if (this.y < ground.height - 0.12) {
        this.y = ground.height - 0.12;
        this.vy = Math.max(this.vy, 0);
      }
    }
    // Body pitch and roll follow the ground, plus squat/dive from acceleration and lean from cornering.
    const lateral = this.speed * this.speed * Math.tan(this.steer) / this.spec.wheelbase;
    const pitchTarget = ground.pitch + this.accel * 0.0045;
    const rollTarget = ground.roll + lateral * 0.006;
    const k = 11;
    this.pitchRate += ((pitchTarget - this.pitch) * k * k - 1.2 * k * this.pitchRate) * dt;
    this.rollRate += ((rollTarget - this.roll) * k * k - 1.2 * k * this.rollRate) * dt;
    this.pitch += this.pitchRate * dt;
    this.roll += this.rollRate * dt;
  }

  /** Ground under the four wheels: mean height, pitch (nose up positive) and roll (right side up positive). */
  private ground(): { height: number; pitch: number; roll: number } {
    const fwd = this.forward();
    const right = { x: -fwd.z, z: fwd.x };
    const half = this.spec.wheelbase / 2;
    const side = this.spec.track / 2;
    const at = (along: number, across: number, index: number): number => {
      const h = floorAt(this.map, this.x + fwd.x * along + right.x * across, this.z + fwd.z * along + right.z * across);
      const value = h ?? this.contacts[index] ?? 0;
      this.contacts[index] = value;
      return value;
    };
    const fl = at(half, -side, 0);
    const fr = at(half, side, 1);
    const rl = at(-half, -side, 2);
    const rr = at(-half, side, 3);
    return {
      height: (fl + fr + rl + rr) / 4,
      pitch: Math.atan2((fl + fr - rl - rr) / 2, this.spec.wheelbase),
      roll: Math.atan2((fr + rr - fl - rl) / 2, this.spec.track)
    };
  }
}

function circleBox(cx: number, cz: number, r: number, box: MovingObstacle): { nx: number; nz: number; depth: number } | null {
  const dx = cx - box.x;
  const dz = cz - box.z;
  const px = Math.max(-box.halfX, Math.min(box.halfX, dx));
  const pz = Math.max(-box.halfZ, Math.min(box.halfZ, dz));
  const ox = dx - px;
  const oz = dz - pz;
  const d = Math.hypot(ox, oz);
  if (d > 1e-6) return d < r ? { nx: ox / d, nz: oz / d, depth: r - d } : null;
  // Centre inside the box: leave by the nearest side.
  const exitX = box.halfX - Math.abs(dx);
  const exitZ = box.halfZ - Math.abs(dz);
  return exitX < exitZ ? { nx: Math.sign(dx) || 1, nz: 0, depth: exitX + r } : { nx: 0, nz: Math.sign(dz) || 1, depth: exitZ + r };
}
