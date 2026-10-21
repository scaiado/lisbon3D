import { type Object3D, type PerspectiveCamera, Vector3 } from 'three';
import { groundHeight } from './assets';

export type ProofView = 'chase' | 'carfront' | 'carside' | 'carrear' | 'facade' | 'establish';
export const PROOF_VIEWS: readonly ProofView[] = ['chase', 'carfront', 'carside', 'carrear', 'facade', 'establish'];

export interface ViewPose {
  position: Vector3;
  target: Vector3;
  fov: number;
  /** Distance to keep sharp when depth of field is on. */
  focus: number;
}

/**
 * Where the car waits: at the top of the Bica, nose down the hill (-Z), its left wheels on the funicular rail as
 * cars do on the real street (the road is ±1.7 m, too narrow for a 1.62 m wide car beside the rails).
 */
export const CAR_SPOT = { x: 0.85, z: -7 } as const;

/**
 * Places the microcar on the slope: height from the street surface under each axle, pitch from their difference.
 */
export function placeMicrocar(car: Object3D, street: Object3D): void {
  // Axle spacing of art/blender/lisbon/microcar.py; only the pitch depends on it.
  const wheelbase = 2.4;
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
  if (view === 'carfront') {
    // Front three-quarter from down the hill on the left, at about eye height above the lower street.
    const position = car.position.clone().add(new Vector3(-2.9, 0.7, -5.9));
    const target = car.position.clone().add(new Vector3(0, 0.6, 0));
    return { position, target, fov: 42, focus: 6.5 };
  }
  if (view === 'carrear') {
    // Rear view from up the hill, a little left of the car's centreline so the hatch and one side both read.
    const position = car.position.clone().add(new Vector3(-0.9, 2.2, 6.0));
    const target = car.position.clone().add(new Vector3(0, 0.7, 0));
    return { position, target, fov: 40, focus: 5.5 };
  }
  if (view === 'carside') {
    // Side profile from the far pavement at waist height (the Bica is only 6 m wide, so the camera cannot back
    // further off), with the right-hand façades behind the car.
    const position = car.position.clone().add(new Vector3(-3.5, 0.9, -0.1));
    const target = car.position.clone().add(new Vector3(0, 0.75, -0.1));
    return { position, target, fov: 54, focus: 3.5 };
  }
  const fixed = FIXED_VIEWS[view];
  return { position: new Vector3(...fixed.position), target: new Vector3(...fixed.target), fov: fixed.fov, focus: fixed.focus };
}

/**
 * The façade and establishing views match the Blender target renders (art/blender/lisbon/scene_setup.py VIEWS,
 * converted from Blender Z-up to glTF Y-up: x, z, -y), so in-browser and Blender images compare one to one.
 */
const FIXED_VIEWS: Record<'facade' | 'establish', { position: Vec3; target: Vec3; fov: number; focus: number }> = {
  facade: { position: [1.3, 0.41, -9.2], target: [-3.1, 1.16, -14.6], fov: 50, focus: 7 },
  establish: { position: [-30, 48, 40], target: [115, -49, -320], fov: 40, focus: 120 }
};

type Vec3 = [number, number, number];

export function applyPose(camera: PerspectiveCamera, pose: ViewPose): void {
  camera.position.copy(pose.position);
  camera.fov = pose.fov;
  camera.lookAt(pose.target);
  camera.updateProjectionMatrix();
}
