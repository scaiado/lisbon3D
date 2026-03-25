/**
 * Lisbon 3D - Drive Mode (Fixed Working Version)
 * Standalone version without module imports
 */

// Lisbon center coordinates
const LISBON_CENTER = [-9.1393, 38.7223];

// MapTiler key
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

// Global state
let map;
let isDriveMode = false;
let isTransitioning = false;
let animationFrameId = null;
let lastTime = 0;

// Input state
const keys = { w: false, a: false, s: false, d: false };

// Touch state for mobile
let touchState = {
  steering: 0,  // -1 (left) to 1 (right)
  throttle: 0,  // 0 to 1
  braking: 0    // 0 to 1
};

// Car state
let carPosition = [...LISBON_CENTER];
let carBearing = -20;
let carSpeed = 0;
let carGear = 1;

// Camera state
const DRIVE_PITCH = 80;  // LOOKING FORWARD (high pitch = horizontal view)
const DRIVE_ZOOM = 18;   // Street-level zoom
const AERIAL_PITCH = 60; // Aerial view pitch
const AERIAL_ZOOM = 15;  // Aerial zoom

// UI elements
let speedometer;
let scoreDisplay;
let driveHud;
let povButton;
let carDashboard;

// Car marker
let carMarker = null;
let carElement = null;

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
    zoom: AERIAL_ZOOM,
    pitch: AERIAL_PITCH,
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
  console.log('✅ Map loaded');
  
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
}

function setupUI() {
  speedometer = document.getElementById('speedometer');
  scoreDisplay = document.getElementById('score-display');
  driveHud = document.getElementById('drive-hud');
  povButton = document.getElementById('pov-toggle');
  carDashboard = document.getElementById('car-dashboard');
  
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
  povButton?.addEventListener('click', toggleDriveMode);
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
      map.flyTo({ center: LISBON_CENTER, zoom: AERIAL_ZOOM, pitch: AERIAL_PITCH, bearing: -20, duration: 1500 });
    }
  });
  
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
      keys[key] = false;
    }
  });
  
  // Setup touch controls for mobile
  setupTouchControls();
}

function setupTouchControls() {
  // Only setup on touch devices
  if (!('ontouchstart' in window)) return;
  
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;
  
  // Touch areas for drive mode
  let touchStartX = 0;
  let touchStartY = 0;
  let isTouching = false;
  
  mapContainer.addEventListener('touchstart', (e) => {
    if (!isDriveMode) return;
    
    isTouching = true;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    // Determine touch zone
    const width = window.innerWidth;
    const height = window.innerHeight;
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    
    // Bottom half = throttle/brake
    if (touchY > height * 0.6) {
      if (touchX < width * 0.3) {
        // Left side = brake
        touchState.braking = 1;
      } else if (touchX > width * 0.7) {
        // Right side = gas
        touchState.throttle = 1;
      }
    }
    
    e.preventDefault();
  }, { passive: false });
  
  mapContainer.addEventListener('touchmove', (e) => {
    if (!isDriveMode || !isTouching) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    // Steering based on horizontal swipe
    const maxDelta = 100; // pixels for full steer
    touchState.steering = Math.max(-1, Math.min(1, deltaX / maxDelta));
    
    e.preventDefault();
  }, { passive: false });
  
  mapContainer.addEventListener('touchend', (e) => {
    if (!isDriveMode) return;
    
    isTouching = false;
    touchState.steering = 0;
    touchState.throttle = 0;
    touchState.braking = 0;
    
    e.preventDefault();
  });
  
  // Create touch UI overlay
  createTouchUI();
}

function createTouchUI() {
  // Check if already exists
  if (document.getElementById('touch-controls')) return;
  
  const touchUI = document.createElement('div');
  touchUI.id = 'touch-controls';
  touchUI.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 150px;
    display: none;
    z-index: 2000;
    pointer-events: none;
  `;
  
  touchUI.innerHTML = `
    <div style="
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 80px;
      height: 80px;
      background: rgba(231, 76, 60, 0.6);
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      pointer-events: auto;
      user-select: none;
    " id="touch-brake">🛑</div>
    
    <div style="
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 80px;
      height: 80px;
      background: rgba(46, 204, 113, 0.6);
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      pointer-events: auto;
      user-select: none;
    " id="touch-gas">🚀</div>
    
    <div style="
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.8);
      font-size: 12px;
      text-align: center;
      pointer-events: none;
    ">
      👆 Swipe to steer<br>Tap sides for gas/brake
    </div>
  `;
  
  document.body.appendChild(touchUI);
  
  // Button event listeners
  const brakeBtn = document.getElementById('touch-brake');
  const gasBtn = document.getElementById('touch-gas');
  
  if (brakeBtn) {
    brakeBtn.addEventListener('touchstart', (e) => {
      touchState.braking = 1;
      brakeBtn.style.transform = 'scale(0.95)';
      e.preventDefault();
    });
    brakeBtn.addEventListener('touchend', (e) => {
      touchState.braking = 0;
      brakeBtn.style.transform = 'scale(1)';
      e.preventDefault();
    });
  }
  
  if (gasBtn) {
    gasBtn.addEventListener('touchstart', (e) => {
      touchState.throttle = 1;
      gasBtn.style.transform = 'scale(0.95)';
      e.preventDefault();
    });
    gasBtn.addEventListener('touchend', (e) => {
      touchState.throttle = 0;
      gasBtn.style.transform = 'scale(1)';
      e.preventDefault();
    });
  }
}

function toggleDriveMode() {
  // Prevent toggling during transition
  if (isTransitioning) return;
  
  if (!isDriveMode) {
    enterDriveMode();
  } else {
    exitDriveMode();
  }
}

function enterDriveMode() {
  console.log('🚗 Entering Drive Mode');
  isTransitioning = true;
  
  // Get current position for car spawn
  const center = map.getCenter();
  carPosition = [center.lng, center.lat];
  carBearing = map.getBearing();
  carSpeed = 0;
  
  // Disable ALL map interactions
  disableMapInteractions();
  
  // Add drive-mode class
  document.body.classList.add('drive-mode-active');
  
  // Show HUD
  if (driveHud) driveHud.style.display = 'block';
  if (carDashboard) carDashboard.style.display = 'block';
  
  // Show touch controls on mobile
  const touchControls = document.getElementById('touch-controls');
  if (touchControls && 'ontouchstart' in window) {
    touchControls.style.display = 'block';
  }

  // Create/show car marker
  if (!carMarker) {
    carElement = createCarElement();
    carMarker = new maplibregl.Marker({
      element: carElement,
      anchor: 'center',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat(carPosition)
      .addTo(map);
  } else {
    carMarker.setLngLat(carPosition);
    carMarker.getElement().style.display = 'block';
  }

  // Show instructions
  showDriveInstructions();
  
  // Transition to first-person view - wait for completion before starting game loop
  map.easeTo({
    center: carPosition,
    zoom: DRIVE_ZOOM,
    pitch: DRIVE_PITCH,
    bearing: carBearing,
    duration: 1000
  });
  
  // Wait for transition to complete before starting drive mode
  map.once('moveend', () => {
    isDriveMode = true;
    isTransitioning = false;
    
    // Update button
    if (povButton) povButton.textContent = '🚁 Exit Drive Mode';
    
    // Start game loop
    lastTime = performance.now();
    gameLoop();
    
    console.log('🚗 Drive Mode Active - WASD to drive');
  });
}

function exitDriveMode() {
  console.log('🚁 Exiting Drive Mode');
  isTransitioning = true;
  isDriveMode = false;
  
  // Stop loop immediately
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Re-enable map interactions
  enableMapInteractions();
  
  // Remove drive mode class
  document.body.classList.remove('drive-mode-active');
  
  // Hide HUD
  if (driveHud) driveHud.style.display = 'none';
  if (carDashboard) carDashboard.style.display = 'none';
  hideDriveInstructions();
  
  // Hide touch controls
  const touchControls = document.getElementById('touch-controls');
  if (touchControls) {
    touchControls.style.display = 'none';
  }

  // Hide car marker
  if (carMarker) {
    carMarker.getElement().style.display = 'none';
  }
  
  // Update button
  if (povButton) povButton.textContent = '🚗 Enter Drive Mode';
  
  // Return to aerial view
  map.easeTo({ 
    zoom: AERIAL_ZOOM, 
    pitch: AERIAL_PITCH, 
    duration: 1000 
  });
  
  map.once('moveend', () => {
    isTransitioning = false;
  });
}

function disableMapInteractions() {
  if (!map) return;
  
  // Disable all interaction handlers
  map.dragPan.disable();
  map.dragRotate.disable();
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.doubleClickZoom.disable();
  map.touchZoomRotate.disable();
  map.keyboard.disable();
  
  // Add a transparent overlay to catch all mouse events
  const overlay = document.createElement('div');
  overlay.id = 'drive-mode-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
    cursor: crosshair;
  `;
  document.getElementById('map')?.appendChild(overlay);
}

function enableMapInteractions() {
  if (!map) return;
  
  // Re-enable all interaction handlers
  map.dragPan.enable();
  map.dragRotate.enable();
  map.scrollZoom.enable();
  map.boxZoom.enable();
  map.doubleClickZoom.enable();
  map.touchZoomRotate.enable();
  map.keyboard.enable();
  
  // Remove the overlay
  const overlay = document.getElementById('drive-mode-overlay');
  if (overlay) overlay.remove();
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
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  
  // Physics constants
  const ACCEL = 30;      // km/h per second
  const BRAKING = 50;    // km/h per second
  const FRICTION = 10;   // km/h per second
  const MAX_SPEED = 120; // km/h
  const TURN_SPEED = 120; // degrees per second
  
  // Handle input (keyboard + touch)
  const isAccelerating = keys.w || touchState.throttle > 0;
  const isBraking = keys.s || touchState.braking > 0;
  const isTurningLeft = keys.a || touchState.steering < -0.2;
  const isTurningRight = keys.d || touchState.steering > 0.2;
  
  if (isAccelerating) {
    carSpeed = Math.min(carSpeed + ACCEL * dt, MAX_SPEED);
  } else if (isBraking) {
    carSpeed = Math.max(carSpeed - BRAKING * dt, -20);
  } else {
    // Friction
    if (carSpeed > 0) {
      carSpeed = Math.max(carSpeed - FRICTION * dt, 0);
    } else if (carSpeed < 0) {
      carSpeed = Math.min(carSpeed + FRICTION * dt, 0);
    }
  }
  
  // Turning (only when moving) - combine keyboard and touch
  if (Math.abs(carSpeed) > 1) {
    const turnAmount = TURN_SPEED * dt * Math.min(Math.abs(carSpeed) / 30, 1);
    
    // Keyboard steering
    if (keys.a) carBearing -= turnAmount;
    if (keys.d) carBearing += turnAmount;
    
    // Touch steering (smooth)
    if (Math.abs(touchState.steering) > 0.1) {
      carBearing += turnAmount * touchState.steering * 2;
    }
  }
  
  // Move car
  if (Math.abs(carSpeed) > 0.1) {
    const speedMs = carSpeed * 0.27778;
    const distance = speedMs * dt;
    
    // Convert to coordinate change
    const bearingRad = (carBearing * Math.PI) / 180;
    const latChange = (distance * Math.cos(bearingRad)) / 111000;
    const lngChange = (distance * Math.sin(bearingRad)) / 86000;
    
    carPosition[0] += lngChange;
    carPosition[1] += latChange;
  }
  
  // Calculate gear
  if (carSpeed < 10) carGear = 1;
  else if (carSpeed < 30) carGear = 2;
  else if (carSpeed < 50) carGear = 3;
  else if (carSpeed < 80) carGear = 4;
  else carGear = 5;
  
  // Update camera - use jumpTo for immediate updates
  const vibration = Math.sin(now * 0.02) * 0.3 * (carSpeed / MAX_SPEED);
  const currentPitch = DRIVE_PITCH + vibration;
  const currentZoom = DRIVE_ZOOM - (carSpeed / MAX_SPEED) * 0.5;
  
  // Validate all values before passing to map
  if (carPosition[0] && carPosition[1] && !isNaN(carBearing)) {
    map.jumpTo({
      center: carPosition,
      bearing: carBearing,
      pitch: currentPitch,
      zoom: currentZoom
    });
  }

  // Keep car marker at car position
  if (carMarker) {
    carMarker.setLngLat(carPosition);
  }
  
  // Update UI
  updateUI();
  
  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateUI() {
  // Legacy speedometer
  if (speedometer) {
    speedometer.textContent = `${Math.round(Math.abs(carSpeed))} km/h`;
  }
  
  // New HUD speedometer
  const speedValue = document.getElementById('speed-value');
  const speedFill = document.getElementById('speed-fill');
  if (speedValue) speedValue.textContent = Math.round(Math.abs(carSpeed));
  if (speedFill) {
    const maxSpeed = 120;
    const percentage = Math.min(Math.abs(carSpeed) / maxSpeed, 1);
    const circumference = 283;
    const dashOffset = circumference - (percentage * 212);
    speedFill.style.strokeDashoffset = dashOffset;
  }
  
  // Update score if element exists
  const scoreValue = document.getElementById('score-value');
  if (scoreValue) {
    scoreValue.textContent = Math.floor(carSpeed * 10);
  }
}

function createCarElement() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 32px;
    height: 44px;
    position: relative;
    z-index: 9999;
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
    animation: carGlow 1s ease-in-out infinite;
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

// Start
init();

console.log('🗺️ Lisbon 3D - Drive Mode loaded');
console.log('   Press 🚗 to drive');
