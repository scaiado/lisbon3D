/**
 * Lisbon 3D — Hybrid App
 * MapLibre for aerial, Three.js for drive mode
 */

import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

// Config
const LISBON_CENTER = [-9.1393, 38.7223];
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

// State
let currentMode = 'aerial'; // 'aerial' | 'drive'
let map = null;
let scene = null, camera = null, renderer = null;
let car = { position: new THREE.Vector3(0, 0, 0), speed: 0, bearing: 0 };
let keys = { w: false, a: false, s: false, d: false };
let animationId = null;

// ============================================
// INIT
// ============================================

async function init() {
  // Initialize aerial mode (MapLibre)
  initAerialMode();
  
  // Initialize drive mode (Three.js) — hidden initially
  await initDriveMode();
  
  // Setup controls
  setupControls();
  
  // Hide loading
  document.getElementById('loading').style.display = 'none';
  
  console.log('🗺️ Lisbon 3D Hybrid ready');
  console.log('   Aerial: MapLibre | Drive: Three.js');
}

// ============================================
// AERIAL MODE (MapLibre)
// ============================================

function initAerialMode() {
  map = new maplibregl.Map({
    container: 'aerial-container',
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
          tileSize: 256
        }
      },
      layers: [{
        id: 'osm',
        type: 'raster',
        source: 'osm'
      }]
    },
    center: LISBON_CENTER,
    zoom: 15,
    pitch: 60,
    bearing: -20
  });

  map.addControl(new maplibregl.NavigationControl());

  // Add terrain and buildings when loaded
  map.on('load', () => {
    if (MAPTILER_KEY) {
      try {
        map.addSource('terrain', {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
          tileSize: 256,
          encoding: 'terrarium'
        });
        map.setTerrain({ source: 'terrain', exaggeration: 1.5 });

        map.addSource('buildings', {
          type: 'vector',
          url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`
        });
        
        map.addLayer({
          id: '3d-buildings',
          type: 'fill-extrusion',
          source: 'buildings',
          'source-layer': 'building',
          paint: {
            'fill-extrusion-color': '#e0e0e0',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-opacity': 0.6
          }
        });
      } catch (e) {
        console.warn('MapTiler features:', e);
      }
    }
  });
}

// ============================================
// DRIVE MODE (Three.js)
// ============================================

async function initDriveMode() {
  const canvas = document.getElementById('drive-container');
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue
  scene.fog = new THREE.Fog(0x87CEEB, 100, 1000);
  
  // Camera — positioned at driver eye level
  camera = new THREE.PerspectiveCamera(
    75, // FOV
    window.innerWidth / window.innerHeight,
    0.1, // near
    2000 // far
  );
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    alpha: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  sunLight.position.set(100, 200, 100);
  sunLight.castShadow = true;
  scene.add(sunLight);
  
  // Create terrain
  createTerrain();
  
  // Create placeholder buildings
  createBuildings();
  
  // Create road
  createRoad();
  
  // Handle resize
  window.addEventListener('resize', onWindowResize);
  
  console.log('✅ Drive mode initialized');
}

function createTerrain() {
  // Create a grid-based terrain (placeholder for Hello Terrain)
  const size = 2000;
  const segments = 100;
  
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  
  // Add some elevation variation (replace with real Lisbon heightmap)
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    // Gentle hills
    const y = Math.sin(x * 0.01) * 10 + Math.cos(z * 0.01) * 10;
    positions.setY(i, y);
  }
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    color: 0x3d5c3d,
    roughness: 0.8
  });
  
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function createBuildings() {
  // Placeholder buildings — replace with real Lisbon building data
  const buildingCount = 200;
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  
  const buildings = new THREE.InstancedMesh(boxGeometry, boxMaterial, buildingCount);
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  
  const dummy = new THREE.Object3D();
  
  for (let i = 0; i < buildingCount; i++) {
    // Random positions (replace with real building coordinates)
    const x = (Math.random() - 0.5) * 800;
    const z = (Math.random() - 0.5) * 800;
    const height = 10 + Math.random() * 50;
    const width = 10 + Math.random() * 20;
    const depth = 10 + Math.random() * 20;
    
    dummy.position.set(x, height / 2, z);
    dummy.scale.set(width, height, depth);
    dummy.updateMatrix();
    
    buildings.setMatrixAt(i, dummy.matrix);
  }
  
  scene.add(buildings);
}

function createRoad() {
  // Simple road plane
  const roadGeometry = new THREE.PlaneGeometry(20, 1000);
  roadGeometry.rotateX(-Math.PI / 2);
  
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9
  });
  
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.position.y = 0.1; // Slightly above terrain
  road.receiveShadow = true;
  scene.add(road);
  
  // Road markings
  const lineGeometry = new THREE.PlaneGeometry(0.5, 1000);
  lineGeometry.rotateX(-Math.PI / 2);
  
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const line = new THREE.Mesh(lineGeometry, lineMaterial);
  line.position.y = 0.2;
  scene.add(line);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// MODE SWITCHING
// ============================================

function setupControls() {
  // Mode toggle
  document.getElementById('mode-toggle').addEventListener('click', toggleMode);
  
  // Keyboard input
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (e.key === 'p' || e.key === 'P') toggleMode();
  });
  
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
  });
}

function toggleMode() {
  if (currentMode === 'aerial') {
    enterDriveMode();
  } else {
    exitDriveMode();
  }
}

function enterDriveMode() {
  console.log('🚗 Entering drive mode');
  currentMode = 'drive';
  
  // Hide MapLibre, show Three.js
  document.getElementById('aerial-container').style.display = 'none';
  document.getElementById('drive-container').style.display = 'block';
  document.getElementById('drive-hud').style.display = 'block';
  document.getElementById('mode-toggle').textContent = '🚁 Exit Drive Mode';
  
  // Initialize car at current map position
  const center = map.getCenter();
  car.position.set(center.lng * 10000, 2, center.lat * 10000); // Scale for demo
  car.bearing = map.getBearing();
  car.speed = 0;
  
  // Start drive loop
  lastTime = performance.now();
  driveLoop();
}

function exitDriveMode() {
  console.log('🚁 Exiting drive mode');
  currentMode = 'aerial';
  
  // Stop drive loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Show MapLibre, hide Three.js
  document.getElementById('aerial-container').style.display = 'block';
  document.getElementById('drive-container').style.display = 'none';
  document.getElementById('drive-hud').style.display = 'none';
  document.getElementById('mode-toggle').textContent = '🚗 Enter Drive Mode';
  
  // Update map position
  map.setCenter([car.position.x / 10000, car.position.z / 10000]);
}

// ============================================
// DRIVE LOOP
// ============================================

let lastTime = 0;

function driveLoop() {
  if (currentMode !== 'drive') return;
  
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  
  // Physics
  const ACCEL = 30;
  const BRAKING = 50;
  const FRICTION = 10;
  const MAX_SPEED = 80;
  
  if (keys.w) {
    car.speed = Math.min(car.speed + ACCEL * dt, MAX_SPEED);
  } else if (keys.s) {
    car.speed = Math.max(car.speed - BRAKING * dt, -20);
  } else {
    car.speed *= (1 - FRICTION * dt);
    if (Math.abs(car.speed) < 0.1) car.speed = 0;
  }
  
  // Turning
  if (Math.abs(car.speed) > 1) {
    const turnSpeed = 100 * dt * (car.speed / MAX_SPEED);
    if (keys.a) car.bearing -= turnSpeed;
    if (keys.d) car.bearing += turnSpeed;
  }
  
  // Move car
  if (Math.abs(car.speed) > 0.1) {
    const rad = (car.bearing * Math.PI) / 180;
    const speedMs = car.speed * 0.27778;
    const distance = speedMs * dt * 10; // Scale factor
    
    car.position.x += Math.sin(rad) * distance;
    car.position.z += Math.cos(rad) * distance;
  }
  
  // Update camera — FIRST PERSON (driver's eye)
  // Position: car position + height offset
  camera.position.set(
    car.position.x,
    car.position.y + 1.6, // Eye level
    car.position.z
  );
  
  // Look direction: car bearing
  const lookRad = (car.bearing * Math.PI) / 180;
  camera.lookAt(
    car.position.x + Math.sin(lookRad) * 10,
    car.position.y + 1.6,
    car.position.z + Math.cos(lookRad) * 10
  );
  
  // Render
  renderer.render(scene, camera);
  
  // Update HUD
  document.getElementById('speed-display').textContent = `${Math.round(Math.abs(car.speed))} km/h`;
  
  animationId = requestAnimationFrame(driveLoop);
}

// Start
init();
