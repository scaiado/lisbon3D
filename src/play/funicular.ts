import { Matrix3, Matrix4, Mesh, type Object3D, Vector3 } from 'three';
import type { GameplayLayout } from './gameplay';
import type { MovingObstacle } from './vehicle';

/**
 * The Bica funicular as a Lisbon obstacle. It waits near the top until the run starts, then rolls down
 * the hill ahead of the player at a funicular's pace and parks at the bottom station. Nothing overtakes it in a 6 m
 * street, so catching up means riding behind the tram until the next door. It stops (and rings) rather than push a
 * car that has got in front of it.
 *
 * Its meshes are the ones with funicular_* materials in the street model; they move along the slope as one piece.
 */
type State = 'waiting' | 'running' | 'parked';

export class Funicular {
  readonly box: MovingObstacle;
  /** Set when the bell should ring (the caller plays it and clears it). */
  bell = false;
  private readonly meshes: { mesh: Object3D; base: Vector3; toLocal: Matrix3 }[] = [];
  private readonly authoredZ: number;
  private readonly startZ: number;
  private state: State = 'waiting';
  private blockedFor = 0;
  private readonly speed = 3;

  constructor(
    street: Object3D,
    private readonly layout: GameplayLayout['funicular']
  ) {
    street.updateMatrixWorld(true);
    street.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some((material) => material.name.startsWith('funicular'))) return;
      // Compressed meshes sit under a scaled (dequantising) parent, so a world offset is converted into its space.
      const parentInverse = new Matrix4().copy(object.parent?.matrixWorld ?? new Matrix4()).invert();
      this.meshes.push({ mesh: object, base: object.position.clone(), toLocal: new Matrix3().setFromMatrix4(parentInverse) });
    });
    this.authoredZ = layout.centreZ;
    this.startZ = layout.maxZ;
    this.box = { x: 0, z: this.startZ, halfX: layout.halfWidth, halfZ: layout.length / 2, vz: 0 };
    this.place();
  }

  get found(): boolean {
    return this.meshes.length > 0;
  }

  /** Sets off down the hill (when the run starts). */
  depart(): void {
    if (this.state !== 'waiting') return;
    this.state = 'running';
    this.bell = true;
  }

  reset(): void {
    this.state = 'waiting';
    this.box.z = this.startZ;
    this.box.vz = 0;
    this.place();
  }

  update(dt: number, carX: number, carZ: number, carHalfWidth: number, carHalfLength: number): void {
    this.box.vz = 0;
    if (this.state !== 'running') return;
    // Stop for a car that is in front of it (downhill, toward -z).
    const ahead = this.box.z - carZ;
    const inLane = Math.abs(carX) < this.box.halfX + carHalfWidth + 0.2;
    if (inLane && ahead > 0 && ahead < this.box.halfZ + carHalfLength + 1.0) {
      if (this.blockedFor <= 0) this.bell = true;
      this.blockedFor += dt;
      if (this.blockedFor > 3) this.blockedFor = 0;
      return;
    }
    this.blockedFor = 0;
    this.box.vz = -this.speed;
    this.box.z += this.box.vz * dt;
    if (this.box.z <= this.layout.minZ) {
      this.box.z = this.layout.minZ;
      this.box.vz = 0;
      this.state = 'parked';
    }
    this.place();
  }

  private place(): void {
    // Moving by dz along the street also moves it by slope * dz in height (the street rises toward +z).
    const dz = this.box.z - this.authoredZ;
    const offset = new Vector3();
    for (const { mesh, base, toLocal } of this.meshes) {
      mesh.position.copy(base).add(offset.set(0, dz * this.layout.slope, dz).applyMatrix3(toLocal));
    }
  }
}
