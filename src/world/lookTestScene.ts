import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createRandom, type Random } from '../core/random';
import { PALETTE } from './palette';

/**
 * Renderer look test: one sloped street block with roughly the workload the first playable slice
 * is budgeted for. It is a performance and look probe, not game content.
 */

export const STREET = {
  /** Street runs along +Z, from the river quay (low) to a small plaza (high). */
  startZ: -40,
  endZ: 200,
  slopeStartZ: 20,
  slopeEndZ: 140,
  /** 14 % gradient: roughly Rua do Alecrim. Bica is steeper; Stage 2 tests 20 %. */
  gradient: 0.14,
  roadHalfWidth: 3.5,
  sidewalkWidth: 2.2,
  curbHeight: 0.15
} as const;

export function streetHeight(z: number): number {
  const climb = Math.min(Math.max(z, STREET.slopeStartZ), STREET.slopeEndZ) - STREET.slopeStartZ;
  return climb * STREET.gradient;
}

export interface LookTestWorld {
  scene: Scene;
  car: Group;
  /** Moves the sun's shadow frustum with the action so a tight shadow map stays sharp. */
  followSun(target: Vector3): void;
  instanceCounts: Record<string, number>;
}

export function buildLookTestScene(options: { shadows: boolean; density: number }): LookTestWorld {
  const random = createRandom(1755);
  const scene = new Scene();
  scene.background = new Color(PALETTE.haze);
  scene.fog = new Fog(PALETTE.haze, 70, 330);

  const hemi = new HemisphereLight(PALETTE.sky, PALETTE.bounce, 1.15);
  scene.add(hemi);

  const sun = new DirectionalLight(PALETTE.sun, 3.1);
  const sunOffset = new Vector3(-55, 48, 30);
  sun.castShadow = options.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const counts: Record<string, number> = {};
  const add = (name: string, mesh: Mesh | InstancedMesh, castShadow = true): void => {
    mesh.name = name;
    mesh.castShadow = castShadow && options.shadows;
    mesh.receiveShadow = options.shadows;
    if (mesh instanceof InstancedMesh) counts[name] = mesh.count;
    scene.add(mesh);
  };

  add('ground', buildGround(), false);
  add('road', buildStrip(0, STREET.roadHalfWidth * 2, 0, PALETTE.asphalt, 0.92), false);
  for (const side of [-1, 1]) {
    const center = side * (STREET.roadHalfWidth + STREET.sidewalkWidth / 2);
    add(`sidewalk-${side}`, buildStrip(center, STREET.sidewalkWidth, STREET.curbHeight, PALETTE.calcada, 0.95), false);
  }
  add('river', buildRiver(), false);

  const buildings = layoutBuildings(random);
  add('buildings', buildingMesh(buildings, random));
  add('roofs', roofMesh(buildings, random));
  const facade = facadeDetail(buildings, random);
  add('windows', facade.windows, false);
  add('shutters', facade.shutters, false);
  add('balconies', facade.balconies);

  const props = streetProps(random, options.density);
  for (const [name, mesh] of Object.entries(props)) add(name, mesh);

  add('rails', railMesh(), false);

  const car = buildMicrocar();
  car.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = options.shadows;
      child.receiveShadow = options.shadows;
    }
  });
  scene.add(car);

  return {
    scene,
    car,
    followSun(target) {
      sun.position.copy(target).add(sunOffset);
      sun.target.position.copy(target);
    },
    instanceCounts: counts
  };
}

function buildGround(): Mesh {
  const length = STREET.endZ - STREET.startZ + 120;
  const geometry = new PlaneGeometry(260, length, 4, 120);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes['position']!;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i) + (STREET.startZ + STREET.endZ) / 2;
    positions.setZ(i, z);
    positions.setY(i, streetHeight(z) - 0.02);
  }
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }));
}

function buildStrip(centerX: number, width: number, lift: number, color: number, roughness: number): Mesh {
  const length = STREET.endZ - STREET.startZ;
  const geometry = new PlaneGeometry(width, length, 1, 120);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes['position']!;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i) + (STREET.startZ + STREET.endZ) / 2;
    positions.setX(i, positions.getX(i) + centerX);
    positions.setZ(i, z);
    positions.setY(i, streetHeight(z) + lift);
  }
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshStandardMaterial({ color, roughness }));
}

function buildRiver(): Mesh {
  const geometry = new PlaneGeometry(600, 260);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -1.4, STREET.startZ - 130);
  return new Mesh(geometry, new MeshStandardMaterial({ color: PALETTE.river, roughness: 0.18, metalness: 0.1 }));
}

interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  base: number;
  side: number;
  storeys: number;
  facadeColor: Color;
}

function layoutBuildings(random: Random): Building[] {
  const buildings: Building[] = [];
  const frontOffset = STREET.roadHalfWidth + STREET.sidewalkWidth;

  for (const side of [-1, 1]) {
    for (const row of [0, 1, 2]) {
      let z = STREET.startZ + 6 + random.range(0, 4);
      while (z < STREET.endZ - 30) {
        const width = random.range(6.5, 11);
        const depth = random.range(9, 13);
        const storeys = random.int(3, 5) + row;
        const height = storeys * 3.1 + 0.6;
        const centerZ = z + width / 2;
        const ground = streetHeight(centerZ);
        const x = side * (frontOffset + depth / 2 + row * 15);
        buildings.push({
          x,
          z: centerZ,
          width,
          depth,
          height,
          base: ground - 2.5,
          side,
          storeys,
          facadeColor: new Color(random.pick(PALETTE.facades))
        });
        z += width + (random.chance(0.12) ? random.range(2, 5) : 0.15);
      }
    }
  }
  return buildings;
}

function buildingMesh(buildings: Building[], random: Random): InstancedMesh {
  const geometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.04);
  const material = new MeshStandardMaterial({ roughness: 0.88 });
  const mesh = new InstancedMesh(geometry, material, buildings.length);
  const matrix = new Matrix4();
  buildings.forEach((b, i) => {
    const height = b.height + 2.5;
    matrix.compose(
      new Vector3(b.x, b.base + height / 2, b.z),
      new Quaternion(),
      new Vector3(b.depth, height, b.width)
    );
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, b.facadeColor.clone().offsetHSL(0, 0, random.range(-0.03, 0.03)));
  });
  return mesh;
}

function roofMesh(buildings: Building[], random: Random): InstancedMesh {
  const geometry = new ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  geometry.rotateY(Math.PI / 4);
  const material = new MeshStandardMaterial({ roughness: 0.8 });
  const mesh = new InstancedMesh(geometry, material, buildings.length);
  const matrix = new Matrix4();
  buildings.forEach((b, i) => {
    const roofHeight = random.range(1.6, 2.6);
    matrix.compose(
      new Vector3(b.x, b.base + 2.5 + b.height + roofHeight / 2, b.z),
      new Quaternion(),
      new Vector3(b.depth + 0.5, roofHeight, b.width + 0.5)
    );
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, new Color(random.pick(PALETTE.roofs)));
  });
  return mesh;
}

function facadeDetail(buildings: Building[], random: Random) {
  const windowSlots: Matrix4[] = [];
  const shutterSlots: Matrix4[] = [];
  const balconySlots: Matrix4[] = [];
  const shutterColors: Color[] = [];
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  for (const b of buildings) {
    const faceX = b.x - b.side * (b.depth / 2 + 0.03);
    const bays = Math.max(2, Math.floor(b.width / 2.3));
    const spacing = b.width / bays;
    const shutterColor = new Color(random.pick(PALETTE.shutters));
    for (let storey = 0; storey < b.storeys; storey++) {
      const y = b.base + 2.5 + storey * 3.1 + 1.75;
      for (let bay = 0; bay < bays; bay++) {
        const z = b.z - b.width / 2 + spacing * (bay + 0.5);
        const tall = storey === 0 ? 2.3 : 1.7;
        windowSlots.push(new Matrix4().compose(position.set(faceX, y - (storey === 0 ? 0.3 : 0), z), rotation, scale.set(0.08, tall, 1.0)));
        if (storey > 0 && random.chance(0.6)) {
          for (const edge of [-1, 1]) {
            shutterSlots.push(new Matrix4().compose(position.set(faceX - b.side * 0.02, y, z + edge * 0.78), rotation, scale.set(0.06, 1.7, 0.5)));
            shutterColors.push(shutterColor);
          }
        }
        if (storey > 0 && random.chance(0.35)) {
          balconySlots.push(new Matrix4().compose(position.set(faceX - b.side * 0.45, y - 0.95, z), rotation, scale.set(0.9, 0.12, 1.5)));
        }
      }
    }
  }

  const windows = instanced(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.25, metalness: 0.2 }), windowSlots);
  const shutters = instanced(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.7 }), shutterSlots);
  shutterColors.forEach((color, i) => shutters.setColorAt(i, color));
  const balconies = instanced(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: PALETTE.ironwork, roughness: 0.6, metalness: 0.4 }), balconySlots);
  return { windows, shutters, balconies };
}

function streetProps(random: Random, density: number): Record<string, InstancedMesh> {
  const lampPoles: Matrix4[] = [];
  const lampHeads: Matrix4[] = [];
  const bollards: Matrix4[] = [];
  const trunks: Matrix4[] = [];
  const canopies: Matrix4[] = [];
  const planters: Matrix4[] = [];
  const unit = new Quaternion();
  const curbX = STREET.roadHalfWidth + 0.35;

  for (let z = STREET.startZ + 4; z < STREET.endZ; z += 14 / density) {
    for (const side of [-1, 1]) {
      const y = streetHeight(z) + STREET.curbHeight;
      lampPoles.push(new Matrix4().compose(new Vector3(side * curbX, y + 2.2, z), unit, new Vector3(1, 4.4, 1)));
      lampHeads.push(new Matrix4().compose(new Vector3(side * (curbX - 0.35), y + 4.45, z), unit, new Vector3(1, 1, 1)));
    }
  }

  for (let z = STREET.startZ + 2; z < STREET.endZ; z += 1.6 / density) {
    for (const side of [-1, 1]) {
      if (random.chance(0.55)) continue;
      const y = streetHeight(z) + STREET.curbHeight;
      bollards.push(new Matrix4().compose(new Vector3(side * (curbX - 0.05), y + 0.45, z), unit, new Vector3(1, 1, 1)));
    }
  }

  // Plaza at the top of the street and a scatter of trees and planters across the block.
  const treeCount = Math.round(360 * density);
  for (let i = 0; i < treeCount; i++) {
    const onPlaza = i < treeCount * 0.35;
    const x = onPlaza ? random.range(-24, 24) : random.sign() * random.range(36, 120);
    const z = onPlaza ? random.range(STREET.endZ - 26, STREET.endZ + 30) : random.range(STREET.startZ, STREET.endZ + 40);
    if (onPlaza && Math.abs(x) < STREET.roadHalfWidth + 3) continue;
    const y = streetHeight(z);
    const size = random.range(0.8, 1.35);
    trunks.push(new Matrix4().compose(new Vector3(x, y + 1.3 * size, z), unit, new Vector3(size, size, size)));
    canopies.push(new Matrix4().compose(new Vector3(x, y + 3.6 * size, z), unit, new Vector3(size * 2.1, size * 1.8, size * 2.1)));
    if (random.chance(0.5)) {
      planters.push(new Matrix4().compose(new Vector3(x + random.range(-3, 3), y + 0.35, z + random.range(-3, 3)), unit, new Vector3(1, 1, 1)));
    }
  }

  return {
    lampPoles: instanced(new CylinderGeometry(0.07, 0.1, 1, 10), new MeshStandardMaterial({ color: PALETTE.ironwork, roughness: 0.55, metalness: 0.5 }), lampPoles),
    lampHeads: instanced(new SphereGeometry(0.28, 14, 10), new MeshStandardMaterial({ color: PALETTE.lampGlow, emissive: PALETTE.lampGlow, emissiveIntensity: 2.4 }), lampHeads),
    bollards: instanced(new CylinderGeometry(0.11, 0.13, 0.9, 10), new MeshStandardMaterial({ color: PALETTE.ironwork, roughness: 0.5, metalness: 0.4 }), bollards),
    trunks: instanced(new CylinderGeometry(0.14, 0.2, 2.6, 7), new MeshStandardMaterial({ color: PALETTE.bark, roughness: 0.95 }), trunks),
    canopies: instanced(new IcosahedronGeometry(1, 2), new MeshStandardMaterial({ color: PALETTE.leaf, roughness: 0.9 }), canopies),
    planters: instanced(new RoundedBoxGeometry(1.1, 0.7, 1.1, 2, 0.08), new MeshStandardMaterial({ color: PALETTE.terracotta, roughness: 0.85 }), planters)
  };
}

function railMesh(): InstancedMesh {
  const slots: Matrix4[] = [];
  const step = 2;
  for (let z = STREET.startZ; z < STREET.endZ; z += step) {
    const y0 = streetHeight(z);
    const y1 = streetHeight(z + step);
    const pitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.atan2(y1 - y0, step));
    for (const x of [-0.72, 0.72]) {
      slots.push(new Matrix4().compose(new Vector3(x, (y0 + y1) / 2 + 0.02, z + step / 2), pitch, new Vector3(0.08, 0.03, step)));
    }
  }
  return instanced(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: PALETTE.rail, roughness: 0.3, metalness: 0.8 }), slots);
}

/** Placeholder microcar (≈2.4 × 1.3 m) so the camera framing and scale can be judged. Not final art. */
export function buildMicrocar(): Group {
  const car = new Group();
  car.name = 'microcar';
  const body = new Mesh(new RoundedBoxGeometry(1.3, 0.75, 2.4, 4, 0.3), new MeshStandardMaterial({ color: PALETTE.carPaint, roughness: 0.35 }));
  body.position.y = 0.62;
  const cabin = new Mesh(new RoundedBoxGeometry(1.12, 0.6, 1.25, 4, 0.26), new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.15, metalness: 0.3 }));
  cabin.position.set(0, 1.18, -0.15);
  const roof = new Mesh(new RoundedBoxGeometry(1.16, 0.12, 1.1, 3, 0.05), new MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.4 }));
  roof.position.set(0, 1.5, -0.15);
  car.add(body, cabin, roof);

  const wheelGeometry = new CylinderGeometry(0.27, 0.27, 0.2, 18);
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheelMaterial = new MeshStandardMaterial({ color: PALETTE.tyre, roughness: 0.9 });
  for (const x of [-0.6, 0.6]) {
    for (const z of [-0.78, 0.8]) {
      const wheel = new Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, 0.27, z);
      car.add(wheel);
    }
  }
  const lampMaterial = new MeshStandardMaterial({ color: PALETTE.lampGlow, emissive: PALETTE.lampGlow, emissiveIntensity: 1.6 });
  for (const x of [-0.4, 0.4]) {
    const lamp = new Mesh(new SphereGeometry(0.13, 14, 10), lampMaterial);
    lamp.position.set(x, 0.72, 1.18);
    car.add(lamp);
  }
  return car;
}

function instanced(geometry: BoxGeometry | CylinderGeometry | SphereGeometry | IcosahedronGeometry | RoundedBoxGeometry, material: MeshStandardMaterial, slots: Matrix4[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, slots.length));
  slots.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
  mesh.count = slots.length;
  return mesh;
}
