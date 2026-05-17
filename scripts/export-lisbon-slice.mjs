#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const LISBON_CENTER = [-9.1393, 38.7223];
const DEG_PER_METER_LAT = 1 / 111_320;
const DEG_PER_METER_LNG = 1 / (111_320 * Math.cos((LISBON_CENTER[1] * Math.PI) / 180));
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const DEFAULT_BOUNDS = {
  south: 38.7046,
  west: -9.1608,
  north: 38.7318,
  east: -9.1184
};

const PLAYABLE_BOUNDS = {
  minX: -520,
  maxX: 520,
  minZ: -380,
  maxZ: 535
};

const ROAD_WIDTH = {
  arterial: 18,
  street: 12,
  lane: 7
};

const args = parseArgs(process.argv.slice(2));
const outPath = resolve(args.out || 'game/godot/data/lisbon_slice.json');

const raw = args.input
  ? JSON.parse(await readFile(resolve(args.input), 'utf8'))
  : await fetchOverpass(DEFAULT_BOUNDS);

const parsed = parseOverpassElements(raw.elements || []);
const projected = projectSlice(parsed);
const roads = selectPlayableRoads(projected.roads);
const buildings = selectPlayableBuildings(projected.buildings, roads);

const slice = {
  version: 1,
  generatedAt: new Date().toISOString(),
  center: LISBON_CENTER,
  bounds: DEFAULT_BOUNDS,
  playableBounds: PLAYABLE_BOUNDS,
  roads,
  buildings,
  green: projected.green.filter((feature) => feature.points.some(([x, z]) => isInsidePlayableBounds(x, z))).slice(0, 80),
  water: projected.water.filter((feature) => feature.points.some(([x, z]) => isInsidePlayableBounds(x, z))).slice(0, 24),
  metadata: {
    source: args.input ? 'local-overpass-json' : 'overpass-api',
    roadCount: roads.length,
    buildingCount: buildings.length
  }
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(slice, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`${roads.length} connected roads, ${buildings.length} filtered buildings`);

function parseArgs(argv) {
  const parsedArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') parsedArgs.out = argv[++i];
    if (arg === '--input') parsedArgs.input = argv[++i];
  }
  return parsedArgs;
}

async function fetchOverpass(bounds) {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: buildOverpassQuery(bounds),
    headers: { 'content-type': 'text/plain;charset=UTF-8' }
  });

  if (!response.ok) {
    throw new Error(`Overpass responded with ${response.status}`);
  }

  return response.json();
}

function buildOverpassQuery({ south, west, north, east }) {
  const bbox = `${south},${west},${north},${east}`;
  return `
    [out:json][timeout:25];
    (
      way["building"](${bbox});
      way["highway"](${bbox});
      way["natural"="water"](${bbox});
      way["waterway"](${bbox});
      way["leisure"="park"](${bbox});
      way["landuse"="grass"](${bbox});
      way["railway"="tram"](${bbox});
    );
    out body geom;
  `;
}

function parseOverpassElements(elements) {
  const buildings = [];
  const roads = [];
  const water = [];
  const green = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) continue;
    const tags = element.tags || {};
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);

    if (tags.building && coordinates.length >= 4) {
      buildings.push({
        id: element.id,
        coordinates,
        height: inferBuildingHeight(tags),
        type: tags.building
      });
      continue;
    }

    if (tags.highway) {
      roads.push({
        id: element.id,
        name: tags.name || tags.highway.replace(/_/g, ' '),
        coordinates,
        highway: tags.highway,
        type: classifyRoad(tags.highway),
        width: ROAD_WIDTH[classifyRoad(tags.highway)] || ROAD_WIDTH.lane
      });
      continue;
    }

    if (tags.natural === 'water' || tags.waterway) {
      water.push({ id: element.id, coordinates });
      continue;
    }

    if (tags.leisure === 'park' || tags.landuse === 'grass') {
      green.push({ id: element.id, coordinates });
    }
  }

  return { buildings, roads, water, green };
}

function projectSlice(slice) {
  const project = ([lng, lat]) => [
    (lng - LISBON_CENTER[0]) / DEG_PER_METER_LNG,
    -(lat - LISBON_CENTER[1]) / DEG_PER_METER_LAT
  ];

  return {
    buildings: slice.buildings.map((building) => ({ ...building, points: building.coordinates.map(project) })),
    roads: slice.roads.map((road) => ({ ...road, points: road.coordinates.map(project) })),
    water: slice.water.map((feature) => ({ ...feature, points: feature.coordinates.map(project) })),
    green: slice.green.map((feature) => ({ ...feature, points: feature.coordinates.map(project) }))
  };
}

function selectPlayableRoads(roads) {
  const usefulHighways = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']);
  const candidates = roads
    .map((road) => ({ ...road, points: road.points.filter(([x, z]) => isInsidePlayableBounds(x, z)) }))
    .filter((road) => road.points.length >= 2 && usefulHighways.has(road.highway))
    .filter((road) => pathLength(road.points) > 16)
    .sort((a, b) => roadPriority(b) - roadPriority(a));

  return selectConnectedRoadComponent(candidates).slice(0, 220);
}

function selectPlayableBuildings(buildings, roads) {
  const selected = [];
  const occupied = new Set();

  for (const building of buildings) {
    const points = simplifyFootprint(building.points).filter(([x, z]) => isInsidePlayableBounds(x, z));
    if (points.length < 4) continue;

    const bounds = footprintBounds(points);
    if (!isInsidePlayableBounds(bounds.centerX, bounds.centerZ)) continue;
    if (bounds.width < 4 || bounds.depth < 4 || bounds.width > 70 || bounds.depth > 70) continue;

    const nearest = nearestRoadFromRoads(bounds.centerX, bounds.centerZ, roads);
    if (!nearest) continue;

    const roadWidth = nearest.road.width || ROAD_WIDTH.lane;
    const clearance = Math.max(bounds.width, bounds.depth) * 0.34 + roadWidth * 1.05;
    if (nearest.distance < clearance || nearest.distance > 60) continue;
    if (footprintRoadClearance(points, roads) < roadWidth * 0.74 + 3.4) continue;

    const key = `${Math.round(bounds.centerX / 5)}:${Math.round(bounds.centerZ / 5)}`;
    if (occupied.has(key)) continue;
    occupied.add(key);

    selected.push({ ...building, points, height: building.height });
  }

  return selected.sort((a, b) => a.height - b.height).slice(0, 420);
}

function selectConnectedRoadComponent(roads) {
  const endpointBuckets = new Map();
  roads.forEach((road, roadIndex) => {
    for (const point of road.points) {
      const key = `${Math.round(point[0] / 10)}:${Math.round(point[1] / 10)}`;
      const bucket = endpointBuckets.get(key) || [];
      bucket.push(roadIndex);
      endpointBuckets.set(key, bucket);
    }
  });

  const adjacency = roads.map(() => new Set());
  for (const bucket of endpointBuckets.values()) {
    for (const a of bucket) {
      for (const b of bucket) {
        if (a !== b) adjacency[a].add(b);
      }
    }
  }

  const visited = new Set();
  const components = [];
  roads.forEach((_road, startIndex) => {
    if (visited.has(startIndex)) return;
    const stack = [startIndex];
    const component = [];
    visited.add(startIndex);
    while (stack.length) {
      const index = stack.pop();
      component.push(index);
      for (const next of adjacency[index]) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    components.push(component);
  });

  const spawn = [-230, 285];
  const best = components
    .map((component) => {
      const componentRoads = component.map((index) => roads[index]);
      const nearest = nearestRoadFromRoads(spawn[0], spawn[1], componentRoads);
      const length = componentRoads.reduce((sum, road) => sum + pathLength(road.points), 0);
      return { componentRoads, score: length - (nearest?.distance || 9999) * 18 };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best?.componentRoads || roads;
}

function classifyRoad(highway) {
  if (['primary', 'secondary', 'trunk'].includes(highway)) return 'arterial';
  if (['tertiary', 'unclassified', 'residential', 'living_street'].includes(highway)) return 'street';
  return 'lane';
}

function inferBuildingHeight(tags) {
  const explicitHeight = parseNumber(tags.height || tags['building:height']);
  if (explicitHeight) return clamp(explicitHeight, 3.2, 72);
  const levels = parseNumber(tags['building:levels']);
  if (levels) return clamp(levels * 3.15 + 1.2, 3.8, 68);
  return 10 + pseudoHeightSeed(tags) * 18;
}

function simplifyFootprint(points) {
  if (points.length <= 14) return points;
  const step = Math.ceil(points.length / 14);
  const simplified = points.filter((_point, index) => index % step === 0);
  return simplified.length >= 4 ? simplified : points.slice(0, 14);
}

function footprintRoadClearance(points, roads) {
  let clearance = Infinity;
  for (const point of points) {
    const nearest = nearestRoadFromRoads(point[0], point[1], roads);
    if (nearest) clearance = Math.min(clearance, nearest.distance);
  }
  const bounds = footprintBounds(points);
  const centerNearest = nearestRoadFromRoads(bounds.centerX, bounds.centerZ, roads);
  if (centerNearest) clearance = Math.min(clearance, centerNearest.distance);
  return clearance;
}

function nearestRoadFromRoads(x, z, roads) {
  let best = null;
  for (const road of roads) {
    forEachSegment(road.points, (start, end) => {
      const hit = closestPointOnSegment([x, z], start, end);
      if (!best || hit.distance < best.distance) best = { ...hit, road };
    });
  }
  return best;
}

function closestPointOnSegment(point, start, end) {
  const segment = [end[0] - start[0], end[1] - start[1]];
  const lengthSq = segment[0] ** 2 + segment[1] ** 2;
  const t = lengthSq === 0
    ? 0
    : clamp(((point[0] - start[0]) * segment[0] + (point[1] - start[1]) * segment[1]) / lengthSq, 0, 1);
  const projected = [start[0] + segment[0] * t, start[1] + segment[1] * t];
  return { point: projected, distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]) };
}

function forEachSegment(points, callback) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    callback(start, end, Math.hypot(end[0] - start[0], end[1] - start[1]));
  }
}

function pathLength(points) {
  let length = 0;
  forEachSegment(points, (_start, _end, segmentLength) => { length += segmentLength; });
  return length;
}

function footprintBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}

function isInsidePlayableBounds(x, z) {
  return x >= PLAYABLE_BOUNDS.minX && x <= PLAYABLE_BOUNDS.maxX && z >= PLAYABLE_BOUNDS.minZ && z <= PLAYABLE_BOUNDS.maxZ;
}

function roadPriority(road) {
  const typeScore = { arterial: 4, street: 3, lane: 1 };
  return (typeScore[road.type] || 1) * 1000 + Math.min(pathLength(road.points), 900);
}

function parseNumber(value) {
  if (!value) return null;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function pseudoHeightSeed(tags) {
  const text = Object.values(tags).join('|');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 997;
  return hash / 997;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
