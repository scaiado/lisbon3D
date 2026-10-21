import { type Object3D, type PerspectiveCamera, Vector3 } from 'three';
import { groundHeight } from './assets';

export type ProofView = 'chase' | 'carside' | 'facade' | 'establish';
export const PROOF_VIEWS: readonly ProofView[] = ['chase', 'carside', 'facade', 'establish'];

export interface ViewPose {
  position: Vector3;
  target: Vector3;
  fov: number;
  /** Distance to keep sharp when depth of field is on. */
  focus: number;
}

/** Where the microcar waits: at the top of the Bica, just right of the rails, nose down the hill (-Z). */
export const CAR_SPOT = { x: 1.1, z: -7 } as const;

/**
 * Places the microcar on the slope: height from the street surface under each axle, pitch from their difference.
 */
export function placeMicrocar(car: Object3D, street: Object3D): void {
  // Axle spacing of art/blender/lisbon/microcar.py; only the pitch depends on it.
  const wheelbase = 1.6;
  const rear = groundHeight(street, CAR_SPOT.x, CAR_SPOT.z + wheelbase / 2);
  const front = groundHeight(street, CAR_SPOT.x, CAR_SPOT.z - wheelbase / 2);
  car.position.set(CAR_SPOT.x, (rear + front) / 2, CAR_SPOT.z);
  // Facing -Z, a negative X rotation lowers the nose.
  car.rotation.set(Math.atan2(front - rear, wheelbase), 0, 0);
}

/** The three review views from plan.md §5. The chase view follows the parked microcar. */
export function viewPose(view: ProofView, car: Object3D): ViewPose {
  if (view === 'chase') {
    // Camera on the street centreline behind and above the car, so the car sits right of centre and the
    // street, funicular and river stay open down the middle, as in the style frame.
    const position = car.position.clone().add(new Vector3(-1.1, 2.6, 5.6));
    const target = car.position.clone().add(new Vector3(-1.1, -6.5, -40));
    return { position, target, fov: 55, focus: 6 };
  }
  if (view === 'carside') {
    // Side profile from the far pavement at waist height (the Bica is only 6 m wide, so the camera cannot back
    // further off), with the right-hand façades behind the car.
    const position = car.position.clone().add(new Vector3(-3.7, 0.85, 0.1));
    const target = car.position.clone().add(new Vector3(0, 0.9, 0.1));
    return { position, target, fov: 44, focus: 3.7 };
  }
  const fixed = FIXED_VIEWS[view];
  return { position: new Vector3(...fixed.position), target: new Vector3(...fixed.target), fov: fixed.fov, focus: fixed.focus };
}

/**
 * The façade and establishing views match the Blender target renders (art/blender/lisbon/scene_setup.py VIEWS,
 * converted from Blender Z-up to glTF Y-up: x, z, -y), so in-browser and Blender images compare one to one.
 */
const FIXED_VIEWS: Record<Exclude<ProofView, 'chase' | 'carside'>, { position: Vec3; target: Vec3; fov: number; focus: number }> = {
  facade: { position: [1.3, 0.41, -9.2], target: [-3.1, 1.16, -14.6], fov: 50, focus: 7 },
  establish: { position: [9, 26, 16], target: [-1, -4, -90], fov: 45, focus: 90 }
};

type Vec3 = [number, number, number];

export function applyPose(camera: PerspectiveCamera, pose: ViewPose): void {
  camera.position.copy(pose.position);
  camera.fov = pose.fov;
  camera.lookAt(pose.target);
  camera.updateProjectionMatrix();
}
