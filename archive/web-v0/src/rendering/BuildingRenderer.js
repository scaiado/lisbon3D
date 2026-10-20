/**
 * Building Renderer - Instanced mesh for performance
 * Converts OSM building data to Three.js buildings
 */

import * as THREE from 'three';

export class BuildingRenderer {
  constructor(scene, maxBuildings = 5000) {
    this.scene = scene;
    this.maxBuildings = maxBuildings;
    
    // Building geometry (box)
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.geometry.translate(0, 0.5, 0); // Pivot at bottom
    
    // Building material
    this.material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Instanced mesh for performance
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      maxBuildings
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    
    this.scene.add(this.mesh);
    
    // Track building data
    this.buildings = new Map(); // id -> { index, matrix }
    this.count = 0;
    
    // Dummy for matrix calculations
    this.dummy = new THREE.Object3D();
  }

  // Add building from OSM data
  addBuilding(id, footprint, height, type = 'residential') {
    if (this.count >= this.maxBuildings) return false;
    
    // Calculate center from footprint
    const center = this.calculateCenter(footprint);
    
    // Set position and scale
    this.dummy.position.set(center.x, center.y, center.z);
    this.dummy.scale.set(1, height, 1); // Will be adjusted per footprint
    this.dummy.updateMatrix();
    
    // Update instance
    this.mesh.setMatrixAt(this.count, this.dummy.matrix);
    
    // Color by building type
    const color = this.getBuildingColor(type);
    this.mesh.setColorAt(this.count, color);
    
    // Track building
    this.buildings.set(id, {
      index: this.count,
      footprint: footprint,
      height: height,
      type: type
    });
    
    this.count++;
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    
    return true;
  }

  // Add multiple buildings at once
  addBuildings(buildingsData) {
    let added = 0;
    for (const data of buildingsData) {
      if (this.addBuilding(data.id, data.footprint, data.height, data.type)) {
        added++;
      } else {
        break; // Max reached
      }
    }
    return added;
  }

  // Remove all buildings
  clear() {
    this.count = 0;
    this.mesh.count = 0;
    this.buildings.clear();
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Calculate centroid from footprint coordinates
  calculateCenter(footprint) {
    let sumX = 0, sumZ = 0;
    for (const point of footprint) {
      sumX += point.x;
      sumZ += point.z;
    }
    return {
      x: sumX / footprint.length,
      y: 0,
      z: sumZ / footprint.length
    };
  }

  // Get color by building type
  getBuildingColor(type) {
    const colors = {
      residential: new THREE.Color(0xd4c5b5),  // Beige
      commercial: new THREE.Color(0x9db4c0),   // Light blue
      industrial: new THREE.Color(0x8b7355),   // Brown
      retail: new THREE.Color(0xc9a959),       // Gold
      office: new THREE.Color(0xb8c5d6),       // Light gray-blue
      default: new THREE.Color(0xcccccc)       // Gray
    };
    return colors[type] || colors.default;
  }

  // Update visibility based on camera distance (LOD)
  updateLOD(cameraPosition) {
    // Simple LOD: hide distant buildings
    const maxDistance = 2000; // meters
    
    for (const [id, building] of this.buildings) {
      const dist = this.dummy.position.distanceTo(cameraPosition);
      // Could implement fading here
    }
  }

  // Get building count
  getCount() {
    return this.count;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
