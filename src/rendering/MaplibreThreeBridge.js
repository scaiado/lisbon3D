/**
 * Three.js + MapLibre Integration Bridge
 * Renders Three.js scene on top of MapLibre map
 */

import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

export class MaplibreThreeBridge {
  constructor(map) {
    this.map = map;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.renderer = null;
    this.origin = null; // Mercator coordinate origin
    
    // Custom layer for MapLibre
    this.layer = {
      id: 'threejs-overlay',
      type: 'custom',
      renderingMode: '3d',
      
      onAdd: (map, gl) => {
        this.initRenderer(gl);
        this.origin = maplibregl.MercatorCoordinate.fromLngLat(
          map.getCenter(),
          0
        );
      },
      
      render: (gl, matrix) => {
        this.render(gl, matrix);
      },
      
      onRemove: () => {
        this.cleanup();
      }
    };
  }

  initRenderer(gl) {
    // Create Three.js renderer using MapLibre's GL context
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.map.getCanvas(),
      context: gl,
      antialias: true
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(window.devicePixelRatio);
  }

  render(gl, matrix) {
    if (!this.renderer) return;

    // Convert MapLibre matrix to Three.js projection matrix
    const m = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = m;

    // Render Three.js scene
    this.renderer.state.reset();
    this.renderer.render(this.scene, this.camera);
    
    // Restore MapLibre GL state
    this.map.triggerRepaint();
  }

  // Convert lng/lat/alt to Three.js world position
  lngLatToWorld(lng, lat, altitude = 0) {
    if (!this.origin) {
      this.origin = maplibregl.MercatorCoordinate.fromLngLat(
        this.map.getCenter(),
        0
      );
    }
    
    const coord = maplibregl.MercatorCoordinate.fromLngLat(
      [lng, lat],
      altitude
    );
    
    return new THREE.Vector3(
      (coord.x - this.origin.x) * this.origin.meterInMercatorCoordinateUnits(),
      (coord.y - this.origin.y) * this.origin.meterInMercatorCoordinateUnits(),
      altitude
    );
  }

  // Convert world position back to lng/lat
  worldToLngLat(x, y, z) {
    if (!this.origin) return [0, 0];
    
    const scale = this.origin.meterInMercatorCoordinateUnits();
    const coord = new maplibregl.MercatorCoordinate(
      this.origin.x + x / scale,
      this.origin.y + y / scale,
      z
    );
    
    return coord.toLngLat();
  }

  // Add object to scene
  add(object) {
    this.scene.add(object);
  }

  // Remove object from scene
  remove(object) {
    this.scene.remove(object);
  }

  // Clear all objects
  clear() {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  cleanup() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.clear();
  }

  // Add layer to map
  addToMap() {
    if (!this.map.getLayer(this.layer.id)) {
      this.map.addLayer(this.layer);
    }
  }

  // Remove layer from map
  removeFromMap() {
    if (this.map.getLayer(this.layer.id)) {
      this.map.removeLayer(this.layer.id);
    }
  }
}
