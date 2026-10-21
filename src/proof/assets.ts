import { Box3, Mesh, type Material, type Object3D, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const PROOF_ASSETS = {
  street: 'assets/proof/bica.glb',
  microcar: 'assets/proof/microcar.glb'
} as const;

export interface ProofAssets {
  street: Object3D;
  microcar: Object3D;
  /** Download size of each file in bytes, as reported by the network (0 if unknown). */
  bytes: Record<keyof typeof PROOF_ASSETS, number>;
}

/** Loads the Blender exports (compressed by tools/optimize-proof-assets.mjs) and prepares them for lighting. */
export async function loadProofAssets(base: string): Promise<ProofAssets> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const load = async (path: string): Promise<{ scene: Object3D; bytes: number }> => {
    let bytes = 0;
    const gltf = await loader.loadAsync(`${base}${path}`, (event) => {
      bytes = event.total || event.loaded;
    });
    prepare(gltf.scene);
    return { scene: gltf.scene, bytes };
  };
  const [street, microcar] = await Promise.all([load(PROOF_ASSETS.street), load(PROOF_ASSETS.microcar)]);
  return { street: street.scene, microcar: microcar.scene, bytes: { street: street.bytes, microcar: microcar.bytes } };
}

/** Every mesh casts and receives sun shadows; painted backdrop cards do neither and ignore the haze tint. */
function prepare(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const backdrop = hasAncestorNamed(object, 'backdrop');
    object.castShadow = !backdrop;
    object.receiveShadow = !backdrop;
    if (backdrop) {
      for (const material of materials(object)) {
        if ('fog' in material) material.fog = false;
      }
    }
  });
}

function hasAncestorNamed(object: Object3D, prefix: string): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node.name.toLowerCase().startsWith(prefix)) return true;
  }
  return false;
}

function materials(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

const down = new Vector3(0, -1, 0);
const raycaster = new Raycaster();

/** Height of the street surface under a point, found by casting down onto the street model. */
export function groundHeight(street: Object3D, x: number, z: number, fallback = 0): number {
  const top = new Box3().setFromObject(street).max.y + 5;
  raycaster.set(new Vector3(x, top, z), down);
  const hit = raycaster.intersectObject(street, true).find((candidate) => !hasAncestorNamed(candidate.object, 'backdrop'));
  return hit ? hit.point.y : fallback;
}
