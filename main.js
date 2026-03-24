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
  const landmarks = [
    { name: 'São Jorge Castle', coords: [-9.1336, 38.7129], color: '#9b59b6' },
    { name: 'Belém Tower', coords: [-9.2158, 38.6916], color: '#3498db' },
    { name: 'Christ the King', coords: [-9.1703, 38.6789], color: '#f39c12' }
  ];
  
  landmarks.forEach(lm => {
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
    width: 30px;
    height: 40px;
    background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%);
    border-radius: 8px 8px 4px 4px;
    border: 2px solid #fff;
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.6);
    position: relative;
    z-index: 1000;
  `;
  // Windshield
  el.innerHTML = `
    <div style="
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 12px;
      background: #2c3e50;
      border-radius: 4px;
      border: 1px solid #34495e;
    "></div>
    <div style="
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 16px;
      height: 8px;
      background: #f39c12;
      border-radius: 2px;
    "></div>
  `;
  return el;
}

// POV Mode Functions
function startPOVDrive() {
  console.log('🚗 Starting POV drive mode');
  
  // Create car marker at current position
  if (!carMarker) {
    carMarker = new maplibregl.Marker({
      element: createCarMarker(),
      anchor: 'center'
    })
      .setLngLat(map.getCenter())
      .addTo(map);
  }
  
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
    const speed = 0.00001; // Car speed
    
    // Forward/Back
    if (keys.w) {
      const rad = (bearing * Math.PI) / 180;
      lng += Math.sin(rad) * speed;
      lat += Math.cos(rad) * speed;
      moved = true;
    }
    if (keys.s) {
      const rad = (bearing * Math.PI) / 180;
      lng -= Math.sin(rad) * speed * 0.5;
      lat -= Math.cos(rad) * speed * 0.5;
      moved = true;
    }
    
    // Turn (A/D change bearing, not strafe)
    if (keys.a) {
      turn = -2; // Turn left 2 degrees
      moved = true;
    }
    if (keys.d) {
      turn = 2; // Turn right 2 degrees
      moved = true;
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
    }
    
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
  // Reset to aerial view
  map.easeTo({ zoom: 15, pitch: 60, duration: 1000 });
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
