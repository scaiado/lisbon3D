import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial
} from 'three';
import { type CollisionMap, floorAt } from './collision';
import type { GameplayLayout, Stop } from './gameplay';
import type { Impact, Vehicle } from './vehicle';

/**
 * The Nata Run: collect a box of pastéis de nata at the bakery at the top of the Bica, then deliver to each door
 * down the hill, in order. Pull up in the glowing bay and hold still for a moment to hand over. Knocks and hard
 * landings bruise the pastries; tips reward a quick, careful run.
 */
export type RunPhase = 'ready' | 'pickup' | 'deliver' | 'finished';

export interface RunEvent {
  kind: 'pickup' | 'delivered' | 'finished' | 'damage';
  title: string;
  detail: string;
}

export interface RunSummary {
  seconds: number;
  condition: number;
  tips: number;
  stars: number;
  delivered: number;
}

const HANDOVER_SECONDS = 0.8;
const BAY_RADIUS = 2.1;
const STOP_SPEED = 1.3;

export class NataRun {
  phase: RunPhase = 'ready';
  /** Seconds since the run started (first movement). */
  clock = 0;
  /** Pastry condition, 100 = perfect. */
  condition = 100;
  tips = 0;
  /** Next stop index while delivering. */
  index = 0;
  /** 0..1 while holding still in the bay. */
  handover = 0;
  readonly events: RunEvent[] = [];
  readonly group = new Group();

  private readonly markers: Marker[];
  private lastHandoverAt = 0;
  private damageCooldown = 0;
  private time = 0;

  constructor(
    private readonly layout: GameplayLayout,
    private readonly map: CollisionMap
  ) {
    const all = [layout.bakery, ...layout.stops];
    this.markers = all.map((stop, i) => new Marker(stop, map, i === 0 ? 'bakery' : 'home'));
    for (const marker of this.markers) this.group.add(marker.group);
    this.refreshMarkers();
  }

  get target(): Stop | null {
    if (this.phase === 'ready' || this.phase === 'pickup') return this.layout.bakery;
    if (this.phase === 'deliver') return this.layout.stops[this.index] ?? null;
    return null;
  }

  get total(): number {
    return this.layout.stops.length;
  }

  reset(): void {
    this.phase = 'ready';
    this.clock = 0;
    this.condition = 100;
    this.tips = 0;
    this.index = 0;
    this.handover = 0;
    this.lastHandoverAt = 0;
    this.refreshMarkers();
  }

  summary(): RunSummary {
    const stars = this.clock <= 80 && this.condition >= 85 ? 3 : this.clock <= 120 && this.condition >= 55 ? 2 : 1;
    return { seconds: this.clock, condition: this.condition, tips: this.tips, stars, delivered: this.phase === 'finished' ? this.total : this.index };
  }

  update(dt: number, car: Vehicle, impacts: readonly Impact[]): void {
    this.time += dt;
    this.damageCooldown -= dt;
    if (this.phase === 'ready' && Math.abs(car.speed) > 0.5) this.phase = 'pickup';
    if (this.phase === 'pickup' || this.phase === 'deliver') this.clock += dt;
    if (this.phase === 'deliver') this.bruise(impacts);

    const target = this.target;
    if (target && this.phase !== 'ready') {
      const dx = car.x - target.stand[0];
      const dz = car.z - target.stand[2];
      const inBay = Math.hypot(dx, dz) < BAY_RADIUS && Math.abs(car.speed) < STOP_SPEED;
      this.handover = inBay ? Math.min(1, this.handover + dt / HANDOVER_SECONDS) : Math.max(0, this.handover - dt * 3);
      if (this.handover >= 1) this.complete();
    }
    for (const marker of this.markers) marker.animate(this.time, dt);
    const active = this.markers[this.phase === 'deliver' ? this.index + 1 : 0];
    active?.setProgress(this.handover);
  }

  private complete(): void {
    this.handover = 0;
    if (this.phase === 'pickup') {
      this.phase = 'deliver';
      this.lastHandoverAt = this.clock;
      this.events.push({ kind: 'pickup', title: 'Box of natas on board', detail: `${this.total} deliveries down the Bica. Mind the cobbles!` });
    } else if (this.phase === 'deliver') {
      const stop = this.layout.stops[this.index]!;
      const leg = this.clock - this.lastHandoverAt;
      const tip = Math.max(0.5, 1.5 + Math.max(0, 22 - leg) * 0.1) * (0.4 + 0.6 * this.condition / 100);
      this.tips += tip;
      this.lastHandoverAt = this.clock;
      this.index++;
      this.events.push({ kind: 'delivered', title: `Delivered to ${stop.name}`, detail: `${stop.label} · tip €${tip.toFixed(2)}` });
      if (this.index >= this.total) {
        this.phase = 'finished';
        const s = this.summary();
        this.events.push({ kind: 'finished', title: 'All delivered!', detail: `${formatTime(s.seconds)} · natas ${Math.round(s.condition)} % · tips €${s.tips.toFixed(2)}` });
      }
    }
    this.refreshMarkers();
  }

  private bruise(impacts: readonly Impact[]): void {
    for (const impact of impacts) {
      const threshold = impact.kind === 'landing' ? 1.8 : 1.2;
      const loss = Math.max(0, impact.speed - threshold) * (impact.kind === 'funicular' ? 9 : impact.kind === 'landing' ? 5 : 6);
      if (loss <= 0) continue;
      this.condition = Math.max(0, this.condition - loss);
      if (loss > 4 && this.damageCooldown <= 0) {
        this.damageCooldown = 2.5;
        this.events.push({ kind: 'damage', title: 'Careful, the natas!', detail: `Pastries at ${Math.round(this.condition)} %` });
      }
    }
  }

  private refreshMarkers(): void {
    const activeIndex = this.phase === 'finished' ? -1 : this.phase === 'deliver' ? this.index + 1 : 0;
    this.markers.forEach((marker, i) => {
      const done = i === 0 ? this.phase === 'deliver' || this.phase === 'finished' : i - 1 < this.index && this.phase !== 'ready' && this.phase !== 'pickup';
      marker.setState(i === activeIndex ? 'active' : done ? 'done' : 'waiting');
    });
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

type MarkerState = 'active' | 'waiting' | 'done';

/** A delivery bay: a glowing ring on the cobbles, a soft light column, and a pastry sign over the door. */
class Marker {
  readonly group = new Group();
  private readonly ring: Mesh;
  private readonly fill: Mesh;
  private readonly beam: Mesh;
  private readonly sign: Sprite;
  private readonly signY: number;
  private state: MarkerState = 'waiting';
  private progress = 0;

  constructor(stop: Stop, map: CollisionMap, kind: 'bakery' | 'home') {
    const [sx, , sz] = stop.stand;
    const ground = floorAt(map, sx, sz) ?? stop.stand[1];
    const ahead = floorAt(map, sx, sz - 1) ?? ground;
    const behind = floorAt(map, sx, sz + 1) ?? ground;
    const tilt = Math.atan2(behind - ahead, 2);

    const glow = new MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide, fog: false });
    this.ring = new Mesh(new RingGeometry(BAY_RADIUS - 0.28, BAY_RADIUS, 56), glow);
    this.fill = new Mesh(new RingGeometry(0, BAY_RADIUS - 0.36, 56, 1, 0, 0.0001), glow.clone());
    for (const disc of [this.ring, this.fill]) {
      // The street rises toward +z: lower the downhill edge of the ring to lie on the slope.
      disc.rotation.set(-Math.PI / 2 - tilt, 0, 0);
      disc.position.set(sx, ground + 0.06, sz);
      disc.renderOrder = 2;
      this.group.add(disc);
    }
    this.beam = new Mesh(
      new CylinderGeometry(0.5, 0.5, 9, 24, 1, true),
      new MeshBasicMaterial({ map: beamTexture(), color: '#ffcf70', transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false })
    );
    this.beam.position.set(sx, ground + 4.5, sz);
    this.group.add(this.beam);

    this.sign = new Sprite(new SpriteMaterial({ map: signTexture(kind, stop.label), transparent: true, depthWrite: false, fog: false }));
    const [dx, dy, dz] = stop.door;
    this.signY = Math.max(dy, ground) + 3.1;
    this.sign.position.set(dx * 0.8 + sx * 0.2, this.signY, dz * 0.8 + sz * 0.2);
    this.sign.scale.set(1.4, 1.4, 1);
    this.group.add(this.sign);
  }

  setState(state: MarkerState): void {
    this.state = state;
    const active = state === 'active';
    this.ring.visible = active;
    this.fill.visible = active;
    this.beam.visible = active;
    this.sign.visible = state !== 'done';
    (this.sign.material as SpriteMaterial).opacity = active ? 1 : 0.45;
    this.sign.scale.setScalar(active ? 1.5 : 0.9);
  }

  setProgress(progress: number): void {
    if (Math.abs(progress - this.progress) < 0.01) return;
    this.progress = progress;
    const geometry = new RingGeometry(0, BAY_RADIUS - 0.36, 56, 1, Math.PI / 2, Math.max(0.0001, progress * Math.PI * 2));
    this.fill.geometry.dispose();
    this.fill.geometry = geometry;
  }

  animate(time: number, dt: number): void {
    if (this.state !== 'active') return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    (this.ring.material as MeshBasicMaterial).opacity = 0.55 + 0.4 * pulse;
    (this.beam.material as MeshBasicMaterial).opacity = 0.3 + 0.2 * pulse;
    this.sign.position.y = this.signY + Math.sin(time * 2.2) * 0.15;
    this.beam.rotation.y += dt * 0.4;
  }
}

function beamTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(0.97, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A round cream sign with a painted pastel de nata (or a bakery whisk-and-tart for the pick-up) and its label. */
function signTexture(kind: 'bakery' | 'home', label: string): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  ctx.fillStyle = kind === 'bakery' ? '#2f6f8f' : '#fbf4e6';
  ctx.strokeStyle = kind === 'bakery' ? '#fbf4e6' : '#2f6f8f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(c, c - 16, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // the tart: fluted golden case, caramelised custard with dark blisters
  ctx.fillStyle = '#d99a48';
  ctx.beginPath();
  ctx.ellipse(c, c - 6, 58, 30, 0, 0, Math.PI);
  ctx.lineTo(c - 58, c - 6);
  ctx.fill();
  ctx.fillStyle = '#f2c96b';
  ctx.beginPath();
  ctx.ellipse(c, c - 12, 54, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b3a1e';
  for (const [x, y, r] of [[-22, -16, 7], [8, -20, 9], [26, -8, 6], [-6, -4, 5], [-30, -4, 4]] as const) {
    ctx.beginPath();
    ctx.arc(c + x, c - 12 + y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = kind === 'bakery' ? '#fbf4e6' : '#2f6f8f';
  ctx.font = 'bold 30px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(kind === 'bakery' ? 'PICK UP' : label, c, c + 58);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
