/**
 * The baked ground and collision map of the Bica (tools/bake_collision.py): a 0.2 m grid holding the drivable
 * ground height and a signed distance to the nearest obstacle (façades, steps too tall to climb, bollards, people).
 */
export interface CollisionMap {
  nx: number;
  nz: number;
  x0: number;
  z0: number;
  cell: number;
  /** Ground height in centimetres, NO_FLOOR where there is none. */
  floor: Int16Array;
  /** Signed distance to the nearest obstacle in units of SDF_UNIT metres (+ free, - inside). */
  sdf: Int8Array;
}

const NO_FLOOR = -32768;
const SDF_UNIT = 0.02;

export async function loadCollision(url: string): Promise<CollisionMap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== 'LBCM' || view.getUint32(4, true) !== 1) throw new Error(`${url}: not a Lisbon3D collision map`);
  const nx = view.getUint32(8, true);
  const nz = view.getUint32(12, true);
  const cells = nx * nz;
  return {
    nx,
    nz,
    x0: view.getFloat32(16, true),
    z0: view.getFloat32(20, true),
    cell: view.getFloat32(24, true),
    floor: new Int16Array(buffer.slice(28, 28 + cells * 2)),
    sdf: new Int8Array(buffer, 28 + cells * 2, cells)
  };
}

/** Ground height under a point, bilinear over the cells that have ground; null off the drivable map. */
export function floorAt(map: CollisionMap, x: number, z: number): number | null {
  const fx = (x - map.x0) / map.cell - 0.5;
  const fz = (z - map.z0) / map.cell - 0.5;
  const i = Math.floor(fx);
  const k = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - k;
  let sum = 0;
  let weight = 0;
  for (let dk = 0; dk <= 1; dk++) {
    for (let di = 0; di <= 1; di++) {
      const ci = i + di;
      const ck = k + dk;
      if (ci < 0 || ck < 0 || ci >= map.nx || ck >= map.nz) continue;
      const value = map.floor[ck * map.nx + ci]!;
      if (value === NO_FLOOR) continue;
      const w = (di ? tx : 1 - tx) * (dk ? tz : 1 - tz) + 1e-4;
      sum += value * w;
      weight += w;
    }
  }
  return weight > 0 ? sum / weight / 100 : null;
}

/** Signed distance (m) from a point to the nearest obstacle; negative inside one, and off the map. */
export function distanceAt(map: CollisionMap, x: number, z: number): number {
  const fx = (x - map.x0) / map.cell - 0.5;
  const fz = (z - map.z0) / map.cell - 0.5;
  const i = Math.floor(fx);
  const k = Math.floor(fz);
  if (i < 0 || k < 0 || i >= map.nx - 1 || k >= map.nz - 1) return -1;
  const tx = fx - i;
  const tz = fz - k;
  const at = (ci: number, ck: number): number => map.sdf[ck * map.nx + ci]!;
  const top = at(i, k) * (1 - tx) + at(i + 1, k) * tx;
  const bottom = at(i, k + 1) * (1 - tx) + at(i + 1, k + 1) * tx;
  return (top * (1 - tz) + bottom * tz) * SDF_UNIT;
}

/** Direction of increasing distance (away from the nearest obstacle), normalised; zero where flat. */
export function awayFrom(map: CollisionMap, x: number, z: number): { x: number; z: number } {
  const h = map.cell;
  const gx = distanceAt(map, x + h, z) - distanceAt(map, x - h, z);
  const gz = distanceAt(map, x, z + h) - distanceAt(map, x, z - h);
  const length = Math.hypot(gx, gz);
  return length > 1e-6 ? { x: gx / length, z: gz / length } : { x: 0, z: 0 };
}
