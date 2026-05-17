import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  FACADE_PALETTE,
  TOY_COLORS,
  VEHICLE_PALETTE
} from './src/art/toyPalette.js';
import {
  createBench,
  createCarMesh,
  createDog,
  createKiosk,
  createLamp,
  createParkedCar,
  createPerson,
  createSeagull,
  createToyArch,
  createToyCastle,
  createToyTram,
  createTree
} from './src/art/toyFactories.js';
import { loadLisbonRealitySlice } from './src/geo/osmRealitySlice.js';

const LISBON_CENTER = [-9.1393, 38.7223];
const DEG_PER_METER_LAT = 1 / 111_320;
const DEG_PER_METER_LNG = 1 / (111_320 * Math.cos((LISBON_CENTER[1] * Math.PI) / 180));

const ROAD_WIDTH = {
  avenue: 18,
  arterial: 14,
  street: 10,
  lane: 7
};

const ROAD_SPEED = {
  avenue: 80,
  arterial: 60,
  street: 45,
  lane: 30
};

const ROADS = [
  {
    name: 'Avenida da Liberdade',
    type: 'avenue',
    points: [
      [-260, 330],
      [-205, 210],
      [-160, 95],
      [-95, -40],
      [-35, -170],
      [20, -295]
    ]
  },
  {
    name: 'Rua Augusta',
    type: 'street',
    points: [
      [-135, -120],
      [-105, -45],
      [-70, 40],
      [-35, 120],
      [-5, 205]
    ]
  },
  {
    name: 'Praça do Comércio',
    type: 'arterial',
    points: [
      [-420, 300],
      [-275, 285],
      [-120, 292],
      [60, 310],
      [230, 330]
    ]
  },
  {
    name: 'Rua do Ouro',
    type: 'street',
    points: [
      [-260, 150],
      [-130, 110],
      [15, 90],
      [165, 62],
      [315, 35]
    ]
  },
  {
    name: 'Rua da Prata',
    type: 'street',
    points: [
      [-315, -25],
      [-170, 8],
      [-20, 18],
      [135, 8],
      [292, -32]
    ]
  },
  {
    name: 'Calçada do Carmo',
    type: 'lane',
    points: [
      [-280, -225],
      [-190, -155],
      [-105, -90],
      [-20, -22],
      [82, 40]
    ]
  },
  {
    name: 'Alfama Climb',
    type: 'lane',
    points: [
      [70, 315],
      [100, 215],
      [145, 125],
      [225, 55],
      [350, 5]
    ]
  },
  {
    name: 'Ribeira Run',
    type: 'arterial',
    points: [
      [-455, 455],
      [-260, 420],
      [-75, 410],
      [105, 430],
      [315, 485]
    ]
  }
];

const LANDMARKS = [
  { name: 'Baixa Grid', position: [-85, 150], color: 0xffcc66 },
  { name: 'Castle Lookout', position: [330, -35], color: 0xf0ead6 },
  { name: 'Riverfront', position: [-40, 520], color: 0x61d6ff }
];

const START_POSITION = [-230, 285];
const TERRACOTTA = TOY_COLORS.terracotta;
const AZULEJO_BLUE = TOY_COLORS.azulejoBlue;
const CALCADA_LIGHT = TOY_COLORS.calcadaLight;
const CALCADA_DARK = TOY_COLORS.calcadaDark;
const RIVER_START_Z = 520;
const RIVER_CENTER_Z = 620;
const RIVER_WIDTH = 180;
const PLAYABLE_BOUNDS = {
  minX: -520,
  maxX: 520,
  minZ: -380,
  maxZ: 535
};

class LisbonDriveDemo {
  constructor(root) {
    this.root = root;
    this.mode = 'aerial';
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.lastMapSync = 0;
    this.buildingColliders = [];
    this.staticColliders = [];
    this.actors = [];
    this.roads = ROADS;
    this.audio = null;
    this.realitySlice = null;
    this.roadLayer = new THREE.Group();
    this.buildingLayer = new THREE.Group();
    this.realityLayer = new THREE.Group();

    this.car = this.createCarState();
  }

  start() {
    injectStyles();
    this.renderShell();
    this.initMap();
    this.initThree();
    this.bindEvents();
    this.animate();
    this.loadRealityGeometry();
  }

  renderShell() {
    this.root.innerHTML = `
      <main class="app-shell">
        <section class="mode mode-aerial" data-mode="aerial">
          <div id="map" class="map"></div>
          <div class="panel hero-panel">
            <p class="eyebrow">Lisbon3D / local playable slice</p>
            <h1>Drop from the map into a tiny Lisbon driving demo.</h1>
            <p>
              MapLibre handles the city context. Three.js owns the playable world, with an
              optional OSM reality layer for real building and road fingerprints.
            </p>
            <button class="primary-action" data-action="drive">Enter Drive Mode</button>
          </div>
        </section>

        <section class="mode mode-drive is-hidden" data-mode="drive">
          <canvas id="game-canvas"></canvas>
          <div class="panel drive-panel">
            <p class="eyebrow">Drive Mode</p>
            <h2>Baixa toy drive</h2>
            <p>WASD/arrows drive. Shift boosts. Space brakes. R respawns. M map.</p>
            <p class="reality-chip" data-reality-status>toy Lisbon ready</p>
            <button class="secondary-action" data-action="map">Back To Aerial</button>
          </div>
          <div class="hud">
            <div class="speed">
              <strong data-hud="speed">0</strong>
              <span>km/h</span>
            </div>
            <div class="street" data-hud="street">Avenida da Liberdade</div>
            <div class="status" data-hud="status">on road</div>
          </div>
        </section>
      </main>
    `;
  }

  initMap() {
    this.map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: LISBON_CENTER,
      zoom: 15,
      pitch: 55,
      bearing: -18,
      antialias: true
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.carMarker = new maplibregl.Marker({ color: '#ff5a3d' })
      .setLngLat(worldToLngLat(this.car.position.x, this.car.position.z))
      .addTo(this.map);

    this.map.on('load', () => {
      this.map.addSource('demo-roads', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: this.roads.map((road) => ({
            type: 'Feature',
            properties: { name: road.name, type: road.type },
            geometry: {
              type: 'LineString',
              coordinates: road.points.map(([x, z]) => worldToLngLat(x, z))
            }
          }))
        }
      });

      this.map.addLayer({
        id: 'demo-roads-glow',
        type: 'line',
        source: 'demo-roads',
        paint: {
          'line-color': '#ff6a3d',
          'line-width': 8,
          'line-opacity': 0.25
        }
      });

      this.map.addLayer({
        id: 'demo-roads',
        type: 'line',
        source: 'demo-roads',
        paint: {
          'line-color': '#1d3557',
          'line-width': 3,
          'line-opacity': 0.9
        }
      });
    });
  }

  initThree() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * 0.7);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fc9df);
    this.scene.fog = new THREE.Fog(0x9fc9df, 420, 1250);
    this.scene.add(this.roadLayer, this.buildingLayer);
    this.scene.add(this.realityLayer);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1800);

    const sun = new THREE.DirectionalLight(0xffe0a3, 3.2);
    sun.position.set(-220, 320, -180);
    sun.castShadow = true;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    this.scene.add(sun, new THREE.HemisphereLight(0xbfe8ff, 0xc88f5a, 1.85));

    this.addGround();
    this.addRoads();
    this.addBuildings();
    this.addVegetation();
    this.addLisbonDetails();
    this.addCityLife();
    this.addWeather();
    this.addLandmarks();
    this.carMesh = createCarMesh();
    this.carMesh.scale.setScalar(0.58);
    this.carMesh.position.copy(this.car.position);
    this.syncCarMesh();
    this.scene.add(this.carMesh);

    this.resize();
    this.snapCameraToCar();
  }

  async loadRealityGeometry() {
    this.setRealityStatus('checking OSM reality layer');

    try {
      const slice = await loadLisbonRealitySlice({
        project: ([lng, lat]) => lngLatToWorld(lng, lat)
      });
      this.realitySlice = slice;
      const applied = this.addRealityGeometry(slice);
      this.addRealityMapOverlay(slice);
      this.setRealityStatus(`${applied.buildings} real buildings / ${applied.roads} real roads`);
    } catch (error) {
      this.setRealityStatus('toy layer active; OSM unavailable');
      console.info('[Lisbon3D] OSM reality layer skipped:', error);
    }
  }

  addRealityGeometry(slice) {
    this.realityLayer.clear();
    const roads = selectPlayableRoads(slice.roads);
    const buildings = selectPlayableBuildings(slice.buildings, roads);

    if (roads.length < 8 || buildings.length < 20) {
      this.addRealityRoadHints(slice.roads);
      this.addRealityFootprints(slice.buildings);
      this.addRealityLandHints(slice.water, 0x58c9df, 0.28);
      this.addRealityLandHints(slice.green, 0x6fbd63, 0.2);
      return { roads: roads.length, buildings: buildings.length };
    }

    this.roads = roads;
    this.roadLayer.visible = false;
    this.buildingLayer.visible = false;
    this.buildingColliders = [];

    this.addRealityRoadMeshes(roads);
    this.addRealityBuildingMeshes(buildings);
    this.addRealityLandHints(slice.water, 0x58c9df, 0.28);
    this.addRealityLandHints(slice.green, 0x6fbd63, 0.2);
    this.addRealityGreenery(slice.green, roads);
    this.respawn();
    return { roads: roads.length, buildings: buildings.length };
  }

  addRealityRoadMeshes(roads) {
    const asphalt = new THREE.MeshStandardMaterial({ color: TOY_COLORS.road, roughness: 0.88 });
    const sidewalk = new THREE.MeshStandardMaterial({ color: CALCADA_LIGHT, roughness: 0.94 });
    const stripe = new THREE.MeshBasicMaterial({ color: 0xffd766, transparent: true, opacity: 0.78 });
    const seamPaint = new THREE.MeshBasicMaterial({ color: TOY_COLORS.road });
    const group = new THREE.Group();
    const junctions = [];

    for (const road of roads) {
      const width = ROAD_WIDTH[road.type] || ROAD_WIDTH.lane;
      forEachSegment(road.points, (start, end, length, midpoint, rotation) => {
        if (length < 8 || length > 220) return;
        junctions.push({ point: start, width });
        junctions.push({ point: end, width });

        const mesh = new THREE.Mesh(
          new RoundedBoxGeometry(width, 0.09, length, 1, 0.32),
          asphalt
        );
        mesh.position.set(midpoint[0], 0.07, midpoint[1]);
        mesh.rotation.y = rotation;
        mesh.receiveShadow = true;
        group.add(mesh);

        if (road.type !== 'lane') {
          const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, length * 0.78), stripe);
          centerLine.position.set(midpoint[0], 0.155, midpoint[1]);
          centerLine.rotation.y = rotation;
          group.add(centerLine);
        }

        const walkWidth = road.type === 'lane' ? 1.7 : 2.6;
        for (const side of [-1, 1]) {
          const walk = new THREE.Mesh(new RoundedBoxGeometry(walkWidth, 0.055, length, 1, 0.18), sidewalk);
          walk.position.set(midpoint[0], 0.045, midpoint[1]);
          walk.rotation.y = rotation;
          walk.translateX(side * (width / 2 + walkWidth / 2 + 0.35));
          walk.receiveShadow = true;
          group.add(walk);
        }
      });
    }

    for (const junction of mergeJunctions(junctions)) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(junction.radius, 24), seamPaint);
      cap.position.set(junction.x, 0.162, junction.z);
      cap.rotation.x = -Math.PI / 2;
      group.add(cap);
    }

    this.realityLayer.add(group);
  }

  addRealityBuildingMeshes(buildings) {
    const roofMaterial = new THREE.MeshStandardMaterial({ color: TERRACOTTA, roughness: 0.78 });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x1f5a72, roughness: 0.4, metalness: 0.08 });
    const group = new THREE.Group();

    for (const building of buildings) {
      const points = simplifyFootprint(building.points);
      const bounds = footprintBounds(points);
      const height = clamp(building.height * 0.92, 4, 42);
      const rotation = dominantFootprintRotation(building.points);
      const material = new THREE.MeshStandardMaterial({
        color: FACADE_PALETTE[Math.abs(Math.round(bounds.centerX + bounds.centerZ)) % FACADE_PALETTE.length],
        roughness: 0.76
      });

      const body = new THREE.Mesh(createFootprintExtrusion(points, height), material);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const roof = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, height + 0.08, z))),
        new THREE.LineBasicMaterial({ color: TERRACOTTA, transparent: true, opacity: 0.9 })
      );
      group.add(roof);

      this.buildingColliders.push({
        x: bounds.centerX,
        z: bounds.centerZ,
        halfWidth: bounds.width / 2 + 1.1,
        halfDepth: bounds.depth / 2 + 1.1,
        rotation
      });
    }

    this.realityLayer.add(group);
  }

  addRealityRoadHints(roads) {
    const material = new THREE.LineBasicMaterial({ color: 0xf9d37a, transparent: true, opacity: 0.24 });
    const group = new THREE.Group();

    for (const road of roads.slice(0, 180)) {
      if (road.points.length < 2) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(
        road.points.map(([x, z]) => new THREE.Vector3(x, 0.19, z))
      );
      group.add(new THREE.Line(geometry, material));
    }

    this.realityLayer.add(group);
  }

  addRealityFootprints(buildings) {
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x17324a, transparent: true, opacity: 0.2 });
    const capMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
    const group = new THREE.Group();

    for (const building of buildings.slice(0, 260)) {
      const points = simplifyFootprint(building.points);
      if (points.length < 4) continue;
      const bounds = footprintBounds(points);

      if (bounds.centerZ > RIVER_START_Z - 8 || bounds.width < 3 || bounds.depth < 3) continue;
      if (this.distanceToRoads(bounds.centerX, bounds.centerZ) < 5) continue;

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(
        points.map(([x, z]) => new THREE.Vector3(x, 0.22, z))
      );
      group.add(new THREE.LineLoop(lineGeometry, outlineMaterial));

      if (building.height > 18 && bounds.width < 42 && bounds.depth < 42) {
        const cap = new THREE.Mesh(
          new RoundedBoxGeometry(bounds.width, 0.18, bounds.depth, 1, 0.3),
          capMaterial
        );
        cap.position.set(bounds.centerX, Math.min(18, building.height) + 0.1, bounds.centerZ);
        cap.castShadow = true;
        group.add(cap);
      }
    }

    this.realityLayer.add(group);
  }

  addRealityLandHints(features, color, opacity) {
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const group = new THREE.Group();

    for (const feature of features.slice(0, 80)) {
      if (feature.points.length < 3) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(
        feature.points.map(([x, z]) => new THREE.Vector3(x, 0.21, z))
      );
      group.add(new THREE.LineLoop(geometry, material));
    }

    this.realityLayer.add(group);
  }

  addRealityGreenery(features, roads) {
    const grassMaterial = new THREE.MeshBasicMaterial({ color: 0x9fc46a, transparent: true, opacity: 0.42 });
    const bushMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x2f7d3b, roughness: 0.86 }),
      new THREE.MeshStandardMaterial({ color: 0x4f9b46, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x6aa84f, roughness: 0.9 })
    ];
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6d4628, roughness: 0.9 });
    const group = new THREE.Group();
    const placed = [];

    for (const feature of features.slice(0, 35)) {
      const points = simplifyFootprint(feature.points).filter(([x, z]) => isInsidePlayableBounds(x, z));
      if (points.length < 3) continue;
      const bounds = footprintBounds(points);
      if (bounds.width < 10 || bounds.depth < 10) continue;

      const patch = new THREE.Mesh(createFlatShape(points), grassMaterial);
      patch.position.y = 0.032;
      group.add(patch);

      const bushCount = Math.min(9, Math.max(2, Math.floor((bounds.width + bounds.depth) / 28)));
      for (let i = 0; i < bushCount; i += 1) {
        const x = bounds.centerX + (pseudoRandom(bounds.centerX + i * 19.7) - 0.5) * bounds.width * 0.75;
        const z = bounds.centerZ + (pseudoRandom(bounds.centerZ + i * 31.1) - 0.5) * bounds.depth * 0.75;
        if (!isInsidePlayableBounds(x, z) || nearestRoadFromRoads(x, z, roads)?.distance < 9) continue;
        if (tooCloseToPlaced(x, z, placed, 5)) continue;
        placed.push([x, z]);

        const bush = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.4 + pseudoRandom(x + z) * 1.5, 0),
          bushMaterials[i % bushMaterials.length]
        );
        bush.position.set(x, 0.85, z);
        bush.scale.y = 0.58 + pseudoRandom(i + x) * 0.38;
        bush.rotation.y = pseudoRandom(z - x) * Math.PI;
        bush.castShadow = true;
        group.add(bush);
      }
    }

    for (const road of roads.slice(0, 55)) {
      forEachSegment(road.points, (start, end, length) => {
        if (length < 35) return;
        const dir = normalize([end[0] - start[0], end[1] - start[1]]);
        const normal = [-dir[1], dir[0]];
        const count = Math.min(4, Math.floor(length / 52));

        for (let i = 1; i <= count; i += 1) {
          const t = i / (count + 1);
          const base = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
          const side = i % 2 === 0 ? 1 : -1;
          const offset = (ROAD_WIDTH[road.type] || ROAD_WIDTH.lane) / 2 + 7 + pseudoRandom(base[0] + base[1]) * 9;
          const x = base[0] + normal[0] * side * offset;
          const z = base[1] + normal[1] * side * offset;
          if (!isInsidePlayableBounds(x, z) || tooCloseToPlaced(x, z, placed, 7)) continue;
          placed.push([x, z]);

          const tree = createTree({
            height: 3.4 + pseudoRandom(x * 0.4 + z) * 2.6,
            canopyScale: 0.46 + pseudoRandom(z * 0.5 - x) * 0.38,
            leafMaterial: bushMaterials[(i + Math.abs(Math.round(x))) % bushMaterials.length],
            trunkMaterial
          });
          tree.position.set(x, 0.02, z);
          tree.rotation.y = pseudoRandom(x - z) * Math.PI * 2;
          group.add(tree);
        }
      });
    }

    this.realityLayer.add(group);
  }

  addRealityMapOverlay(slice) {
    if (!this.map?.isStyleLoaded()) return;

    const sourceId = 'osm-reality-roads';
    const data = {
      type: 'FeatureCollection',
      features: slice.roads.slice(0, 220).map((road) => ({
        type: 'Feature',
        properties: { name: road.name, type: road.type, highway: road.highway },
        geometry: { type: 'LineString', coordinates: road.coordinates }
      }))
    };

    if (this.map.getSource(sourceId)) {
      this.map.getSource(sourceId).setData(data);
      return;
    }

    this.map.addSource(sourceId, { type: 'geojson', data });
    this.map.addLayer({
      id: 'osm-reality-roads',
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#f9d37a',
        'line-width': 2,
        'line-opacity': 0.55
      }
    });
  }

  setRealityStatus(message) {
    const status = document.querySelector('[data-reality-status]');
    if (status) status.textContent = message;
  }

  addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, 1300),
      createTerrainMaterial()
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, RIVER_WIDTH),
      new THREE.MeshStandardMaterial({ color: TOY_COLORS.river, roughness: 0.32, metalness: 0.05 })
    );
    river.position.set(0, 0.015, RIVER_CENTER_Z);
    river.rotation.x = -Math.PI / 2;
    this.scene.add(river);

    for (let i = 0; i < 9; i += 1) {
      const wave = new THREE.Mesh(
        new THREE.BoxGeometry(95 + i * 9, 0.018, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.34 })
      );
      wave.position.set(-460 + i * 118, 0.04, RIVER_CENTER_Z - 38 + (i % 3) * 27);
      wave.rotation.y = 0.12 + i * 0.03;
      this.scene.add(wave);
    }

    const riverGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22 })
    );
    riverGlow.position.set(0, 0.025, RIVER_START_Z - 8);
    riverGlow.rotation.x = -Math.PI / 2;
    this.scene.add(riverGlow);

    const quay = new THREE.Mesh(
      new RoundedBoxGeometry(1300, 0.34, 6, 2, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xdec98f, roughness: 0.82 })
    );
    quay.position.set(0, 0.14, RIVER_START_Z);
    quay.receiveShadow = true;
    this.scene.add(quay);
  }

  addRoads() {
    const asphalt = new THREE.MeshStandardMaterial({ color: TOY_COLORS.road, roughness: 0.86 });
    const stripe = new THREE.MeshBasicMaterial({ color: 0xffd766 });
    const sidewalk = new THREE.MeshStandardMaterial({ color: CALCADA_LIGHT, roughness: 0.92 });
    const mosaic = new THREE.MeshBasicMaterial({ color: CALCADA_DARK });

    for (const road of this.roads) {
      forEachSegment(road.points, (start, end, length, midpoint, rotation) => {
        const mesh = new THREE.Mesh(
          new RoundedBoxGeometry(ROAD_WIDTH[road.type], 0.08, length, 1, 0.35),
          asphalt
        );
        mesh.position.set(midpoint[0], 0.04, midpoint[1]);
        mesh.rotation.y = rotation;
        mesh.receiveShadow = true;
        this.roadLayer.add(mesh);

        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, length * 0.86), stripe);
        centerLine.position.set(midpoint[0], 0.085, midpoint[1]);
        centerLine.rotation.y = rotation;
        this.roadLayer.add(centerLine);

        const sidewalkWidth = road.type === 'lane' ? 2.4 : 3.8;
        for (const side of [-1, 1]) {
          const offset = side * (ROAD_WIDTH[road.type] / 2 + sidewalkWidth / 2 + 0.65);
          const walk = new THREE.Mesh(new RoundedBoxGeometry(sidewalkWidth, 0.08, length, 1, 0.25), sidewalk);
          walk.position.set(midpoint[0], 0.06, midpoint[1]);
          walk.rotation.y = rotation;
          walk.translateX(offset);
          walk.receiveShadow = true;
          this.roadLayer.add(walk);

          const tileCount = Math.max(1, Math.floor(length / 32));
          for (let i = 0; i < tileCount; i += 1) {
            const tile = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 6.5), mosaic);
            tile.position.set(midpoint[0], 0.088, midpoint[1]);
            tile.rotation.y = rotation + (i % 2 === 0 ? 0.55 : -0.55);
            tile.translateX(offset);
            tile.translateZ(-length / 2 + 16 + i * 32);
            this.roadLayer.add(tile);
          }
        }
      });
    }
  }

  addBuildings() {
    const roofMaterial = new THREE.MeshStandardMaterial({ color: TERRACOTTA, roughness: 0.78 });
    const tileMaterial = new THREE.MeshStandardMaterial({ color: AZULEJO_BLUE, roughness: 0.5 });
    const balconyMaterial = new THREE.MeshStandardMaterial({ color: 0x24323f, roughness: 0.62, metalness: 0.18 });
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f93, roughness: 0.28, metalness: 0.08 });
    const awningMaterial = new THREE.MeshStandardMaterial({ color: 0xe54b4b, roughness: 0.7 });
    const occupied = new Set();

    for (const road of this.roads) {
      forEachSegment(road.points, (start, end, length, _midpoint, rotation) => {
        const count = Math.max(2, Math.floor(length / 42));
        const dir = normalize([end[0] - start[0], end[1] - start[1]]);
        const normal = [-dir[1], dir[0]];

        for (let i = 1; i < count; i += 1) {
          const t = i / count;
          const base = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];

          for (const side of [-1, 1]) {
            const width = 14 + ((i * 7) % 16);
            const depth = 16 + ((i * 11) % 22);
            const height = 10 + ((i * 13 + Math.abs(Math.round(base[0]))) % 34);
            const x = base[0] + normal[0] * side * (ROAD_WIDTH[road.type] * 0.72 + depth);
            const z = base[1] + normal[1] * side * (ROAD_WIDTH[road.type] * 0.72 + depth);
            const key = `${Math.round(x / 18)}:${Math.round(z / 18)}`;

            if (z + depth / 2 > RIVER_START_Z - 12) continue;
            if (occupied.has(key) || this.distanceToRoads(x, z) < ROAD_WIDTH[road.type] * 0.8) continue;
            occupied.add(key);

            const building = new THREE.Mesh(
              new RoundedBoxGeometry(width, height, depth, 2, 0.7),
              new THREE.MeshStandardMaterial({
                color: FACADE_PALETTE[(i + (side > 0 ? 2 : 0)) % FACADE_PALETTE.length],
                roughness: 0.74
              })
            );
            building.position.set(x, height / 2, z);
            building.rotation.y = rotation + (side > 0 ? 0.05 : -0.05);
            building.castShadow = true;
            building.receiveShadow = true;
            this.buildingLayer.add(building);
            this.addFacadeDetails({
              x,
              z,
              width,
              height,
              depth,
              rotation: building.rotation.y,
              windowMaterial,
              awningMaterial
            });
            this.buildingColliders.push({
              x,
              z,
              halfWidth: width / 2 + 1.45,
              halfDepth: depth / 2 + 1.45,
              rotation: building.rotation.y
            });

            const roof = new THREE.Mesh(
              new RoundedBoxGeometry(width * 1.08, 0.7, depth * 1.06, 1, 0.4),
              roofMaterial
            );
            roof.position.set(x, height + 0.28, z);
            roof.rotation.y = building.rotation.y;
            roof.castShadow = true;
            this.buildingLayer.add(roof);

            if ((i + side) % 2 === 0) {
              const tilePanel = new THREE.Mesh(
                new THREE.BoxGeometry(width * 0.5, Math.min(6, height * 0.45), 0.16),
                tileMaterial
              );
              tilePanel.position.set(x, Math.min(height - 2.2, 6.2), z);
              tilePanel.rotation.y = building.rotation.y;
              tilePanel.translateZ(-depth / 2 - 0.12);
              this.buildingLayer.add(tilePanel);
            }

            if (height > 18) {
              const balcony = new THREE.Mesh(
                new THREE.BoxGeometry(width * 0.62, 0.18, 0.42),
                balconyMaterial
              );
              balcony.position.set(x, 8.8, z);
              balcony.rotation.y = building.rotation.y;
              balcony.translateZ(-depth / 2 - 0.38);
              balcony.castShadow = true;
              this.buildingLayer.add(balcony);
            }
          }
        }
      });
    }
  }

  addFacadeDetails({ x, z, width, height, depth, rotation, windowMaterial, awningMaterial }) {
    const floors = Math.max(2, Math.min(6, Math.floor(height / 5)));
    const columns = Math.max(2, Math.min(5, Math.floor(width / 5)));
    const facadeDepth = -depth / 2 - 0.14;

    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const window = new THREE.Mesh(
          new RoundedBoxGeometry(1.1, 1.35, 0.12, 1, 0.08),
          windowMaterial
        );
        window.position.set(x, 3.2 + floor * 4.2, z);
        window.rotation.y = rotation;
        window.translateX((column - (columns - 1) / 2) * (width / (columns + 0.7)));
        window.translateZ(facadeDepth);
        this.buildingLayer.add(window);
      }
    }

    if (width > 18) {
      const awning = new THREE.Mesh(
        new RoundedBoxGeometry(width * 0.46, 0.34, 0.8, 1, 0.12),
        awningMaterial
      );
      awning.position.set(x, 2.65, z);
      awning.rotation.y = rotation;
      awning.translateZ(facadeDepth - 0.28);
      awning.castShadow = true;
      this.buildingLayer.add(awning);
    }
  }

  addVegetation() {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const leafMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x2f6f3e, roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: 0x3f8f46, roughness: 0.86 }),
      new THREE.MeshStandardMaterial({ color: 0x6a8f3f, roughness: 0.88 })
    ];
    const shrubMaterial = new THREE.MeshStandardMaterial({ color: 0x4f7f3f, roughness: 0.9 });
    const vegetation = new THREE.Group();

    for (const road of this.roads) {
      forEachSegment(road.points, (start, end, length) => {
        const dir = normalize([end[0] - start[0], end[1] - start[1]]);
        const normal = [-dir[1], dir[0]];
        const count = Math.max(1, Math.floor(length / 58));

        for (let i = 1; i <= count; i += 1) {
          const t = (i - 0.35) / (count + 0.3);
          const base = [
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t
          ];

          for (const side of [-1, 1]) {
            const seed = pseudoRandom(base[0] * 0.13 + base[1] * 0.07 + side * 17 + i);
            const offset = ROAD_WIDTH[road.type] * 0.82 + 7 + seed * 12;
            const x = base[0] + normal[0] * side * offset;
            const z = base[1] + normal[1] * side * offset;

            if (this.distanceToRoads(x, z) < ROAD_WIDTH[road.type] * 0.72 || Math.abs(z) > 540) continue;

            const tree = createTree({
              height: 5.5 + seed * 4,
              canopyScale: 0.85 + seed * 0.55,
              leafMaterial: leafMaterials[(i + (side > 0 ? 1 : 0)) % leafMaterials.length],
              trunkMaterial
            });
            tree.position.set(x, 0, z);
            tree.rotation.y = seed * Math.PI * 2;
            vegetation.add(tree);

            if (seed > 0.45) {
              const shrub = new THREE.Mesh(
                new THREE.DodecahedronGeometry(1.2 + seed * 0.9, 0),
                shrubMaterial
              );
              shrub.position.set(
                x + normal[0] * side * (2.5 + seed * 2),
                0.8,
                z + normal[1] * side * (2.5 + seed * 2)
              );
              shrub.scale.set(1.2, 0.7, 1);
              shrub.castShadow = true;
              vegetation.add(shrub);
            }
          }
        }
      });
    }

    this.scene.add(vegetation);
  }

  addLisbonDetails() {
    this.addCalcadaPlaza([-72, 285], 105, 58);
    this.addToyArch([-8, 285]);
    this.addToyCastle([344, -44]);
    this.addToyTram([-120, -55], segmentHeading([-135, -120], [-105, -45]));
    this.addTramRails();
    this.addStreetFurniture();
  }

  addStreetFurniture() {
    const group = new THREE.Group();
    const lampMetal = new THREE.MeshStandardMaterial({ color: 0x1d2a2f, roughness: 0.55, metalness: 0.2 });
    const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe7a3 });
    const benchWood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.78 });
    const kioskRed = new THREE.MeshStandardMaterial({ color: 0xb53b2d, roughness: 0.62 });
    const kioskCream = new THREE.MeshStandardMaterial({ color: 0xf6e7c8, roughness: 0.75 });
    const crosswalkPaint = new THREE.MeshBasicMaterial({ color: 0xf8f5e9 });

    for (const road of this.roads) {
      forEachSegment(road.points, (start, end, length, midpoint, rotation) => {
        if (length > 70) {
          const crosswalk = new THREE.Group();
          for (let stripe = -2; stripe <= 2; stripe += 1) {
            const mark = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH[road.type] * 0.72, 0.02, 0.7), crosswalkPaint);
            mark.position.set(midpoint[0], 0.13, midpoint[1]);
            mark.rotation.y = rotation;
            mark.translateZ(stripe * 1.4);
            crosswalk.add(mark);
          }
          group.add(crosswalk);
        }

        const dir = normalize([end[0] - start[0], end[1] - start[1]]);
        const normal = [-dir[1], dir[0]];
        const detailCount = Math.max(1, Math.floor(length / 85));
        for (let i = 1; i <= detailCount; i += 1) {
          const t = i / (detailCount + 1);
          const base = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
          for (const side of [-1, 1]) {
            const x = base[0] + normal[0] * side * (ROAD_WIDTH[road.type] / 2 + 5.4);
            const z = base[1] + normal[1] * side * (ROAD_WIDTH[road.type] / 2 + 5.4);
            if (z > RIVER_START_Z - 6 || this.distanceToRoads(x, z) < ROAD_WIDTH[road.type] * 0.45) continue;

            const lamp = createLamp(lampMetal, lampGlow);
            lamp.position.set(x, 0.12, z);
            group.add(lamp);

            if ((i + side) % 3 === 0) {
              const bench = createBench(benchWood, lampMetal);
              bench.position.set(x + normal[0] * side * 3, 0.1, z + normal[1] * side * 3);
              bench.rotation.y = segmentHeading(start, end);
              group.add(bench);
            }
          }
        }
      });
    }

    for (const [x, z] of [[-95, 262], [42, 308], [190, 498], [-255, 486]]) {
      const kiosk = createKiosk(kioskRed, kioskCream);
      kiosk.position.set(x, 0.1, z);
      kiosk.rotation.y = pseudoRandom(x + z) * Math.PI;
      group.add(kiosk);
    }

    this.scene.add(group);
  }

  addCalcadaPlaza(center, width, depth) {
    const plaza = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.045, depth),
      new THREE.MeshStandardMaterial({ color: CALCADA_LIGHT, roughness: 0.94 })
    );
    base.position.set(center[0], 0.11, center[1]);
    base.receiveShadow = true;
    plaza.add(base);

    const dark = new THREE.MeshBasicMaterial({ color: CALCADA_DARK });
    for (let i = -4; i <= 4; i += 1) {
      const wave = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, 0.018, 0.42), dark);
      wave.position.set(center[0], 0.145, center[1] + i * 5.2);
      wave.rotation.y = Math.sin(i) * 0.26;
      plaza.add(wave);
    }

    this.scene.add(plaza);
  }

  addToyArch(position) {
    const arch = createToyArch();
    arch.position.set(position[0], 0.08, position[1]);
    arch.rotation.y = -0.2;
    this.scene.add(arch);
  }

  addToyCastle(position) {
    const castle = createToyCastle();
    castle.position.set(position[0], 0.08, position[1]);
    castle.rotation.y = 0.42;
    this.scene.add(castle);
  }

  addToyTram(position, heading) {
    const tram = createToyTram();
    tram.position.set(position[0], 0.12, position[1]);
    tram.rotation.y = -heading;
    this.scene.add(tram);
  }

  addTramRails() {
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x6f7374, roughness: 0.52, metalness: 0.35 });
    const road = this.roads.find((candidate) => candidate.name === 'Rua Augusta');
    if (!road) return;

    forEachSegment(road.points, (start, end, length, midpoint, rotation) => {
      for (const x of [-1.15, 1.15]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, length), railMaterial);
        rail.position.set(midpoint[0], 0.14, midpoint[1]);
        rail.rotation.y = rotation;
        rail.translateX(x);
        this.scene.add(rail);
      }
    });
  }

  addCityLife() {
    const life = new THREE.Group();
    const carColors = VEHICLE_PALETTE;

    this.roads.forEach((road, roadIndex) => {
      const length = pathLength(road.points);
      const pedestrianCount = road.type === 'lane' ? 5 : 8;
      const trafficCount = road.type === 'lane' ? 2 : 4;

      for (let i = 0; i < pedestrianCount; i += 1) {
        const side = i % 2 === 0 ? 1 : -1;
        const actor = {
          mesh: createPerson((roadIndex + i) % 5),
          route: road.points,
          distance: ((i + 0.25) / pedestrianCount) * length,
          speed: 1.3 + pseudoRandom(roadIndex * 9 + i) * 1.1,
          offset: side * (ROAD_WIDTH[road.type] / 2 + 4.1),
          direction: i % 3 === 0 ? -1 : 1,
          bob: pseudoRandom(i * 31 + roadIndex) * Math.PI * 2,
          kind: 'person',
          radius: 0.64
        };
        this.updatePathActor(actor, 0);
        actor.mesh.scale.setScalar(0.84);
        this.actors.push(actor);
        life.add(actor.mesh);
      }

      for (let i = 0; i < trafficCount; i += 1) {
        const actor = {
          mesh: createParkedCar(carColors[(roadIndex + i) % carColors.length]),
          route: road.points,
          distance: ((i + 0.5) / trafficCount) * length,
          speed: 6 + pseudoRandom(roadIndex * 17 + i) * 5,
          offset: i % 2 === 0 ? -ROAD_WIDTH[road.type] * 0.21 : ROAD_WIDTH[road.type] * 0.21,
          direction: i % 2 === 0 ? 1 : -1,
          bob: 0,
          kind: 'traffic',
          radius: 1.28
        };
        this.updatePathActor(actor, 0);
        actor.mesh.scale.setScalar(0.58);
        this.actors.push(actor);
        life.add(actor.mesh);
      }

      if (roadIndex % 2 === 0) {
        const dog = {
          mesh: createDog(),
          route: road.points,
          distance: length * (0.2 + pseudoRandom(roadIndex) * 0.55),
          speed: 1.8 + pseudoRandom(roadIndex * 21) * 1.6,
          offset: ROAD_WIDTH[road.type] / 2 + 6.5,
          direction: roadIndex % 4 === 0 ? -1 : 1,
          bob: pseudoRandom(roadIndex * 13) * Math.PI * 2,
          kind: 'dog',
          radius: 0.54
        };
        this.updatePathActor(dog, 0);
        dog.mesh.scale.setScalar(0.68);
        this.actors.push(dog);
        life.add(dog.mesh);
      }
    });

    const parkedCars = [
      [-155, 286, -0.2, 0x2f80ed], [72, 318, -0.12, 0xf2c94c], [-150, 98, 1.35, 0x27ae60],
      [176, 56, 1.4, 0xeb5757], [-86, -58, 0.7, 0x9b51e0], [292, -24, 1.25, 0xf2994a]
    ];
    for (const [x, z, yaw, color] of parkedCars) {
      const parked = createParkedCar(color);
      parked.position.set(x, 0.08, z);
      parked.rotation.y = yaw;
      life.add(parked);
      parked.scale.setScalar(0.58);
      this.staticColliders.push({ mesh: parked, radius: 1.28, kind: 'parked' });
    }

    for (const [x, z] of [[-35, 510], [95, 498], [220, 520], [-180, 492]]) {
      const gull = createSeagull();
      gull.position.set(x, 13 + pseudoRandom(x + z) * 8, z);
      gull.rotation.y = pseudoRandom(x * z) * Math.PI;
      life.add(gull);
    }

    this.scene.add(life);
  }

  addWeather() {
    const clouds = new THREE.Group();
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
    for (const [x, y, z, scale] of [[-160, 95, 40, 1.1], [90, 120, 150, 1.4], [260, 88, -90, 0.9]]) {
      const cloud = new THREE.Group();
      for (const offset of [[0, 0, 0], [5, 1.2, 0.8], [-5, 0.6, 1.2], [1.5, 1.8, -1.2]]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(5 * scale, 12, 8), cloudMaterial);
        puff.position.set(offset[0] * scale, offset[1] * scale, offset[2] * scale);
        puff.scale.y = 0.55;
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      clouds.add(cloud);
    }
    this.scene.add(clouds);

    this.rainGroup = new THREE.Group();
    const rainMaterial = new THREE.MeshBasicMaterial({ color: 0xb7d9ff, transparent: true, opacity: 0.16 });
    this.rainDrops = [];
    for (let i = 0; i < 44; i += 1) {
      const drop = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.7, 0.025), rainMaterial);
      drop.position.set(
        (pseudoRandom(i * 11.3) - 0.5) * 180,
        18 + pseudoRandom(i * 23.7) * 55,
        (pseudoRandom(i * 41.9) - 0.5) * 180
      );
      drop.rotation.z = -0.18;
      this.rainDrops.push(drop);
      this.rainGroup.add(drop);
    }
    this.scene.add(this.rainGroup);
  }

  updateWeather(dt) {
    if (!this.rainGroup || !this.rainDrops) return;
    this.rainGroup.position.set(this.car.position.x, 0, this.car.position.z);
    for (const drop of this.rainDrops) {
      drop.position.y -= 48 * dt;
      drop.position.x += 5 * dt;
      if (drop.position.y < 2) {
        drop.position.y = 58 + pseudoRandom(drop.position.x + drop.position.z) * 18;
      }
    }
  }

  addLandmarks() {
    for (const landmark of LANDMARKS) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 12, 42, 6),
        new THREE.MeshStandardMaterial({ color: landmark.color, roughness: 0.62 })
      );
      marker.position.set(landmark.position[0], 21, landmark.position[1]);
      marker.castShadow = true;
      this.scene.add(marker);
    }
  }

  bindEvents() {
    document.querySelector('[data-action="drive"]').addEventListener('click', () => {
      this.startAudio();
      this.setMode('drive');
    });
    document.querySelector('[data-action="map"]').addEventListener('click', () => this.setMode('aerial'));
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      this.keys.add(key);
      this.startAudio();

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
      }
      if (key === 'm') this.setMode('aerial');
      if (key === 'r') this.respawn();
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  setMode(mode) {
    this.mode = mode;
    document.querySelector('[data-mode="aerial"]').classList.toggle('is-hidden', mode !== 'aerial');
    document.querySelector('[data-mode="drive"]').classList.toggle('is-hidden', mode !== 'drive');
    this.resize();

    if (mode === 'aerial') {
      this.syncMapMarker(true);
    } else {
      this.snapCameraToCar();
    }
  }

  createCarState() {
    const requested = new THREE.Vector3(START_POSITION[0], 0.38, START_POSITION[1]);
    const spawnRoad = this.nearestRoad(requested.x, requested.z);
    const position = new THREE.Vector3(spawnRoad.point[0], 0.38, spawnRoad.point[1]);

    return {
      position,
      heading: spawnRoad.heading,
      speed: 0,
      steering: 0,
      streetName: spawnRoad.road.name,
      onRoad: true
    };
  }

  respawn() {
    this.car = this.createCarState();
    this.syncCarMesh();
    this.snapCameraToCar();
    this.updateHud();
    this.syncMapMarker(false);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.mode === 'drive') {
      this.updateCar(dt);
      this.updateActors(dt);
      this.updateCamera(dt);
      this.updateHud();
      this.updateAudio(dt);
      this.renderer.render(this.scene, this.camera);
    }
  }

  startAudio() {
    if (this.audio) {
      this.audio.context.resume?.();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    const master = context.createGain();
    const engineGain = context.createGain();
    const engine = context.createOscillator();
    const undertone = context.createOscillator();
    const filter = context.createBiquadFilter();

    master.gain.value = 0.045;
    engineGain.gain.value = 0.001;
    engine.type = 'sawtooth';
    undertone.type = 'triangle';
    engine.frequency.value = 52;
    undertone.frequency.value = 26;
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.7;

    engine.connect(filter);
    undertone.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    master.connect(context.destination);
    engine.start();
    undertone.start();

    this.audio = { context, engine, undertone, filter, engineGain };
  }

  updateAudio() {
    if (!this.audio) return;

    const { context, engine, undertone, filter, engineGain } = this.audio;
    const now = context.currentTime;
    const speed = Math.abs(this.car.speed);
    const throttle = this.hasInput('w', 'arrowup') ? 1 : 0;
    const targetFrequency = 44 + speed * 1.9 + throttle * 32;
    const targetGain = this.mode === 'drive' ? 0.008 + Math.min(speed / 130, 1) * 0.04 + throttle * 0.015 : 0.001;

    engine.frequency.setTargetAtTime(targetFrequency, now, 0.08);
    undertone.frequency.setTargetAtTime(targetFrequency * 0.5, now, 0.08);
    filter.frequency.setTargetAtTime(420 + speed * 9, now, 0.12);
    engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
  }

  updateCar(dt) {
    const throttle = this.hasInput('w', 'arrowup') ? 1 : 0;
    const reverse = this.hasInput('s', 'arrowdown') ? 1 : 0;
    const brake = this.keys.has(' ') ? 1 : 0;
    const boost = this.keys.has('shift') ? 1.35 : 1;
    const steerInput = (this.hasInput('a', 'arrowleft') ? 1 : 0) - (this.hasInput('d', 'arrowright') ? 1 : 0);

    const nearest = this.nearestRoad(this.car.position.x, this.car.position.z);
    const roadEdge = ROAD_WIDTH[nearest.road.type] * 0.76;
    const offRoadDistance = Math.max(0, nearest.distance - roadEdge);
    const offRoadPenalty = clamp(1 - offRoadDistance / 95, 0.72, 1);
    const speedLimit = Math.max(ROAD_SPEED[nearest.road.type] * 1.45, 92);
    const acceleration = 72 * throttle * boost - 38 * reverse - 92 * brake;
    const drag = 2.4 + Math.abs(this.car.speed) * 0.018;

    this.car.speed += acceleration * offRoadPenalty * dt;
    this.car.speed -= Math.sign(this.car.speed) * drag * dt;
    if (Math.abs(this.car.speed) < 0.35 && !throttle && !reverse) this.car.speed = 0;
    this.car.speed = clamp(this.car.speed, -34, speedLimit * offRoadPenalty * boost);

    const targetSteering = steerInput * (1 - Math.min(Math.abs(this.car.speed) / 230, 0.46));
    this.car.steering += (targetSteering - this.car.steering) * Math.min(1, dt * 9);

    const turnRate = this.car.steering * (0.95 + Math.min(Math.abs(this.car.speed) / 85, 1.15));
    this.car.heading -= turnRate * Math.sign(this.car.speed || 1) * dt;

    const previousPosition = this.car.position.clone();
    const metersPerSecond = this.car.speed / 3.6;
    this.car.position.x += Math.sin(this.car.heading) * metersPerSecond * dt;
    this.car.position.z -= Math.cos(this.car.heading) * metersPerSecond * dt;

    this.resolveCarCollisions(previousPosition);
    this.resolveActorCollisions();

    const afterMove = this.nearestRoad(this.car.position.x, this.car.position.z);
    this.car.onRoad = afterMove.distance <= ROAD_WIDTH[afterMove.road.type] * 0.85;
    this.car.streetName = afterMove.road.name;

    this.syncCarMesh();

    this.lastMapSync += dt;
    if (this.lastMapSync > 0.35) {
      this.syncMapMarker(false);
      this.lastMapSync = 0;
    }

    this.updateWeather(dt);
  }

  resolveCarCollisions(previousPosition) {
    let collided = false;

    for (const collider of this.buildingColliders) {
      const resolved = resolveCircleBox(
        this.car.position.x,
        this.car.position.z,
        1.18,
        collider
      );

      if (resolved) {
        this.car.position.x = resolved.x;
        this.car.position.z = resolved.z;
        collided = true;
      }
    }

    if (!collided) return;

    const stillInside = this.buildingColliders.some((collider) => (
      pointInRotatedBox(this.car.position.x, this.car.position.z, collider)
    ));

    if (stillInside) {
      this.car.position.copy(previousPosition);
    }

    this.car.speed *= -0.18;
    this.car.steering *= 0.35;
  }

  resolveActorCollisions() {
    const colliders = [
      ...this.staticColliders,
      ...this.actors.map((actor) => ({
        mesh: actor.mesh,
        radius: actor.radius,
        kind: actor.kind,
        actor
      }))
    ];

    for (const collider of colliders) {
      const dx = this.car.position.x - collider.mesh.position.x;
      const dz = this.car.position.z - collider.mesh.position.z;
      const minDistance = 0.94 + collider.radius;
      const distance = Math.hypot(dx, dz);

      if (distance >= minDistance || distance < 0.001) continue;

      const nx = dx / distance;
      const nz = dz / distance;
      const push = minDistance - distance;
      this.car.position.x += nx * push;
      this.car.position.z += nz * push;

      if (collider.actor && collider.kind !== 'traffic') {
        collider.actor.direction *= -1;
        collider.actor.distance += collider.actor.direction * 3;
      }

      if (collider.actor && collider.kind === 'traffic') {
        collider.actor.speed *= 0.65;
      }

      this.car.speed *= collider.kind === 'traffic' || collider.kind === 'parked' ? -0.32 : -0.12;
      this.car.steering *= 0.5;
    }
  }

  updateActors(dt) {
    for (const actor of this.actors) {
      this.updatePathActor(actor, dt);
    }
  }

  updatePathActor(actor, dt) {
    const routeLength = pathLength(actor.route);
    actor.distance = wrap(actor.distance + actor.speed * actor.direction * dt, 0, routeLength);
    const sample = pointAtPath(actor.route, actor.distance);
    const side = new THREE.Vector2(Math.cos(sample.heading), Math.sin(sample.heading));

    actor.mesh.position.set(
      sample.x + side.x * actor.offset,
      actor.kind === 'traffic' ? 0.08 : 0.12,
      sample.z + side.y * actor.offset
    );
    actor.mesh.rotation.y = -sample.heading + (actor.direction < 0 ? Math.PI : 0);

    if (actor.kind !== 'traffic') {
      actor.bob += dt * actor.speed * 5;
      actor.mesh.position.y += Math.sin(actor.bob) * 0.08;
    } else {
      const nearest = this.nearestRoad(actor.mesh.position.x, actor.mesh.position.z);
      if (nearest.distance > ROAD_WIDTH[nearest.road.type] * 0.48) {
        actor.direction *= -1;
      }
    }
  }

  updateCamera(dt) {
    const { desired, lookAt } = this.getCameraRig();
    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    this.camera.lookAt(lookAt);
  }

  syncCarMesh() {
    if (!this.carMesh) return;
    this.carMesh.position.copy(this.car.position);
    this.carMesh.rotation.y = -this.car.heading;
  }

  snapCameraToCar() {
    if (!this.camera || !this.car) return;
    const { desired, lookAt } = this.getCameraRig();
    this.camera.position.copy(desired);
    this.camera.lookAt(lookAt);
  }

  getCameraRig() {
    const forward = new THREE.Vector3(Math.sin(this.car.heading), 0, -Math.cos(this.car.heading));
    const desired = this.car.position
      .clone()
      .addScaledVector(forward, -5)
      .add(new THREE.Vector3(0, 68, 0));
    const lookAt = this.car.position
      .clone()
      .addScaledVector(forward, 6)
      .add(new THREE.Vector3(0, 0.7, 0));

    return { desired, lookAt };
  }

  updateHud() {
    document.querySelector('[data-hud="speed"]').textContent = Math.round(Math.abs(this.car.speed));
    document.querySelector('[data-hud="street"]').textContent = this.car.streetName;
    document.querySelector('[data-hud="status"]').textContent = this.car.onRoad ? 'full throttle' : 'free roam';
  }

  syncMapMarker(animate) {
    if (!this.carMarker) return;
    const lngLat = worldToLngLat(this.car.position.x, this.car.position.z);
    this.carMarker.setLngLat(lngLat);
    if (animate && this.map) {
      this.map.easeTo({ center: lngLat, duration: 600 });
    }
  }

  resize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const { clientWidth, clientHeight } = this.canvas;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.map?.resize();
  }

  nearestRoad(x, z) {
    let best = null;

    for (const road of this.roads) {
      forEachSegment(road.points, (start, end) => {
        const hit = closestPointOnSegment([x, z], start, end);
        if (!best || hit.distance < best.distance) {
          best = { ...hit, road, heading: segmentHeading(start, end) };
        }
      });
    }

    return best;
  }

  distanceToRoads(x, z) {
    return this.nearestRoad(x, z).distance;
  }

  hasInput(...keys) {
    return keys.some((key) => this.keys.has(key));
  }
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "Avenir Next", "Trebuchet MS", sans-serif;
      background: #111;
      color: #f9f1df;
    }

    * { box-sizing: border-box; }
    html, body, #app, .app-shell, .mode {
      width: 100%;
      height: 100%;
      margin: 0;
    }

    body { overflow: hidden; }
    button { font: inherit; }

    .mode {
      position: fixed;
      inset: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at 20% 10%, rgba(255, 209, 102, 0.24), transparent 28%),
        linear-gradient(135deg, #17202a 0%, #111 100%);
    }

    .is-hidden { display: none; }
    .map, #game-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    #game-canvas {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      filter: saturate(1.12) contrast(1.04);
    }

    .mode-drive::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(35, 28, 18, 0.035) 1px, transparent 1px),
        radial-gradient(circle at 40% 30%, rgba(255, 226, 150, 0.12), transparent 34%);
      background-size: 4px 4px, 4px 4px, 100% 100%;
      mix-blend-mode: soft-light;
      opacity: 0.55;
    }

    .panel {
      position: absolute;
      left: 24px;
      top: 24px;
      max-width: min(420px, calc(100vw - 48px));
      padding: 22px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      background: rgba(19, 24, 29, 0.78);
      box-shadow: 0 24px 90px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(18px);
    }

    .hero-panel h1, .drive-panel h2 {
      margin: 0;
      line-height: 0.98;
      letter-spacing: -0.05em;
    }

    .hero-panel h1 { font-size: clamp(2.4rem, 6vw, 5.5rem); }
    .drive-panel h2 { font-size: clamp(2rem, 5vw, 3.8rem); }

    .drive-panel {
      max-width: 238px;
      padding: 12px 14px;
      border-radius: 20px;
      opacity: 0.74;
    }

    .drive-panel h2 {
      font-size: clamp(1.15rem, 2.4vw, 1.65rem);
      letter-spacing: -0.04em;
    }

    .drive-panel p {
      margin-top: 8px;
      font-size: 0.82rem;
      line-height: 1.35;
    }

    .drive-panel .secondary-action {
      margin-top: 10px;
      padding: 9px 13px;
      font-size: 0.82rem;
    }

    .reality-chip {
      display: inline-flex;
      max-width: 100%;
      margin-top: 9px !important;
      border: 1px solid rgba(255, 209, 102, 0.22);
      border-radius: 999px;
      padding: 5px 8px;
      color: rgba(255, 226, 165, 0.86) !important;
      background: rgba(255, 209, 102, 0.08);
      font-size: 0.64rem !important;
      font-weight: 800;
      letter-spacing: 0.08em;
      line-height: 1.2 !important;
      text-transform: uppercase;
    }

    .panel p {
      color: rgba(249, 241, 223, 0.78);
      line-height: 1.55;
      margin: 14px 0 0;
    }

    .eyebrow {
      margin: 0 0 12px !important;
      color: #ffd166 !important;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .primary-action, .secondary-action {
      margin-top: 20px;
      border: 0;
      border-radius: 999px;
      padding: 13px 18px;
      color: #1b1b1b;
      background: #ffd166;
      cursor: pointer;
      font-weight: 850;
      transition: transform 160ms ease, filter 160ms ease;
    }

    .secondary-action { background: #f8ead1; }
    .primary-action:hover, .secondary-action:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }

    .hud {
      position: absolute;
      left: 50%;
      bottom: 22px;
      display: grid;
      grid-template-columns: auto minmax(180px, 1fr) auto;
      gap: 10px;
      align-items: center;
      width: min(720px, calc(100vw - 32px));
      transform: translateX(-50%);
    }

    .speed, .street, .status {
      min-height: 62px;
      border: 1px solid rgba(255, 241, 207, 0.22);
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(20, 22, 24, 0.74), rgba(8, 10, 12, 0.84));
      backdrop-filter: blur(16px);
      box-shadow: 0 18px 55px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .speed {
      display: grid;
      min-width: 118px;
      place-items: center;
      padding: 10px 16px;
    }

    .speed strong {
      display: block;
      font-size: 2.2rem;
      line-height: 0.9;
      font-variant-numeric: tabular-nums;
    }

    .speed span, .status {
      color: rgba(249, 241, 223, 0.65);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    .street {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px 22px;
      color: #ffd166;
      font-weight: 850;
      text-align: center;
    }

    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 150px;
      padding: 12px 16px;
    }

    @media (max-width: 720px) {
      .panel {
        left: 14px;
        top: 14px;
        padding: 18px;
      }

      .hud {
        grid-template-columns: 1fr;
        bottom: 14px;
      }

      .speed, .street, .status {
        min-height: 52px;
      }

      .drive-panel {
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function worldToLngLat(x, z) {
  return [LISBON_CENTER[0] + x * DEG_PER_METER_LNG, LISBON_CENTER[1] - z * DEG_PER_METER_LAT];
}

function lngLatToWorld(lng, lat) {
  return [(lng - LISBON_CENTER[0]) / DEG_PER_METER_LNG, -(lat - LISBON_CENTER[1]) / DEG_PER_METER_LAT];
}

function createTerrainMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  context.fillStyle = '#e7d8ad';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 16) {
    for (let x = 0; x < canvas.width; x += 16) {
      const shade = 214 + Math.floor(pseudoRandom(x * 9.7 + y * 13.1) * 18);
      context.fillStyle = `rgba(${shade}, ${shade - 11}, ${shade - 48}, 0.18)`;
      context.fillRect(x, y, 15, 15);
    }
  }

  context.strokeStyle = 'rgba(113, 105, 82, 0.12)';
  context.lineWidth = 1;
  for (let i = -canvas.width; i < canvas.width * 2; i += 22) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i + canvas.width, canvas.height);
    context.stroke();
  }

  for (let i = 0; i < 900; i += 1) {
    const x = pseudoRandom(i * 17.3) * canvas.width;
    const y = pseudoRandom(i * 29.9) * canvas.height;
    context.fillStyle = i % 2 === 0 ? 'rgba(255,255,240,0.18)' : 'rgba(118,104,76,0.1)';
    context.fillRect(x, y, 1.2, 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;

  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xf0dfb7,
    roughness: 0.98
  });
}

function simplifyFootprint(points) {
  if (points.length <= 12) return points;
  const step = Math.ceil(points.length / 12);
  const simplified = points.filter((_point, index) => index % step === 0);
  return simplified.length >= 4 ? simplified : points.slice(0, 12);
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

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ
  };
}

function createFootprintExtrusion(points, height) {
  const unique = removeDuplicateClosingPoint(points);
  const shape = new THREE.Shape();

  unique.forEach(([x, z], index) => {
    if (index === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 1
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createFlatShape(points) {
  const unique = removeDuplicateClosingPoint(points);
  const shape = new THREE.Shape();

  unique.forEach(([x, z], index) => {
    if (index === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function removeDuplicateClosingPoint(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.1) {
    return points.slice(0, -1);
  }
  return points;
}

function mergeJunctions(junctions) {
  const buckets = new Map();

  for (const junction of junctions) {
    const key = `${Math.round(junction.point[0] / 8)}:${Math.round(junction.point[1] / 8)}`;
    const bucket = buckets.get(key) || { x: 0, z: 0, width: 0, count: 0 };
    bucket.x += junction.point[0];
    bucket.z += junction.point[1];
    bucket.width = Math.max(bucket.width, junction.width);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.count > 1)
    .map((bucket) => ({
      x: bucket.x / bucket.count,
      z: bucket.z / bucket.count,
      radius: clamp(bucket.width * 0.42 + Math.min(bucket.count, 5) * 0.32, 3.2, 6.2)
    }));
}

function selectPlayableRoads(roads) {
  const usefulHighways = new Set([
    'primary',
    'secondary',
    'tertiary',
    'unclassified',
    'residential',
    'living_street',
    'service'
  ]);

  return roads
    .map((road) => ({
      ...road,
      points: road.points.filter(([x, z]) => isInsidePlayableBounds(x, z))
    }))
    .filter((road) => road.points.length >= 2 && usefulHighways.has(road.highway))
    .filter((road) => pathLength(road.points) > 16)
    .sort((a, b) => roadPriority(b) - roadPriority(a))
    .slice(0, 130);
}

function selectPlayableBuildings(buildings, roads) {
  const selected = [];
  const occupied = new Set();

  for (const building of buildings) {
    const points = simplifyFootprint(building.points).filter(([x, z]) => isInsidePlayableBounds(x, z));
    if (points.length < 4) continue;

    const bounds = footprintBounds(points);
    if (!isInsidePlayableBounds(bounds.centerX, bounds.centerZ)) continue;
    if (bounds.centerZ > RIVER_START_Z - 14) continue;
    if (bounds.width < 4 || bounds.depth < 4 || bounds.width > 62 || bounds.depth > 62) continue;

    const nearest = nearestRoadFromRoads(bounds.centerX, bounds.centerZ, roads);
    if (!nearest) continue;

    const roadWidth = ROAD_WIDTH[nearest.road.type] || ROAD_WIDTH.lane;
    const clearance = Math.max(bounds.width, bounds.depth) * 0.28 + roadWidth * 0.85;
    if (nearest.distance < clearance || nearest.distance > 56) continue;

    const key = `${Math.round(bounds.centerX / 5)}:${Math.round(bounds.centerZ / 5)}`;
    if (occupied.has(key)) continue;
    occupied.add(key);

    selected.push({
      ...building,
      points,
      height: building.height
    });
  }

  return selected
    .sort((a, b) => a.height - b.height)
    .slice(0, 300);
}

function addRealityWindows(group, bounds, height, rotation, material) {
  const columns = Math.max(1, Math.min(4, Math.floor(bounds.width / 5.2)));
  const floors = Math.max(1, Math.min(5, Math.floor(height / 4.4)));
  const facadeZ = -bounds.depth / 2 - 0.11;

  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const window = new THREE.Mesh(new RoundedBoxGeometry(0.85, 1.05, 0.08, 1, 0.05), material);
      window.position.set(bounds.centerX, 2.4 + floor * 3.7, bounds.centerZ);
      window.rotation.y = rotation;
      window.translateX((column - (columns - 1) / 2) * (bounds.width / (columns + 0.6)));
      window.translateZ(facadeZ);
      group.add(window);
    }
  }
}

function dominantFootprintRotation(points) {
  let bestLength = 0;
  let rotation = 0;

  forEachSegment(points, (start, end, length) => {
    if (length > bestLength) {
      bestLength = length;
      rotation = segmentHeading(start, end) * -1;
    }
  });

  return rotation;
}

function nearestRoadFromRoads(x, z, roads) {
  let best = null;

  for (const road of roads) {
    forEachSegment(road.points, (start, end) => {
      const hit = closestPointOnSegment([x, z], start, end);
      if (!best || hit.distance < best.distance) {
        best = { ...hit, road, heading: segmentHeading(start, end) };
      }
    });
  }

  return best;
}

function roadPriority(road) {
  const typeScore = { arterial: 4, street: 3, lane: 1 };
  return (typeScore[road.type] || 1) * 1000 + Math.min(pathLength(road.points), 900);
}

function isInsidePlayableBounds(x, z) {
  return (
    x >= PLAYABLE_BOUNDS.minX &&
    x <= PLAYABLE_BOUNDS.maxX &&
    z >= PLAYABLE_BOUNDS.minZ &&
    z <= PLAYABLE_BOUNDS.maxZ
  );
}

function tooCloseToPlaced(x, z, placed, minDistance) {
  return placed.some(([placedX, placedZ]) => Math.hypot(x - placedX, z - placedZ) < minDistance);
}

function forEachSegment(points, callback) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const rotation = Math.atan2(dx, dz);
    callback(start, end, length, midpoint, rotation);
  }
}

function segmentHeading(start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  return Math.atan2(dx, -dz);
}

function closestPointOnSegment(point, start, end) {
  const segment = [end[0] - start[0], end[1] - start[1]];
  const lengthSq = segment[0] ** 2 + segment[1] ** 2;
  const t = lengthSq === 0
    ? 0
    : clamp(((point[0] - start[0]) * segment[0] + (point[1] - start[1]) * segment[1]) / lengthSq, 0, 1);
  const projected = [start[0] + segment[0] * t, start[1] + segment[1] * t];

  return {
    point: projected,
    distance: Math.hypot(point[0] - projected[0], point[1] - projected[1])
  };
}

function pathLength(points) {
  let length = 0;
  forEachSegment(points, (_start, _end, segmentLength) => {
    length += segmentLength;
  });
  return length;
}

function pointAtPath(points, distance) {
  let remaining = distance;

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);

    if (remaining <= length || i === points.length - 2) {
      const t = length === 0 ? 0 : remaining / length;
      return {
        x: start[0] + dx * t,
        z: start[1] + dz * t,
        heading: segmentHeading(start, end)
      };
    }

    remaining -= length;
  }

  return {
    x: points[0][0],
    z: points[0][1],
    heading: 0
  };
}

function resolveCircleBox(x, z, radius, box) {
  const local = worldToBoxLocal(x, z, box);
  const closestX = clamp(local.x, -box.halfWidth, box.halfWidth);
  const closestZ = clamp(local.z, -box.halfDepth, box.halfDepth);
  const dx = local.x - closestX;
  const dz = local.z - closestZ;
  const distanceSq = dx ** 2 + dz ** 2;

  if (distanceSq > radius ** 2) return null;

  if (distanceSq > 0.0001) {
    const distance = Math.sqrt(distanceSq);
    local.x += (dx / distance) * (radius - distance);
    local.z += (dz / distance) * (radius - distance);
  } else {
    const pushX = box.halfWidth - Math.abs(local.x);
    const pushZ = box.halfDepth - Math.abs(local.z);
    if (pushX < pushZ) {
      local.x = Math.sign(local.x || 1) * (box.halfWidth + radius);
    } else {
      local.z = Math.sign(local.z || 1) * (box.halfDepth + radius);
    }
  }

  return boxLocalToWorld(local.x, local.z, box);
}

function pointInRotatedBox(x, z, box) {
  const local = worldToBoxLocal(x, z, box);
  return Math.abs(local.x) < box.halfWidth && Math.abs(local.z) < box.halfDepth;
}

function worldToBoxLocal(x, z, box) {
  const dx = x - box.x;
  const dz = z - box.z;
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  return {
    x: cos * dx - sin * dz,
    z: sin * dx + cos * dz
  };
}

function boxLocalToWorld(x, z, box) {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  return {
    x: box.x + cos * x + sin * z,
    z: box.z - sin * x + cos * z
  };
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1]) || 1;
  return [vector[0] / length, vector[1] / length];
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrap(value, min, max) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

new LisbonDriveDemo(document.getElementById('app')).start();
