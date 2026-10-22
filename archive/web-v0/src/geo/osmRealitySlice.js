const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY = 'lisbon3d:osm-reality-slice:v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const LISBON_REALITY_BOUNDS = {
  south: 38.7046,
  west: -9.1608,
  north: 38.7318,
  east: -9.1184
};

export async function loadLisbonRealitySlice({ project, fetchImpl = fetch, storage = window.localStorage } = {}) {
  if (typeof project !== 'function') {
    throw new Error('loadLisbonRealitySlice requires a project([lng, lat]) function.');
  }

  const cached = readCachedSlice(storage);
  if (cached) return projectSlice(cached, project, 'cache');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetchImpl(OVERPASS_ENDPOINT, {
      method: 'POST',
      body: buildOverpassQuery(LISBON_REALITY_BOUNDS),
      signal: controller.signal,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });

    if (!response.ok) {
      throw new Error(`Overpass responded with ${response.status}`);
    }

    const payload = await response.json();
    const rawSlice = parseOverpassElements(payload.elements || []);
    writeCachedSlice(storage, rawSlice);
    return projectSlice(rawSlice, project, 'network');
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildOverpassQuery({ south, west, north, east }) {
  const bbox = `${south},${west},${north},${east}`;
  return `
    [out:json][timeout:18];
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
  const tram = [];

  for (const element of elements) {
    if (!element.geometry || element.geometry.length < 2) continue;
    const tags = element.tags || {};
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);

    if (tags.building && coordinates.length >= 4) {
      buildings.push({
        id: element.id,
        coordinates,
        height: inferBuildingHeight(tags),
        levels: parseNumber(tags['building:levels']),
        type: tags.building
      });
      continue;
    }

    if (tags.highway) {
      roads.push({
        id: element.id,
        name: tags.name || readableRoadName(tags.highway),
        coordinates,
        highway: tags.highway,
        type: classifyRoad(tags.highway)
      });
      continue;
    }

    if (tags.railway === 'tram') {
      tram.push({ id: element.id, coordinates });
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

  return {
    generatedAt: Date.now(),
    bounds: LISBON_REALITY_BOUNDS,
    buildings,
    roads,
    water,
    green,
    tram
  };
}

function projectSlice(slice, project, source) {
  return {
    ...slice,
    source,
    buildings: slice.buildings.map((building) => ({
      ...building,
      points: building.coordinates.map(project)
    })),
    roads: slice.roads.map((road) => ({
      ...road,
      points: road.coordinates.map(project)
    })),
    water: slice.water.map((feature) => ({
      ...feature,
      points: feature.coordinates.map(project)
    })),
    green: slice.green.map((feature) => ({
      ...feature,
      points: feature.coordinates.map(project)
    })),
    tram: slice.tram.map((feature) => ({
      ...feature,
      points: feature.coordinates.map(project)
    }))
  };
}

function inferBuildingHeight(tags) {
  const explicitHeight = parseNumber(tags.height || tags['building:height']);
  if (explicitHeight) return clamp(explicitHeight, 3.2, 72);

  const levels = parseNumber(tags['building:levels']);
  if (levels) return clamp(levels * 3.15 + 1.2, 3.8, 68);

  if (tags.building === 'church' || tags.amenity === 'place_of_worship') return 24;
  if (tags.building === 'industrial' || tags.building === 'warehouse') return 9;
  return 12 + pseudoHeightSeed(tags) * 18;
}

function classifyRoad(highway) {
  if (['primary', 'secondary', 'trunk'].includes(highway)) return 'arterial';
  if (['tertiary', 'unclassified'].includes(highway)) return 'street';
  if (['residential', 'living_street'].includes(highway)) return 'street';
  return 'lane';
}

function readableRoadName(highway) {
  return highway.replace(/_/g, ' ');
}

function parseNumber(value) {
  if (!value) return null;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function pseudoHeightSeed(tags) {
  const text = Object.values(tags).join('|');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 997;
  }
  return hash / 997;
}

function readCachedSlice(storage) {
  if (!storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
    if (!cached || Date.now() - cached.generatedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedSlice(storage, slice) {
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(slice));
  } catch {
    // Cache is opportunistic; the playable demo should never depend on it.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
