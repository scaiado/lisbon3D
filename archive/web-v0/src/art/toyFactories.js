import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SHIRT_PALETTE, TOY_COLORS } from './toyPalette.js';

export function createCarMesh() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: TOY_COLORS.carRed, roughness: 0.42, metalness: 0.18 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x7f241c, roughness: 0.5, metalness: 0.12 });
  const glass = new THREE.MeshStandardMaterial({ color: TOY_COLORS.glass, roughness: 0.18, metalness: 0.35 });
  const light = new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd166, emissiveIntensity: 0.75 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2a1f, emissive: 0xff1e1e, emissiveIntensity: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.72, metalness: 0.1 });

  const chassis = new THREE.Mesh(new RoundedBoxGeometry(2.28, 0.7, 3.9, 3, 0.18), paint);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;

  const hood = new THREE.Mesh(new RoundedBoxGeometry(1.92, 0.34, 1.05, 2, 0.13), paint);
  hood.position.set(0, 0.86, -1.35);
  hood.castShadow = true;

  const trunk = new THREE.Mesh(new RoundedBoxGeometry(1.92, 0.3, 0.72, 2, 0.12), darkPaint);
  trunk.position.set(0, 0.78, 1.35);
  trunk.castShadow = true;

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.72, 1.34, 3, 0.14), glass);
  cabin.position.set(0, 1.23, 0.04);
  cabin.castShadow = true;

  const windshield = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.08, 0.78, 1, 0.06), glass);
  windshield.position.set(0, 1.38, -0.76);
  windshield.rotation.x = -0.34;

  const bumper = new THREE.Mesh(new RoundedBoxGeometry(2.05, 0.28, 0.22, 1, 0.08), trim);
  bumper.position.set(0, 0.5, -2.05);

  const rearBumper = new THREE.Mesh(new RoundedBoxGeometry(2.05, 0.24, 0.2, 1, 0.08), trim);
  rearBumper.position.set(0, 0.48, 1.98);

  for (const x of [-0.58, 0.58]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), light);
    headlight.position.set(x, 0.76, -2.18);
    group.add(headlight);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), tail);
    tailLight.position.set(x, 0.7, 2.12);
    group.add(tailLight);
  }

  group.add(chassis, hood, trunk, cabin, windshield, bumper, rearBumper);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const hubMaterial = new THREE.MeshStandardMaterial({ color: 0xc7ccd1, roughness: 0.35, metalness: 0.35 });
  for (const x of [-1.12, 1.12]) {
    for (const z of [-1.45, 1.45]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.32, 18), wheelMaterial);
      wheel.position.set(x, 0.34, z);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      group.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 16), hubMaterial);
      hub.position.set(x * 1.004, 0.34, z);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
    }
  }

  return group;
}

export function createPerson(seed = 0) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT_PALETTE[seed % SHIRT_PALETTE.length], roughness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a06f, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.86 });
  const hatMaterial = new THREE.MeshStandardMaterial({ color: seed % 2 === 0 ? 0xffd166 : 0x1d3557, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 5, 10), shirt);
  body.position.y = 0.98;
  body.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;

  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.18, 12), hatMaterial);
  hat.position.y = 2.02;
  hat.castShadow = true;

  for (const x of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.44, 3, 6), shirt);
    arm.position.set(x, 1.08, 0);
    arm.rotation.z = x > 0 ? -0.38 : 0.38;
    arm.castShadow = true;
    group.add(arm);
  }

  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 6), dark);
    leg.position.set(x, 0.36, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  group.add(body, head, hat);
  return group;
}

export function createParkedCar(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1f3340, roughness: 0.2, metalness: 0.22 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(2, 0.56, 3.6, 2, 0.14), paint);
  body.position.y = 0.5;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.36, 0.54, 1.28, 2, 0.12), glass);
  cabin.position.y = 1.02;
  cabin.castShadow = true;
  group.add(body, cabin);

  for (const x of [-1.02, 1.02]) {
    for (const z of [-1.2, 1.2]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), tire);
      wheel.position.set(x, 0.28, z);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    }
  }
  return group;
}

export function createDog() {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.88 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.36, 0.38, 2, 0.1), fur);
  body.position.y = 0.42;
  body.castShadow = true;
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.28, 0.3, 2, 0.08), fur);
  head.position.set(0.58, 0.52, 0);
  head.castShadow = true;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.48, 6), fur);
  tail.position.set(-0.52, 0.62, 0);
  tail.rotation.z = 0.9;
  group.add(body, head, tail);
  return group;
}

export function createSeagull() {
  const group = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: 0xf8f5e9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), white);
  body.scale.set(1.3, 0.5, 0.65);
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.12), white);
  leftWing.position.x = -0.44;
  leftWing.rotation.z = 0.32;
  const rightWing = leftWing.clone();
  rightWing.position.x = 0.44;
  rightWing.rotation.z = -0.32;
  group.add(body, leftWing, rightWing);
  return group;
}

export function createTree({ height, canopyScale, leafMaterial, trunkMaterial }) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, height, 7), trunkMaterial);
  trunk.position.y = height / 2;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * canopyScale, 1), leafMaterial);
  canopy.position.y = height + 1.4 * canopyScale;
  canopy.scale.set(1.05, 1.18, 0.95);
  canopy.castShadow = true;
  canopy.receiveShadow = true;

  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55 * canopyScale, 1), leafMaterial);
  top.position.set(0.35 * canopyScale, height + 3.1 * canopyScale, -0.25 * canopyScale);
  top.castShadow = true;
  top.receiveShadow = true;

  tree.add(trunk, canopy, top);
  return tree;
}

export function createLamp(metal, glow) {
  const lamp = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 8), metal);
  post.position.y = 2.1;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glow);
  bulb.position.y = 4.45;
  lamp.add(post, bulb);
  return lamp;
}

export function createBench(wood, metal) {
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.18, 0.55, 1, 0.08), wood);
  seat.position.y = 0.55;
  const back = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.16, 0.42, 1, 0.08), wood);
  back.position.set(0, 0.92, 0.28);
  back.rotation.x = -0.22;
  for (const x of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), metal);
    leg.position.set(x, 0.28, -0.12);
    bench.add(leg);
  }
  bench.add(seat, back);
  return bench;
}

export function createKiosk(red, cream) {
  const kiosk = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(4.3, 3.1, 3.2, 2, 0.22), cream);
  base.position.y = 1.55;
  base.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), red);
  roof.position.y = 3.8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  kiosk.add(base, roof);
  return kiosk;
}

export function createToyArch() {
  const stone = new THREE.MeshStandardMaterial({ color: 0xf1d69a, roughness: 0.76 });
  const shadow = new THREE.MeshStandardMaterial({ color: 0x7d5a3c, roughness: 0.84 });
  const arch = new THREE.Group();

  for (const x of [-10, 10]) {
    const pillar = new THREE.Mesh(new RoundedBoxGeometry(5, 24, 6, 2, 0.28), stone);
    pillar.position.set(x, 12, 0);
    pillar.castShadow = true;
    arch.add(pillar);
  }

  const lintel = new THREE.Mesh(new RoundedBoxGeometry(28, 5, 6.4, 2, 0.32), stone);
  lintel.position.set(0, 25.5, 0);
  lintel.castShadow = true;
  arch.add(lintel);

  const cap = new THREE.Mesh(new RoundedBoxGeometry(34, 2.4, 7, 1, 0.26), shadow);
  cap.position.set(0, 30, 0);
  cap.castShadow = true;
  arch.add(cap);
  return arch;
}

export function createToyCastle() {
  const wall = new THREE.MeshStandardMaterial({ color: 0xd6c3a0, roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ color: TOY_COLORS.terracotta, roughness: 0.82 });
  const castle = new THREE.Group();

  for (const [x, z, h] of [[0, 0, 20], [14, 4, 15], [-13, -5, 17]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, h, 8), wall);
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    castle.add(tower);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(5.4, 5.5, 8), roof);
    hat.position.set(x, h + 2.7, z);
    hat.castShadow = true;
    castle.add(hat);
  }

  const keep = new THREE.Mesh(new RoundedBoxGeometry(30, 10, 8, 2, 0.35), wall);
  keep.position.set(0, 5, 0);
  keep.castShadow = true;
  castle.add(keep);
  return castle;
}

export function createToyTram() {
  const tram = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: TOY_COLORS.tramYellow, roughness: 0.48, metalness: 0.08 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x7a3828, roughness: 0.68 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x17364a, roughness: 0.22, metalness: 0.25 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.7 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(2.8, 2.4, 8.2, 3, 0.18), bodyMaterial);
  body.position.y = 1.45;
  body.castShadow = true;
  tram.add(body);

  const roof = new THREE.Mesh(new RoundedBoxGeometry(3, 0.38, 8.6, 2, 0.18), roofMaterial);
  roof.position.y = 2.85;
  roof.castShadow = true;
  tram.add(roof);

  for (const z of [-2.8, -1.15, 0.55, 2.25]) {
    const window = new THREE.Mesh(new RoundedBoxGeometry(2.94, 0.72, 0.72, 1, 0.08), glassMaterial);
    window.position.set(0, 1.85, z);
    window.castShadow = true;
    tram.add(window);
  }

  for (const z of [-3.3, 3.3]) {
    const wheelBar = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.32, 0.72), trimMaterial);
    wheelBar.position.set(0, 0.42, z);
    tram.add(wheelBar);
  }

  return tram;
}
