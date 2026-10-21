import { Box3, type Object3D, type PerspectiveCamera, Vector3 } from 'three';
import { groundHeight } from './assets';

export type ProofView = 'chase' | 'facade' | 'establish';
export const PROOF_VIEWS: readonly ProofView[] = ['chase', 'facade', 'establish'];

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
  const wheelbase = 1.7;
  const rear = groundHeight(street, CAR_SPOT.x, CAR_SPOT.z + wheelbase / 2);
  const front = groundHeight(street, CAR_SPOT.x, CAR_SPOT.z - wheelbase / 2);
  car.position.set(CAR_SPOT.x, (rear + front) / 2, CAR_SPOT.z);
  // Facing -Z, a negative X rotation lowers the nose.
  car.rotation.set(Math.atan2(front - rear, wheelbase), 0, 0);
}

/** The three review views from plan.md §5, derived from the actual exported geometry. */
export function viewPose(view: ProofView, street: Object3D, car: Object3D): ViewPose {
  if (view === 'chase') {
    const position = car.position.clone().add(new Vector3(0, 2.1, 5.2));
    const target = car.position.clone().add(new Vector3(0, -2.5, -26));
    return { position, target, fov: 55, focus: 5.6 };
  }
  if (view === 'facade') return facadePose(street);
  const bounds = namedChildren(street, 'building').length > 0 ? groupBounds(street, 'building') : new Box3().setFromObject(street);
  const top = groundHeight(street, 0, 0);
  const position = new Vector3(9, Math.max(bounds.max.y + 6, top + 26), 16);
  const target = new Vector3(0, top - 30, -150);
  return { position, target, fov: 50, focus: 60 };
}

/** Stands on the far pavement, three-quarter view of the left-hand building nearest 25 m down the street. */
function facadePose(street: Object3D): ViewPose {
  const buildings = namedChildren(street, 'building');
  const wanted = -25;
  let best: Box3 | null = null;
  for (const building of buildings) {
    const box = new Box3().setFromObject(building);
    const center = box.getCenter(new Vector3());
    if (center.x >= 0) continue;
    const bestCenter = best?.getCenter(new Vector3());
    if (!bestCenter || Math.abs(center.z - wanted) < Math.abs(bestCenter.z - wanted)) best = box;
  }
  const face = best ? new Vector3(best.max.x, 0, best.getCenter(new Vector3()).z) : new Vector3(-3, 0, wanted);
  const across = face.x + 5.5;
  const standZ = face.z + 4;
  const eye = groundHeight(street, across, standZ) + 1.6;
  const target = new Vector3(face.x, groundHeight(street, face.x + 0.5, face.z) + 4.2, face.z - 1);
  const position = new Vector3(across, eye, standZ);
  return { position, target, fov: 50, focus: position.distanceTo(target) };
}

function namedChildren(root: Object3D, prefix: string): Object3D[] {
  const found: Object3D[] = [];
  root.traverse((object) => {
    if (object.name.toLowerCase().startsWith(prefix) && !object.parent?.name.toLowerCase().startsWith(prefix)) found.push(object);
  });
  return found;
}

function groupBounds(root: Object3D, prefix: string): Box3 {
  const box = new Box3();
  for (const child of namedChildren(root, prefix)) box.expandByObject(child);
  return box;
}

export function applyPose(camera: PerspectiveCamera, pose: ViewPose): void {
  camera.position.copy(pose.position);
  camera.fov = pose.fov;
  camera.lookAt(pose.target);
  camera.updateProjectionMatrix();
}
