import { Box3, Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, type Material, type Object3D, Raycaster, type Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { PROOF_LOOK } from './look';

export const PROOF_ASSETS = {
  street: 'assets/proof/bica.glb',
  microcar: 'assets/play/player_car.glb'
} as const;

export interface ProofAssets {
  street: Object3D;
  microcar: Object3D;
  /** Download size of each file in bytes, as reported by the network (0 if unknown). */
  bytes: Record<keyof typeof PROOF_ASSETS, number>;
}

/** Loads the Blender exports (compressed by tools/optimize-proof-assets.mjs) and prepares them for lighting. */
export async function loadProofAssets(base: string): Promise<ProofAssets> {
  const [street, microcar] = await Promise.all([loadModel(`${base}${PROOF_ASSETS.street}`), loadModel(`${base}${PROOF_ASSETS.microcar}`)]);
  return { street: street.scene, microcar: microcar.scene, bytes: { street: street.bytes, microcar: microcar.bytes } };
}

/** Loads one compressed glTF and prepares it for the proof lighting (shadows, painted cards, satin paint). */
export async function loadModel(url: string): Promise<{ scene: Object3D; bytes: number }> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let bytes = 0;
  const gltf = await loader.loadAsync(url, (event) => {
    bytes = event.total || event.loaded;
  });
  prepare(gltf.scene);
  return { scene: gltf.scene, bytes };
}

/**
 * Every mesh casts and receives sun shadows. Painted backdrop cards (backdrop_* materials or nodes) become unlit,
 * alpha-tested and haze-free, since their haze is painted in. Node names may be merged by the optimizer, so the
 * material name is the reliable marker.
 */
function prepare(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const backdrop = isBackdrop(object);
    object.castShadow = !backdrop;
    object.receiveShadow = !backdrop;
    // Keep a single material single: an array without geometry groups draws nothing.
    if (backdrop) object.material = Array.isArray(object.material) ? object.material.map(toPaintedCard) : toPaintedCard(object.material);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) softenClearcoat(material);
  });
}

/**
 * Glossy car paint turns the low sun into a blown-out bloom spot on the car's domed roof. A satin finish keeps the
 * painted, storybook read of direction C.
 */
function softenClearcoat(material: Material): void {
  if (material instanceof MeshPhysicalMaterial && material.clearcoat > 0) {
    material.roughness = Math.max(material.roughness, 0.5);
    material.clearcoat = Math.min(material.clearcoat, 0.4);
    material.clearcoatRoughness = Math.max(material.clearcoatRoughness, 0.45);
  }
}

function isBackdrop(mesh: Mesh): boolean {
  return hasAncestorNamed(mesh, 'backdrop') || materials(mesh).some((material) => material.name.startsWith('backdrop'));
}

function toPaintedCard(material: Material): Material {
  // Blender exports its unlit cards as emission, so the painting may arrive as the emissive map.
  const painted = (key: 'map' | 'emissiveMap'): Texture | null => (key in material ? (material as unknown as Record<string, Texture | null>)[key] ?? null : null);
  const map = painted('map') ?? painted('emissiveMap');
  const color = map ? new Color(PROOF_LOOK.cardTint) : 'color' in material ? (material.color as Color) : undefined;
  const card = new MeshBasicMaterial({ name: material.name, map, color, transparent: true, alphaTest: 0.35, fog: false, depthWrite: false });
  material.dispose();
  return card;
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
  const hit = raycaster.intersectObject(street, true).find((candidate) => !(candidate.object instanceof Mesh && isBackdrop(candidate.object)));
  return hit ? hit.point.y : fallback;
}
