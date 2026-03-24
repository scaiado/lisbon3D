import maplibregl from 'maplibre-gl';

// Lisbon center coordinates
const LISBON_CENTER = [-9.1393, 38.7223];

// MapTiler key - Lisbon 3D Explorer
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

// POV Mode State
let isPOVMode = false;
let keys = { w: false, a: false, s: false, d: false };
let animationFrameId = null;
let carMarker = null;

// Game State
let gameState = {
  speed: 0,           // Current speed (0-100 km/h scale)
  maxSpeed: 80,       // Max speed in km/h
  acceleration: 0.5,  // Speed increase per frame when accelerating
  braking: 0.8,       // Speed decrease per frame when braking
  friction: 0.3,      // Natural deceleration
  score: 0,
  distance: 0,        // Distance traveled in meters
  lastPosition: null,
  visitedLandmarks: new Set()
};

// Landmarks
const LANDMARKS = [
  { name: 'São Jorge Castle', coords: [-9.1336, 38.7129], color: '#9b59b6', points: 500 },
  { name: 'Belém Tower', coords: [-9.2158, 38.6916], color: '#3498db', points: 500 },
  { name: 'Christ the King', coords: [-9.1703, 38.6789], color: '#f39c12', points: 500 }
];

// Initialize the map
const map = new maplibregl.Map({
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
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19
      }
    ]
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

map.addControl(new maplibregl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
}), 'bottom-left');

// When map loads
map.on('load', () => {
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
  
  // Landmark markers
  LANDMARKS.forEach(lm => {
    new maplibregl.Marker({ color: lm.color })
      .setLngLat(lm.coords)
      .setPopup(new maplibregl.Popup().setHTML(`<b>${lm.name}</b>`))
      .addTo(map);
  });
});

// Create car marker element
function createCarMarker() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 32px;
    height: 44px;
    position: relative;
    opacity: 1;
  `;
  
  // Create the car body with animation (inside the marker, so transform doesn't conflict with MapLibre's positioning)
  const carBody = document.createElement('div');
  carBody.style.cssText = `
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
    border-radius: 10px 10px 6px 6px;
    border: 3px solid #fff;
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.9), 0 0 40px rgba(255, 68, 68, 0.5), 0 4px 15px rgba(0, 0, 0, 0.4);
    position: relative;
    animation: carPulse 1.2s ease-in-out infinite;
  `;
  
  // Add pulse animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes carPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.9), 0 0 40px rgba(255, 68, 68, 0.5), 0 4px 15px rgba(0, 0, 0, 0.4); transform: scale(1); }
      50% { box-shadow: 0 0 30px rgba(255, 68, 68, 1), 0 0 60px rgba(255, 68, 68, 0.7), 0 6px 20px rgba(0, 0, 0, 0.5); transform: scale(1.05); }
    }
  `;
  document.head.appendChild(style);
  
  // Windshield
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

// POV Mode Functions
function startPOVDrive() {
  console.log('🚗 Starting POV drive mode');
  
  // Reset game state
  gameState.speed = 0;
  gameState.score = 0;
  gameState.distance = 0;
  gameState.visitedLandmarks.clear();
  gameState.lastPosition = null;
  
  // Show UI
  document.getElementById('speedometer').style.display = 'block';
  document.getElementById('score-display').style.display = 'block';
  updateUI();
  
  // Create car marker at current position
  if (!carMarker) {
    carMarker = new maplibregl.Marker({
      element: createCarMarker(),
      anchor: 'center',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    })
      .setLngLat(map.getCenter())
      .addTo(map);
  }
  
  // Set initial position for distance tracking
  gameState.lastPosition = map.getCenter();
  
  // Set camera to follow the car
  map.setZoom(18);
  map.setPitch(60);
  
  function driveLoop() {
    if (!isPOVMode) return;
    
    const center = carMarker.getLngLat();
    let lng = center.lng;
    let lat = center.lat;
    let turn = 0;
    let moved = false;
    
    const bearing = map.getBearing();
    
    // Handle acceleration and braking
    if (keys.w) {
      gameState.speed = Math.min(gameState.speed + gameState.acceleration, gameState.maxSpeed);
    } else if (keys.s) {
      gameState.speed = Math.max(gameState.speed - gameState.braking, 0);
    } else {
      // Natural friction
      gameState.speed = Math.max(gameState.speed - gameState.friction, 0);
    }
    
    // Convert speed to coordinate movement (scaled for map coords)
    const baseSpeed = 0.000005; // Base movement unit
    const speedFactor = (gameState.speed / gameState.maxSpeed);
    const moveSpeed = baseSpeed * (0.2 + speedFactor * 1.8); // Min 20% speed even at low km/h
    
    // Forward/Back
    if (gameState.speed > 0 && keys.w) {
      const rad = (bearing * Math.PI) / 180;
      lng += Math.sin(rad) * moveSpeed;
      lat += Math.cos(rad) * moveSpeed;
      moved = true;
    }
    
    // Turn (A/D change bearing, not strafe) - only when moving
    if (gameState.speed > 1) {
      const turnSpeed = 1 + (gameState.speed / gameState.maxSpeed) * 2; // Faster turning at higher speeds
      if (keys.a) {
        turn = -turnSpeed;
        moved = true;
      }
      if (keys.d) {
        turn = turnSpeed;
        moved = true;
      }
    }
    
    if (moved) {
      // Update car position
      carMarker.setLngLat([lng, lat]);
      
      // Update camera to follow car
      map.setCenter([lng, lat]);
      
      // Update bearing if turning
      if (turn !== 0) {
        map.setBearing(bearing + turn);
      }
      
      // Track distance and score
      trackDistance([lng, lat]);
      
      // Check landmarks
      checkLandmarks([lng, lat]);
    }
    
    // Update UI
    updateUI();
    
    animationFrameId = requestAnimationFrame(driveLoop);
  }
  
  driveLoop();
}

function stopPOVDrive() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (carMarker) {
    carMarker.getElement().style.display = 'none';
  }
  // Hide UI
  document.getElementById('speedometer').style.display = 'none';
  document.getElementById('score-display').style.display = 'none';
  // Reset to aerial view
  map.easeTo({ zoom: 15, pitch: 60, duration: 1000 });
}

// Game Mechanics Functions

// Calculate distance between two lat/lng points in meters
function haversineDistance(coord1, coord2) {
  const R = 6371000; // Earth's radius in meters
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Track distance traveled and update score
function trackDistance(currentPos) {
  if (gameState.lastPosition && currentPos) {
    const dist = haversineDistance(gameState.lastPosition, currentPos);
    if (!isNaN(dist) && isFinite(dist)) {
      gameState.distance += dist;
      // 1 point per meter traveled
      gameState.score += Math.floor(dist);
    }
  }
  gameState.lastPosition = [...currentPos];
}

// Check if near landmarks
function checkLandmarks(currentPos) {
  LANDMARKS.forEach(landmark => {
    if (gameState.visitedLandmarks.has(landmark.name)) return;
    
    const distance = haversineDistance(currentPos, landmark.coords);
    
    if (distance <= 100) { // Within 100 meters
      gameState.visitedLandmarks.add(landmark.name);
      gameState.score += landmark.points;
      showCheckpointPopup(landmark.name, landmark.points);
    }
  });
}

// Show checkpoint popup
function showCheckpointPopup(landmarkName, points) {
  const popup = document.getElementById('checkpoint-popup');
  const textEl = document.getElementById('checkpoint-text');
  const pointsEl = document.getElementById('checkpoint-points');
  
  textEl.textContent = `Checkpoint: ${landmarkName}!`;
  pointsEl.textContent = points;
  
  popup.classList.remove('checkpoint-fade');
  popup.style.display = 'block';
  
  // Fade out after 2 seconds
  setTimeout(() => {
    popup.classList.add('checkpoint-fade');
    setTimeout(() => {
      popup.style.display = 'none';
    }, 500);
  }, 2000);
}

// Update UI elements
function updateUI() {
  const speedometer = document.getElementById('speedometer');
  const scoreDisplay = document.getElementById('score-display');
  
  // Ensure score is always a valid number
  if (isNaN(gameState.score)) gameState.score = 0;
  
  if (speedometer) {
    speedometer.textContent = `${Math.round(gameState.speed || 0)} km/h`;
  }
  if (scoreDisplay) {
    scoreDisplay.textContent = `Score: ${Math.floor(gameState.score || 0)}`;
  }
}

// Keyboard handling
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
    keys[key] = true;
    e.preventDefault();
  }
  if (e.key === 'r' || e.key === 'R') {
    map.flyTo({ center: LISBON_CENTER, zoom: 15, pitch: 60, bearing: -20, duration: 1500 });
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
    keys[key] = false;
  }
});

// UI Controls
const pitchSlider = document.getElementById('pitch');
const pitchValue = document.getElementById('pitch-value');
const zoomSlider = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');

pitchSlider?.addEventListener('input', (e) => {
  if (!isPOVMode) {
    const pitch = parseInt(e.target.value);
    pitchValue.textContent = pitch;
    map.setPitch(pitch);
  }
});

zoomSlider?.addEventListener('input', (e) => {
  if (!isPOVMode) {
    const zoom = parseFloat(e.target.value);
    zoomValue.textContent = zoom.toFixed(1);
    map.setZoom(zoom);
  }
});

map.on('move', () => {
  if (!isPOVMode) {
    if (pitchSlider) pitchSlider.value = map.getPitch();
    if (pitchValue) pitchValue.textContent = Math.round(map.getPitch());
    if (zoomSlider) zoomSlider.value = map.getZoom();
    if (zoomValue) zoomValue.textContent = map.getZoom().toFixed(1);
  }
});

// POV Toggle
document.getElementById('pov-toggle')?.addEventListener('click', () => {
  const btn = document.getElementById('pov-toggle');
  
  if (!isPOVMode) {
    // ENTER POV MODE
    isPOVMode = true;
    if (btn) btn.textContent = '🚁 Exit Drive Mode';
    
    // Show instructions
    showDriveInstructions();
    
    // Start driving
    startPOVDrive();
    
    console.log('🚗 Drive Mode ON — W/S = gas/brake, A/D = steer');
  } else {
    // EXIT POV MODE
    isPOVMode = false;
    if (btn) btn.textContent = '🚗 Enter Drive Mode';
    
    hideDriveInstructions();
    stopPOVDrive();
    
    console.log('🚁 Aerial View ON');
  }
});

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
      <span style="opacity: 0.7;">Click to exit</span>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideDriveInstructions() {
  const overlay = document.getElementById('drive-instructions');
  if (overlay) overlay.style.display = 'none';
}

console.log('🗺️ Lisbon 3D Explorer ready');
console.log('   🚗 Click "Enter Drive Mode" to drive through Lisbon');
