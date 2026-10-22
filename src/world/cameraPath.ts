import { MathUtils, Vector3, type Group, type PerspectiveCamera } from 'three';
import { STREET, streetHeight } from './lookTestScene';

/** One loop of the scripted drive: up the street, back down, with a rising crane shot at the top. */
export const PATH_PERIOD_SECONDS = 48;

const LOW_Z = STREET.startZ + 8;
const HIGH_Z = STREET.endZ - 22;
const forward = new Vector3();
const lookAt = new Vector3();

/**
 * Places the placeholder car and the chase camera for time t (seconds). Driven by wall-clock time,
 * so the path covers the same ground at any frame rate and every benchmark run sees the same views.
 * Returns the camera-to-car distance, used as the depth-of-field focus.
 */
export function applyCameraPath(t: number, car: Group, camera: PerspectiveCamera): number {
  const phase = (t % PATH_PERIOD_SECONDS) / PATH_PERIOD_SECONDS;
  const goingUp = phase < 0.5;
  const leg = goingUp ? phase * 2 : (phase - 0.5) * 2;
  const eased = MathUtils.smootherstep(leg, 0, 1);
  const z = goingUp ? MathUtils.lerp(LOW_Z, HIGH_Z, eased) : MathUtils.lerp(HIGH_Z, LOW_Z, eased);
  const weave = Math.sin(t * 0.7) * 1.1;

  const heading = goingUp ? 0 : Math.PI;
  const y = streetHeight(z);
  const ahead = streetHeight(z + (goingUp ? 1 : -1));
  car.position.set(weave + (goingUp ? 1.6 : -1.6), y, z);
  car.rotation.set(-Math.atan(ahead - y) * (goingUp ? 1 : -1), heading, 0);

  forward.set(Math.sin(heading), 0, Math.cos(heading));
  // Crane up near the top of each leg, so wide views (more draw calls, more sky) are in every run.
  const crane = Math.pow(Math.sin(leg * Math.PI), 6);
  const back = 6.2 + crane * 10;
  const height = 2.3 + crane * 14;

  camera.position.copy(car.position).addScaledVector(forward, -back);
  camera.position.y = Math.max(camera.position.y, streetHeight(camera.position.z)) + height;
  lookAt.copy(car.position).addScaledVector(forward, 4).setY(car.position.y + 0.9);
  camera.lookAt(lookAt);

  return camera.position.distanceTo(car.position);
}
