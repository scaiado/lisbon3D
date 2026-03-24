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
      
      // Add roads layer for navigation
      try {
        map.addLayer({
          id: 'roads',
          type: 'line',
          source: 'buildings',
          'source-layer': 'road',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'visible'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              12, 1,
              14, 2,
              16, 4,
              18, 6
            ],
            'line-opacity': 0.8
          }
        });
        console.log('🛣️ Roads layer added');
      } catch (e) {
        console.warn('Roads layer failed:', e.message);
      }
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
let walkSpeed = 0.0002; // Increased for better movement
let keys = { w: false, a: false, s: false, d: false };
let animationFrameId = null;

function startPOVLoop() {
  console.log('🎮 POV Loop starting - WASD active');
  
  function updatePosition() {
    if (!isPOVMode) {
      console.log('🎮 POV Loop stopping');
      return;
    }
    
    const center = map.getCenter();
    let lng = center.lng;
    let lat = center.lat;
    let moved = false;
    
    const bearing = map.getBearing();
    const bearingRad = (bearing * Math.PI) / 180;
    
    // Increased speed for better feel at zoom 17
    const speed = 0.00002; // ~2 meters at zoom 17
    
    if (keys.w) {
      lng += Math.sin(bearingRad) * speed;
      lat += Math.cos(bearingRad) * speed;
      moved = true;
    }
    if (keys.s) {
      lng -= Math.sin(bearingRad) * speed;
      lat -= Math.cos(bearingRad) * speed;
      moved = true;
    }
    if (keys.a) {
      lng -= Math.cos(bearingRad) * speed * 0.5;
      lat += Math.sin(bearingRad) * speed * 0.5;
      moved = true;
    }
    if (keys.d) {
      lng += Math.cos(bearingRad) * speed * 0.5;
      lat -= Math.sin(bearingRad) * speed * 0.5;
      moved = true;
    }
    
    if (moved) {
      // Use easeTo for smooth movement (preserves zoom/pitch)
      map.easeTo({
        center: [lng, lat],
        duration: 50,  // 50ms = smooth
        easing: (t) => t  // Linear
      });
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
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 20px;
      border-radius: 30px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      z-index: 1000;
      display: flex;
      gap: 15px;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    overlay.innerHTML = `
      <span>🚶 <b>Street View</b></span>
      <span style="opacity: 0.7;">WASD = walk</span>
      <span style="opacity: 0.7;">drag = look</span>
      <span style="opacity: 0.7;">P = exit</span>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  
  // Reduce building opacity for better street navigation
  if (map.getLayer('3d-buildings')) {
    map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.35);
  }
}

function hidePOVInstructions() {
  const overlay = document.getElementById('pov-instructions');
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  // Restore building opacity for aerial view
  if (map.getLayer('3d-buildings')) {
    map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.6);
  }
}

// Keyboard controls - prevent default to ensure they work
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (keys.hasOwnProperty(key)) {
    keys[key] = true;
    e.preventDefault(); // Prevent scrolling with arrow keys
    console.log(`🎮 Key pressed: ${key}`);
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
    console.log(`🎮 Key released: ${key}`);
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
    console.log('🚶 Entering POV mode...');
    
    // Get current position to stay at same location
    const currentCenter = map.getCenter();
    
    // Enter POV mode - TRUE street view (like Google Street View)
    // Zoom 17 = ~1m per pixel, good for street level
    // Pitch 0 = Looking forward (not down)
    map.easeTo({ 
      center: [currentCenter.lng, currentCenter.lat],
      zoom: 17,  // Street level (was 19, too close)
      pitch: 0,  // Look forward like a car (was 70/75, looking down)
      bearing: map.getBearing(), 
      duration: 1000 
    });
    
    // Show roads layer if not visible
    if (map.getLayer('roads')) {
      map.setLayoutProperty('roads', 'visibility', 'visible');
    }
    
    showPOVInstructions();
    startPOVLoop();
    if (btn) btn.textContent = '🚁 Exit Street View';
    isPOVMode = true;
    console.log('🚶 Street View ON — WASD to drive, mouse to steer');
  } else {
    console.log('🚁 Exiting POV mode...');
    // Exit POV mode - aerial view
    map.easeTo({ 
      zoom: 15, 
      pitch: 60, 
      duration: 1000 
    });
    hidePOVInstructions();
    stopPOVLoop();
    if (btn) btn.textContent = '🚶 Enter Street View';
    isPOVMode = false;
    console.log('🚁 Aerial View ON');
  }
});

console.log('🗺️ Lisbon 3D Explorer initialized');
console.log('   R = Reset view | P = Toggle POV | WASD = Walk (in POV)');
// Trigger rebuild
