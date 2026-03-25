/**
 * Lisbon 3D - Drive Mode
 * 
 * Main entry point with integrated:
 * - Road Constraint System
 * - Driving Physics
 * - Collision Detection
 * - First-Person Camera
 * 
 * @author Dragon (Security/Punk Rock Hacker)
 */

import maplibregl from 'maplibre-gl';
import { RoadConstraintSystem, SPEED_LIMITS } from './src/RoadConstraintSystem.js';
import { DrivingPhysics } from './src/DrivingPhysics.js';
import { CollisionSystem } from './src/CollisionSystem.js';
import { FirstPersonCamera } from './src/FirstPersonCamera.js';
import { LISBON_CENTER, haversineDistance, formatSpeed } from './src/utils.js';

// MapTiler key
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

// Global state
let map;
let isDriveMode = false;
let animationFrameId = null;
let lastTime = 0;

// Game systems
let roadSystem;
let physics;
let collision;
let camera;

// Input state
const keys = { w: false, a: false, s: false, d: false };

// Car marker
let carMarker = null;
let carElement = null;

// UI elements
let speedometer;
let scoreDisplay;
let debugPanel = null;

// Game state
let gameState = {
  score: 0,
  distance: 0,
  offRoadTime: 0,
  lastPosition: null
};

// Initialize
async function init() {
  // Create map
  map = new maplibregl.Map({
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
      layers: [{
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19
      }]
    },
    center: LISBON_CENTER,
    zoom: 15,
    pitch: 60,
    bearing: -20,
    maxPitch: 85,
    antialias: true
  });

  // Add controls
  map.addControl(new maplibregl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
  }), 'top-right');

  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

  // Setup map
  map.on('load', setupMap);
  
  // Setup UI
  setupUI();
  
  // Setup input
  setupInput();
}

function setupMap() {
  console.log('✅ Map loaded - initializing systems');
  
  // Add terrain
  if (MAPTILER_KEY) {
    try {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        tileSize: 256,
        encoding: 'terrarium'
      });
      
      map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
      
      map.addControl(new maplibregl.TerrainControl({
        source: 'terrain',
        exaggeration: 1.5
      }), 'top-right');
    } catch (e) {
      console.warn('Terrain failed:', e.message);
    }
    
    // Add 3D buildings
    try {
      map.addSource('buildings', {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`
      });
      
      map.addLayer({
        id: '3d-buildings',
        type: 'fill-extrusion',
        source: 'buildings',
        'source-layer': 'building',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'height'],
            0, '#fafafa',
            20, '#f0f0f0',
            50, '#e0e0e0',
            100, '#d0d0d0'
          ],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.6,
          'fill-extrusion-vertical-gradient': true
        }
      });
    } catch (e) {
      console.warn('Buildings failed:', e.message);
    }
  }
  
  // Initialize game systems
  roadSystem = new RoadConstraintSystem();
  physics = new DrivingPhysics();
  collision = new CollisionSystem(map);
  camera = new FirstPersonCamera(map);
}

function setupUI() {
  speedometer = document.getElementById('speedometer');
  scoreDisplay = document.getElementById('score-display');
  
  // Setup sliders
  const pitchSlider = document.getElementById('pitch');
  const pitchValue = document.getElementById('pitch-value');
  const zoomSlider = document.getElementById('zoom');
  const zoomValue = document.getElementById('zoom-value');
  
  pitchSlider?.addEventListener('input', (e) => {
    if (!isDriveMode) {
      const pitch = parseInt(e.target.value);
      pitchValue.textContent = pitch;
      map.setPitch(pitch);
    }
  });
  
  zoomSlider?.addEventListener('input', (e) => {
    if (!isDriveMode) {
      const zoom = parseFloat(e.target.value);
      zoomValue.textContent = zoom.toFixed(1);
      map.setZoom(zoom);
    }
  });
  
  // POV toggle
  document.getElementById('pov-toggle')?.addEventListener('click', toggleDriveMode);
  
  // Create debug panel
  createDebugPanel();
}

function createDebugPanel() {
  debugPanel = document.createElement('div');
  debugPanel.id = 'debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: #0f0;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    z-index: 1000;
    display: none;
    min-width: 200px;
  `;
  document.body.appendChild(debugPanel);
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
      keys[key] = true;
      e.preventDefault();
    }
    
    if (e.key === 'p' || e.key === 'P') {
      toggleDriveMode();
    }
    
    if (e.key === 'r' || e.key === 'R') {
      map.flyTo({ center: LISBON_CENTER, zoom: 15, pitch: 60, bearing: -20, duration: 1500 });
    }
    
    if (e.key === 'F3') {
      e.preventDefault();
      toggleDebugPanel();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
      keys[key] = false;
    }
  });
}

function toggleDebugPanel() {
  if (debugPanel) {
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  }
}

function toggleDriveMode() {
  const btn = document.getElementById('pov-toggle');
  
  if (!isDriveMode) {
    enterDriveMode();
    if (btn) btn.textContent = '🚁 Exit Drive Mode';
  } else {
    exitDriveMode();
    if (btn) btn.textContent = '🚗 Enter Drive Mode';
  }
}

function enterDriveMode() {
  console.log('🚗 Entering Drive Mode');
  isDriveMode = true;
  
  // Disable map drag/pan in drive mode - we control the camera
  map.dragPan.disable();
  map.dragRotate.disable();
  map.scrollZoom.disable();
  
  // Add drive-mode-active class to body for CSS
  document.body.classList.add('drive-mode-active');
  
  // Reset systems
  physics.reset();
  physics.setPosition(map.getCenter());
  
  // Create car marker
  if (!carMarker) {
    carElement = createCarElement();
    carMarker = new maplibregl.Marker({
      element: carElement,
      anchor: 'center',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat(map.getCenter())
      .addTo(map);
  }
  
  carMarker.getElement().style.display = 'block';
  
  // Show UI
  speedometer.style.display = 'block';
  scoreDisplay.style.display = 'block';
  
  // Show drive mode HUD
  const driveHud = document.getElementById('drive-hud');
  if (driveHud) driveHud.style.display = 'block';
  
  // Initial camera transition to first-person
  map.easeTo({
    zoom: 18,
    pitch: 10,  // Low pitch for first-person view
    duration: 1000
  });
  
  // Show instructions
  showDriveInstructions();
  
  // Start loop
  lastTime = performance.now();
  gameLoop();
}

function exitDriveMode() {
  console.log('🚁 Exiting Drive Mode');
  isDriveMode = false;
  
  // Re-enable map interactions
  map.dragPan.enable();
  map.dragRotate.enable();
  map.scrollZoom.enable();
  
  // Remove drive mode class
  document.body.classList.remove('drive-mode-active');
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (carMarker) {
    carMarker.getElement().style.display = 'none';
  }
  
  speedometer.style.display = 'none';
  scoreDisplay.style.display = 'none';
  
  // Hide drive mode HUD
  const driveHud = document.getElementById('drive-hud');
  if (driveHud) driveHud.style.display = 'none';
  
  hideDriveInstructions();
  
  // Return to aerial view
  map.easeTo({ zoom: 15, pitch: 60, duration: 1000 });
}

function createCarElement() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 32px;
    height: 44px;
    position: relative;
  `;
  
  const carBody = document.createElement('div');
  carBody.style.cssText = `
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
    border-radius: 10px 10px 6px 6px;
    border: 3px solid #fff;
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.9), 0 4px 15px rgba(0, 0, 0, 0.4);
    position: relative;
  `;
  
  carBody.innerHTML = `
    <div style="
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 22px;
      height: 14px;
      background: #1a1a2e;
      border-radius: 5px;
      border: 2px solid #444;
    "></div>
    <div style="
      position: absolute;
      bottom: 5px;
      left: 50%;
      transform: translateX(-50%);
      width: 18px;
      height: 10px;
      background: #ffaa00;
      border-radius: 3px;
      box-shadow: 0 0 8px #ffaa00;
    "></div>
  `;
  
  el.appendChild(carBody);
  return el;
}

function showDriveInstructions() {
  let overlay = document.getElementById('drive-instructions');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'drive-instructions';
    overlay.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px 30px;
      border-radius: 30px;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      z-index: 1000;
      display: flex;
      gap: 20px;
      align-items: center;
    `;
    overlay.innerHTML = `
      <span>🚗 <b>Drive Mode</b></span>
      <span style="opacity: 0.7;">W/S = gas/brake</span>
      <span style="opacity: 0.7;">A/D = steer</span>
      <span style="opacity: 0.7;">P = exit</span>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideDriveInstructions() {
  const overlay = document.getElementById('drive-instructions');
  if (overlay) overlay.style.display = 'none';
}

// ============================================
// MAIN GAME LOOP
// ============================================

function gameLoop() {
  if (!isDriveMode) return;
  
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap at 100ms
  lastTime = now;
  
  // Get input
  const input = {
    throttle: keys.w,
    brake: keys.s,
    steer: (keys.a ? -1 : 0) + (keys.d ? 1 : 0)
  };
  
  // Get current physics state
  const carState = physics.getState();
  
  // Query environment
  const roadInfo = roadSystem.constrain(carState.position, carState.speed, dt);
  const terrain = collision.checkTerrain(carState.position, carState.bearing);
  const bounds = collision.checkBoundaries(roadInfo.position);
  
  // Update environment for physics
  const environment = {
    speedLimit: roadInfo.speedLimit || 50,
    slope: terrain,
    onRoad: roadInfo.onRoad
  };
  
  // Apply physics
  let newState = physics.update(input, dt, environment);
  
  // Apply constraints in order of priority
  
  // 1. Road constraint (snap to road if off-road)
  if (!roadInfo.onRoad) {
    newState.position = roadInfo.position;
    gameState.offRoadTime += dt;
    
    // Penalize off-road driving
    if (gameState.offRoadTime > 2) {
      newState.speed *= 0.95; // Slow down if persistently off-road
    }
  } else {
    gameState.offRoadTime = Math.max(0, gameState.offRoadTime - dt);
  }
  
  // 2. Boundary constraint
  if (bounds.wasClamped) {
    newState.position = bounds.position;
    newState.speed *= 0.5; // Hit boundary = slow down
  }
  
  // 3. Building collision
  const collisionInfo = collision.checkCollision(newState.position);
  if (collisionInfo.collision) {
    const response = collision.getCollisionResponse(newState.position, newState.bearing);
    if (response) {
      newState.position = response.position;
      newState.bearing = response.bearing;
      newState.speed *= response.speedMultiplier || 0.3;
    }
  }
  
  // Update physics state
  physics.setPosition(newState.position);
  physics.setBearing(newState.bearing);
  
  // Update car marker
  if (carMarker) {
    carMarker.setLngLat(newState.position);
  }
  
  // Update camera
  camera.update(newState, input, dt);
  
  // Update game stats
  updateGameStats(newState.position, dt);
  
  // Update UI
  updateUI(newState, roadInfo);
  
  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateGameStats(position, dt) {
  if (gameState.lastPosition) {
    const dist = haversineDistance(gameState.lastPosition, position);
    gameState.distance += dist;
    gameState.score += Math.floor(dist);
  }
  gameState.lastPosition = [...position];
}

function updateUI(carState, roadInfo) {
  // Basic speedometer (legacy)
  const speedText = formatSpeed(carState.speed);
  speedometer.textContent = speedText;
  
  // New HUD speedometer (Pixel's design)
  const speedValue = document.getElementById('speed-value');
  const speedFill = document.getElementById('speed-fill');
  if (speedValue) speedValue.textContent = Math.round(carState.speed);
  if (speedFill) {
    // Update speed gauge (max 120 km/h)
    const maxSpeed = 120;
    const percentage = Math.min(carState.speed / maxSpeed, 1);
    const circumference = 283; // 2 * PI * 45
    const dashOffset = circumference - (percentage * 212); // 212 is the visible arc
    speedFill.style.strokeDashoffset = dashOffset;
  }
  
  // New HUD score
  const scoreValue = document.getElementById('score-value');
  if (scoreValue) scoreValue.textContent = Math.floor(gameState.score);
  
  // Distance traveled
  const distanceValue = document.getElementById('distance-value');
  if (distanceValue) distanceValue.textContent = (gameState.distance / 1000).toFixed(1);
  
  // Color based on speed vs limit
  const limit = roadInfo.speedLimit || 50;
  if (carState.speed > limit * 0.9) {
    speedometer.style.color = '#ff4444'; // Red if near/over limit
  } else if (!roadInfo.onRoad) {
    speedometer.style.color = '#ffaa00'; // Yellow if off-road
  } else {
    speedometer.style.color = '#00ff88'; // Green normally
  }
  
  // Score (legacy)
  scoreDisplay.textContent = `Score: ${Math.floor(gameState.score)}`;
  
  // Debug panel
  if (debugPanel && debugPanel.style.display !== 'none') {
    updateDebugPanel(carState, roadInfo);
  }
}

function updateDebugPanel(carState, roadInfo) {
  const physicsInfo = physics.getDebugInfo();
  const collisionInfo = collision.getDebugInfo();
  
  debugPanel.innerHTML = `
    <div><b>=== PHYSICS ===</b></div>
    <div>Speed: ${carState.speed.toFixed(1)} km/h</div>
    <div>Bearing: ${carState.bearing.toFixed(1)}°</div>
    <div>Steering: ${carState.steeringAngle.toFixed(1)}°</div>
    <div>Gear: ${carState.gear}</div>
    <div>Braking Dist: ${physicsInfo.brakingDistance}m</div>
    <div><b>=== ROAD ===</b></div>
    <div>On Road: ${roadInfo.onRoad ? '✅' : '❌'}</div>
    <div>Type: ${roadInfo.roadType || 'none'}</div>
    <div>Limit: ${roadInfo.speedLimit || 'N/A'} km/h</div>
    <div>Off-road: ${gameState.offRoadTime.toFixed(1)}s</div>
    <div><b>=== COLLISION ===</b></div>
    <div>Collisions: ${collisionInfo.collisionCount}</div>
    <div>Last Query: ${(performance.now() - collisionInfo.lastQuery).toFixed(0)}ms ago</div>
  `;
}

// Start
init();

console.log('🗺️ Lisbon 3D - Drive Mode loaded');
console.log('   Press 🚗 to drive, F3 for debug');
