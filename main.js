import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';

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

class LisbonDriveDemo {
  constructor(root) {
    this.root = root;
    this.mode = 'aerial';
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.lastMapSync = 0;

    this.car = this.createCarState();
  }

  start() {
    injectStyles();
    this.renderShell();
    this.initMap();
    this.initThree();
    this.bindEvents();
    this.animate();
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
              MapLibre handles the city context. Three.js owns the playable world, so drive mode
              stays fast and deterministic even before we add live OSM ingestion.
            </p>
            <button class="primary-action" data-action="drive">Enter Drive Mode</button>
          </div>
        </section>

        <section class="mode mode-drive is-hidden" data-mode="drive">
          <canvas id="game-canvas"></canvas>
          <div class="panel drive-panel">
            <p class="eyebrow">Drive Mode</p>
            <h2>Baixa arcade physics</h2>
            <p>WASD or arrows to drive. Space brakes. R respawns. M returns to the map.</p>
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
          features: ROADS.map((road) => ({
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5efe3);
    this.scene.fog = new THREE.Fog(0xf5efe3, 320, 980);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);

    const sun = new THREE.DirectionalLight(0xfff2d0, 2.8);
    sun.position.set(-180, 280, -220);
    sun.castShadow = true;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    this.scene.add(sun, new THREE.HemisphereLight(0xcfe8ff, 0x7c5a38, 1.7));

    this.addGround();
    this.addRoads();
    this.addBuildings();
    this.addLandmarks();
    this.carMesh = this.createCarMesh();
    this.carMesh.position.copy(this.car.position);
    this.syncCarMesh();
    this.scene.add(this.carMesh);

    this.resize();
    this.snapCameraToCar();
  }

  addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, 1300),
      new THREE.MeshStandardMaterial({ color: 0xd9c6a4, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(1300, 220),
      new THREE.MeshStandardMaterial({ color: 0x5eb6d9, roughness: 0.55, metalness: 0.05 })
    );
    river.position.set(0, 0.015, 585);
    river.rotation.x = -Math.PI / 2;
    this.scene.add(river);
  }

  addRoads() {
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x262a2d, roughness: 0.88 });
    const stripe = new THREE.MeshBasicMaterial({ color: 0xf4d35e });

    for (const road of ROADS) {
      forEachSegment(road.points, (start, end, length, midpoint, rotation) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(ROAD_WIDTH[road.type], 0.06, length),
          asphalt
        );
        mesh.position.set(midpoint[0], 0.04, midpoint[1]);
        mesh.rotation.y = rotation;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, length * 0.86), stripe);
        centerLine.position.set(midpoint[0], 0.085, midpoint[1]);
        centerLine.rotation.y = rotation;
        this.scene.add(centerLine);
      });
    }
  }

  addBuildings() {
    const palette = [0xf3dfbd, 0xe8c48f, 0xc98958, 0xf8ead1, 0xd7b98b];
    const occupied = new Set();

    for (const road of ROADS) {
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

            if (occupied.has(key) || this.distanceToRoads(x, z) < ROAD_WIDTH[road.type] * 0.8) continue;
            occupied.add(key);

            const building = new THREE.Mesh(
              new THREE.BoxGeometry(width, height, depth),
              new THREE.MeshStandardMaterial({
                color: palette[(i + (side > 0 ? 2 : 0)) % palette.length],
                roughness: 0.78
              })
            );
            building.position.set(x, height / 2, z);
            building.rotation.y = rotation + (side > 0 ? 0.05 : -0.05);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
          }
        }
      });
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

  createCarMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.8, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xff4d2e, roughness: 0.45, metalness: 0.1 })
    );
    body.position.y = 0.55;
    body.castShadow = true;

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.72, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x18202a, roughness: 0.3, metalness: 0.25 })
    );
    cabin.position.set(0, 1.18, -0.25);
    cabin.castShadow = true;

    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff8f1f, emissiveIntensity: 0.28 })
    );
    hood.position.set(0, 0.76, -2.26);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.7, 3),
      new THREE.MeshStandardMaterial({ color: 0xf8ead1, roughness: 0.42 })
    );
    nose.position.set(0, 0.9, -2.72);
    nose.rotation.x = -Math.PI / 2;

    group.add(body, cabin, hood, nose);

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const x of [-1.12, 1.12]) {
      for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.32, 18), wheelMaterial);
        wheel.position.set(x, 0.34, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return group;
  }

  bindEvents() {
    document.querySelector('[data-action="drive"]').addEventListener('click', () => this.setMode('drive'));
    document.querySelector('[data-action="map"]').addEventListener('click', () => this.setMode('aerial'));
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      this.keys.add(key);

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
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
    const position = new THREE.Vector3(START_POSITION[0], 0.38, START_POSITION[1]);
    const spawnRoad = this.nearestRoad(position.x, position.z);

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
      this.updateCamera(dt);
      this.updateHud();
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateCar(dt) {
    const throttle = this.hasInput('w', 'arrowup') ? 1 : 0;
    const reverse = this.hasInput('s', 'arrowdown') ? 1 : 0;
    const brake = this.keys.has(' ') ? 1 : 0;
    const steerInput = (this.hasInput('a', 'arrowleft') ? 1 : 0) - (this.hasInput('d', 'arrowright') ? 1 : 0);

    const nearest = this.nearestRoad(this.car.position.x, this.car.position.z);
    const speedLimit = ROAD_SPEED[nearest.road.type];
    const offRoadPenalty = nearest.distance > ROAD_WIDTH[nearest.road.type] * 0.65 ? 0.55 : 1;
    const acceleration = 36 * throttle - 28 * reverse - 55 * brake;
    const drag = 4.2 + Math.abs(this.car.speed) * 0.028;

    this.car.speed += acceleration * offRoadPenalty * dt;
    this.car.speed -= Math.sign(this.car.speed) * drag * dt;
    if (Math.abs(this.car.speed) < 0.35 && !throttle && !reverse) this.car.speed = 0;
    this.car.speed = clamp(this.car.speed, -22, speedLimit * offRoadPenalty);

    const targetSteering = steerInput * (0.9 - Math.min(Math.abs(this.car.speed) / 170, 0.42));
    this.car.steering += (targetSteering - this.car.steering) * Math.min(1, dt * 9);

    const turnRate = this.car.steering * (0.8 + Math.min(Math.abs(this.car.speed) / 55, 1.3));
    this.car.heading -= turnRate * Math.sign(this.car.speed || 1) * dt;

    const metersPerSecond = this.car.speed / 3.6;
    this.car.position.x += Math.sin(this.car.heading) * metersPerSecond * dt;
    this.car.position.z -= Math.cos(this.car.heading) * metersPerSecond * dt;

    const afterMove = this.nearestRoad(this.car.position.x, this.car.position.z);
    const roadEdge = ROAD_WIDTH[afterMove.road.type] * 0.58;
    this.car.onRoad = afterMove.distance <= roadEdge;
    this.car.streetName = afterMove.road.name;

    if (afterMove.distance > roadEdge) {
      const snap = Math.min(0.18, (afterMove.distance - roadEdge) * 0.012);
      this.car.position.x += (afterMove.point[0] - this.car.position.x) * snap;
      this.car.position.z += (afterMove.point[1] - this.car.position.z) * snap;
      this.car.speed *= 0.992;
    }

    this.syncCarMesh();

    this.lastMapSync += dt;
    if (this.lastMapSync > 0.35) {
      this.syncMapMarker(false);
      this.lastMapSync = 0;
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
      .addScaledVector(forward, -10.5)
      .add(new THREE.Vector3(0, 5.9, 0));
    const lookAt = this.car.position
      .clone()
      .addScaledVector(forward, 7.5)
      .add(new THREE.Vector3(0, 1.15, 0));

    return { desired, lookAt };
  }

  updateHud() {
    document.querySelector('[data-hud="speed"]').textContent = Math.round(Math.abs(this.car.speed));
    document.querySelector('[data-hud="street"]').textContent = this.car.streetName;
    document.querySelector('[data-hud="status"]').textContent = this.car.onRoad ? 'on road' : 'snapping to road';
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

    for (const road of ROADS) {
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
      bottom: 28px;
      display: grid;
      grid-template-columns: auto minmax(180px, 1fr) auto;
      gap: 10px;
      align-items: center;
      width: min(720px, calc(100vw - 32px));
      transform: translateX(-50%);
    }

    .speed, .street, .status {
      min-height: 70px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 22px;
      background: rgba(12, 15, 18, 0.78);
      backdrop-filter: blur(16px);
      box-shadow: 0 18px 55px rgba(0, 0, 0, 0.28);
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

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1]) || 1;
  return [vector[0] / length, vector[1] / length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

new LisbonDriveDemo(document.getElementById('app')).start();
