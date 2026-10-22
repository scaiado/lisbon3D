import { type CollisionMap, floorAt } from './collision';

/**
 * Gameplay layout of the Bica: spawn, the bakery pick-up and the delivery doors, and the funicular track. Authored
 * in Blender next to the street (art/exports/bica_gameplay.json, glTF coordinates); a built-in layout stands in until
 * that file exists.
 */
export interface Stop {
  /** Who receives the pastries, shown on the order card. */
  name: string;
  /** House number or shop sign. */
  label: string;
  /** Door on the façade (the marker stands in front of it). */
  door: [number, number, number];
  /** Where the car should pull up, at the road edge in front of the door. */
  stand: [number, number, number];
}

export interface GameplayLayout {
  spawn: { position: [number, number, number]; yaw: number };
  bakery: Stop;
  stops: Stop[];
  funicular: { centreZ: number; length: number; halfWidth: number; minZ: number; maxZ: number; slope: number };
}

const SLOPE = 0.18;

/** Stand-in layout from the street's own dimensions (street.py): doors alternate sides down the hill. */
function builtInLayout(map: CollisionMap): GameplayLayout {
  const stop = (name: string, label: string, side: -1 | 1, downhill: number): Stop => {
    const z = -downhill;
    const ground = floorAt(map, side * 0.8, z) ?? 0;
    return { name, label, door: [side * 3.1, ground + 0.12, z], stand: [side * 0.8, ground, z] };
  };
  return {
    // On the cross street at the top, heading west: the bakery is on the right, then a right turn into the Bica.
    spawn: { position: [19, 0, 6.4], yaw: Math.PI / 2 },
    bakery: { name: 'Pastelaria Estrela da Bica', label: 'Pastelaria', door: [9, 0.12, 11], stand: [9, 0, 7.2] },
    stops: [
      stop('Dona Amélia', 'No. 12', -1, 24),
      stop('Café Elevador', 'No. 31', 1, 49),
      stop('Senhor Tomás', 'No. 47', -1, 77),
      stop('Tasca do Rio', 'No. 66', 1, 104)
    ],
    funicular: { centreZ: -46, length: 8.4, halfWidth: 1.12, minZ: -114, maxZ: -16, slope: SLOPE }
  };
}

export async function loadGameplay(url: string, map: CollisionMap): Promise<GameplayLayout> {
  const fallback = builtInLayout(map);
  try {
    const response = await fetch(url);
    if (!response.ok) return fallback;
    return fromAuthored((await response.json()) as Record<string, unknown>, fallback);
  } catch {
    return fallback;
  }
}

type Vec3 = [number, number, number];

/** Reads the Blender-authored file tolerantly: any part that is missing or malformed keeps the built-in value. */
function fromAuthored(data: Record<string, unknown>, fallback: GameplayLayout): GameplayLayout {
  const vec = (value: unknown): Vec3 | null =>
    Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number') ? (value as Vec3) : null;
  const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' ? (value as Record<string, unknown>) : null);
  const text = (value: unknown, otherwise: string): string => (typeof value === 'string' && value ? value : otherwise);
  const toStop = (value: unknown, otherwise: Stop): Stop => {
    const o = obj(value);
    if (!o) return otherwise;
    const door = vec(o['door']) ?? vec(o['door_position']) ?? vec(o['position']);
    const stand = vec(o['stand']) ?? vec(o['stand_point']) ?? vec(o['curb']);
    if (!door || !stand) return otherwise;
    const number = o['number'] ?? o['houseNumber'] ?? o['house_number'];
    return {
      name: text(o['recipient'] ?? o['name'], otherwise.name),
      label: typeof number === 'string' || typeof number === 'number' ? `No. ${number}` : text(o['label'] ?? o['sign'], otherwise.label),
      door,
      stand
    };
  };

  const spawnData = obj(data['spawn']);
  const spawnPos = vec(spawnData?.['position']);
  const facing = vec(spawnData?.['facing']) ?? vec(spawnData?.['forward']);
  const heading = typeof spawnData?.['heading'] === 'number' ? (spawnData['heading'] as number) : null;
  const spawn = spawnPos
    ? { position: spawnPos, yaw: facing ? Math.atan2(-facing[0], -facing[2]) : heading ?? fallback.spawn.yaw }
    : fallback.spawn;

  const stops = Array.isArray(data['stops']) && data['stops'].length > 0
    ? data['stops'].map((s, i) => toStop(s, fallback.stops[Math.min(i, fallback.stops.length - 1)]!))
    : fallback.stops;

  const fun = obj(data['funicular']);
  const centre = vec(fun?.['carCentre']) ?? vec(fun?.['centre']) ?? vec(fun?.['center']);
  const trackData = fun?.['trackCentreline'] ?? fun?.['track'];
  const track = Array.isArray(trackData) ? (trackData as unknown[]).map(vec).filter((p): p is Vec3 => p !== null) : [];
  const funicular = { ...fallback.funicular };
  if (centre) funicular.centreZ = centre[2];
  const length = fun?.['carLength'] ?? fun?.['length'];
  if (typeof length === 'number') funicular.length = length;
  if (track.length >= 2) {
    const zs = track.map((p) => p[2]);
    funicular.minZ = Math.min(...zs) + funicular.length / 2;
    funicular.maxZ = Math.min(Math.max(...zs) - funicular.length / 2, fallback.funicular.maxZ);
  }

  // The pick-up is the bakery shopfront just inside the top of the Bica, so the whole run happens in the composed
  // street (the cross street's far ends are not built yet). Falls back to the authored bakery.
  let bakery = toStop(data['bakery'], fallback.bakery);
  const bakeryName = obj(data['bakery'])?.['name'];
  const doors = Array.isArray(data['allDoors']) ? (data['allDoors'] as unknown[]).map(obj).filter((d): d is Record<string, unknown> => d !== null) : [];
  const shop = doors
    .filter((d) => d['kind'] === 'shop' && d['where'] === 'front')
    .map((d) => ({ door: vec(d['door']), normal: vec(d['normal']) }))
    .filter((d): d is { door: Vec3; normal: Vec3 } => d.door !== null && d.normal !== null && d.door[2] < -4)
    .sort((a, b) => b.door[2] - a.door[2])[0];
  if (shop) {
    const side = Math.sign(shop.door[0]);
    bakery = { name: text(bakeryName, bakery.name), label: 'Pastelaria', door: shop.door, stand: [side * 0.78, shop.door[1], shop.door[2]] };
  }

  return { spawn, bakery, stops, funicular };
}
