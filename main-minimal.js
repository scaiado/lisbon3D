/**
 * Lisbon 3D - Drive Mode (Minimal Test)
 * Proves first-person camera works
 */

import maplibregl from 'maplibre-gl';

const LISBON_CENTER = [-9.1393, 38.7223];
const MAPTILER_KEY = 'TPftMzBdOfDE265XubQA';

let map;
let isDriveMode = false;

// Simple state
let pos = [...LISBON_CENTER];
let bearing = -20;
let speed = 0;

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
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

// Add buildings
map.on('load', () => {
  if (!MAPTILER_KEY) return;
  
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
  
  console.log('Map ready');
});

// Drive mode toggle
document.getElementById('pov-toggle').addEventListener('click', () => {
  isDriveMode = !isDriveMode;
  const btn = document.getElementById('pov-toggle');
  
  if (isDriveMode) {
    btn.textContent = '🚁 Exit Drive Mode';
    
    // CRITICAL: Disable all map interactions
    map.dragPan.disable();
    map.dragRotate.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    
    // Switch to first-person view
    pos = map.getCenter().toArray();
    bearing = map.getBearing();
    
    map.easeTo({
      center: pos,
      zoom: 18,
      pitch: 5,  // LOOKING FORWARD (not down!)
      bearing: bearing,
      duration: 800
    });
    
    console.log('Drive mode ON - pitch should be 5°');
    
    // Start driving loop
    requestAnimationFrame(driveLoop);
    
  } else {
    btn.textContent = '🚗 Enter Drive Mode';
    
    // Re-enable interactions
    map.dragPan.enable();
    map.dragRotate.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    
    map.easeTo({
      zoom: 15,
      pitch: 60,
      duration: 800
    });
    
    console.log('Drive mode OFF');
  }
});

// Input
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Drive loop
function driveLoop() {
  if (!isDriveMode) return;
  
  // Simple physics
  if (keys['w']) speed = Math.min(speed + 1, 80);
  else if (keys['s']) speed = Math.max(speed - 2, -20);
  else speed *= 0.95;
  
  if (Math.abs(speed) > 1) {
    if (keys['a']) bearing -= 2;
    if (keys['d']) bearing += 2;
  }
  
  // Move
  const rad = bearing * Math.PI / 180;
  const move = speed * 0.00001;
  pos[0] += Math.sin(rad) * move;
  pos[1] += Math.cos(rad) * move;
  
  // Update camera - FIRST PERSON (low pitch)
  map.jumpTo({
    center: pos,
    bearing: bearing,
    pitch: 5,  // STREET LEVEL VIEW
    zoom: 18
  });
  
  // Update speed display if exists
  const el = document.getElementById('speedometer');
  if (el) el.textContent = Math.round(speed) + ' km/h';
  
  requestAnimationFrame(driveLoop);
}

console.log('Drive mode ready - Click button to test');
