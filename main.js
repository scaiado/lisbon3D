import maplibregl from 'maplibre-gl';

// Lisbon center coordinates
const LISBON_CENTER = [-9.1393, 38.7223];

// MapTiler key - Lisbon 3D Explorer
// Get your own free key at: https://cloud.maptiler.com/account/keys/
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

// Initialize the map with open data sources
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      // OpenStreetMap base tiles
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

// Add navigation controls
map.addControl(new maplibregl.NavigationControl({
  visualizePitch: true,
  showZoom: true,
  showCompass: true
}), 'top-right');

// Add scale control
map.addControl(new maplibregl.ScaleControl({
  maxWidth: 100,
  unit: 'metric'
}), 'bottom-left');

// When map loads
map.on('load', () => {
  console.log('✅ Map loaded - Lisbon 3D Explorer ready');
  
  // Try to add terrain if MapTiler key is valid
  if (MAPTILER_KEY !== 'get_your_key_at_maptiler.com') {
    try {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        tileSize: 256,
        encoding: 'terrarium'
      });
      
      map.setTerrain({
        source: 'terrain',
        exaggeration: 1.5
      });
      
      // Add terrain toggle control
      map.addControl(new maplibregl.TerrainControl({
        source: 'terrain',
        exaggeration: 1.5
      }), 'top-right');
      
      console.log('⛰️ 3D terrain enabled');
    } catch (e) {
      console.warn('Terrain failed:', e.message);
    }
    
    // Try to add buildings from MapTiler
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
      console.log('🏢 3D buildings layer added from MapTiler');
    } catch (e) {
      console.warn('Buildings from MapTiler failed:', e.message);
    }
  } else {
    console.log('ℹ️ Add your MapTiler key for 3D terrain and buildings');
    console.log('   Get free key: https://cloud.maptiler.com/account/keys/');
    addDemoBuildings();
  }
  
  // Add marker at Lisbon center
  new maplibregl.Marker({ color: '#e74c3c' })
    .setLngLat(LISBON_CENTER)
    .setPopup(new maplibregl.Popup().setHTML(`
      <div style="padding: 8px; max-width: 200px;">
        <b>🇵🇹 Lisbon Center</b><br>
        <small>Commerce Square</small><br>
        <small>38.7223°N, 9.1393°W</small>
      </div>
    `))
    .addTo(map);
  
  // Add landmark markers
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

// Fallback demo buildings
function addDemoBuildings() {
  const demoBuildings = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-9.141, 38.7235], [-9.140, 38.7235], [-9.140, 38.7228], [-9.141, 38.7228], [-9.141, 38.7235]]]
        },
        properties: { height: 40, name: 'Building A' }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-9.1385, 38.7235], [-9.1375, 38.7235], [-9.1375, 38.7228], [-9.1385, 38.7228], [-9.1385, 38.7235]]]
        },
        properties: { height: 25, name: 'Building B' }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-9.141, 38.7220], [-9.140, 38.7220], [-9.140, 38.7213], [-9.141, 38.7213], [-9.141, 38.7220]]]
        },
        properties: { height: 60, name: 'Building C' }
      }
    ]
  };
  
  map.addSource('demo-buildings', {
    type: 'geojson',
    data: demoBuildings
  });
  
  map.addLayer({
    id: '3d-buildings-demo',
    type: 'fill-extrusion',
    source: 'demo-buildings',
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 0, '#3498db', 30, '#9b59b6', 60, '#e74c3c'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.85
    }
  });
}

// POV Walking Mode
let isPOVMode = false;
let walkSpeed = 0.0001;
let keys = { w: false, a: false, s: false, d: false };
let animationFrameId = null;

function startPOVLoop() {
  function updatePosition() {
    if (!isPOVMode) return;
    
    const center = map.getCenter();
    let lng = center.lng;
    let lat = center.lat;
    let moved = false;
    
    const bearing = map.getBearing();
    const bearingRad = (bearing * Math.PI) / 180;
    
    if (keys.w) {
      lng += Math.sin(bearingRad) * walkSpeed;
      lat += Math.cos(bearingRad) * walkSpeed;
      moved = true;
    }
    if (keys.s) {
      lng -= Math.sin(bearingRad) * walkSpeed;
      lat -= Math.cos(bearingRad) * walkSpeed;
      moved = true;
    }
    if (keys.a) {
      lng -= Math.cos(bearingRad) * walkSpeed * 0.5;
      lat += Math.sin(bearingRad) * walkSpeed * 0.5;
      moved = true;
    }
    if (keys.d) {
      lng += Math.cos(bearingRad) * walkSpeed * 0.5;
      lat -= Math.sin(bearingRad) * walkSpeed * 0.5;
      moved = true;
    }
    
    if (moved) {
      map.setCenter([lng, lat]);
    }
    
    animationFrameId = requestAnimationFrame(updatePosition);
  }
  
  updatePosition();
}

function stopPOVLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function showPOVInstructions() {
  let overlay = document.getElementById('pov-instructions');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pov-instructions';
    overlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 30px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      z-index: 1000;
      display: flex;
      gap: 20px;
      align-items: center;
    `;
    overlay.innerHTML = `
      <span>🚶 <b>POV Mode</b></span>
      <span style="opacity: 0.8;">WASD to walk</span>
      <span style="opacity: 0.8;">Mouse to look</span>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hidePOVInstructions() {
  const overlay = document.getElementById('pov-instructions');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
    keys[key] = true;
  }
  if (e.key === 'r' || e.key === 'R') {
    map.flyTo({ center: LISBON_CENTER, zoom: 15, pitch: 60, bearing: -20, duration: 1500 });
  }
  if (e.key === 'p' || e.key === 'P') {
    document.getElementById('pov-toggle')?.click();
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
  const pitch = parseInt(e.target.value);
  pitchValue.textContent = pitch;
  map.setPitch(pitch);
});

zoomSlider?.addEventListener('input', (e) => {
  const zoom = parseFloat(e.target.value);
  zoomValue.textContent = zoom.toFixed(1);
  map.setZoom(zoom);
});

map.on('move', () => {
  if (pitchSlider) pitchSlider.value = map.getPitch();
  if (pitchValue) pitchValue.textContent = Math.round(map.getPitch());
  if (zoomSlider) zoomSlider.value = map.getZoom();
  if (zoomValue) zoomValue.textContent = map.getZoom().toFixed(1);
});

// POV Toggle Button
document.getElementById('pov-toggle')?.addEventListener('click', () => {
  const btn = document.getElementById('pov-toggle');
  if (!isPOVMode) {
    map.easeTo({ zoom: 18, pitch: 85, bearing: map.getBearing(), duration: 1000 });
    showPOVInstructions();
    startPOVLoop();
    if (btn) btn.textContent = '🚁 Exit POV Mode';
    isPOVMode = true;
    console.log('🚶 POV Walking Mode ON — Use WASD to walk');
  } else {
    map.easeTo({ zoom: 15, pitch: 60, duration: 1000 });
    hidePOVInstructions();
    stopPOVLoop();
    if (btn) btn.textContent = '🚶 Enter POV Mode';
    isPOVMode = false;
    console.log('🚁 Aerial View Mode ON');
  }
});

console.log('🗺️ Lisbon 3D Explorer initialized');
console.log('   R = Reset view | P = Toggle POV | WASD = Walk (in POV)');
