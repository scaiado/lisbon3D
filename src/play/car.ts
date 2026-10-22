import { Box3, Mesh, type Material, MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import type { CarSpec, Vehicle } from './vehicle';

/**
 * The player car's model: reads its dimensions from the model itself (bounding box, and the wheel_* nodes when the
 * export has them), spins and steers the wheels, and lights the brake and reverse lamps.
 */
export class CarModel {
  readonly spec: CarSpec;
  private readonly wheels: { node: Object3D; front: boolean }[] = [];
  private readonly brakeLamps: MeshStandardMaterial[] = [];
  private readonly reverseLamps: MeshStandardMaterial[] = [];

  constructor(readonly root: Object3D) {
    root.rotation.order = 'YXZ';
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      const name = object.name.toLowerCase();
      if (/^wheel_?[fr][lr]$/.test(name)) this.wheels.push({ node: object, front: name.replace('_', '')[5] === 'f' });
      if (object instanceof Mesh) {
        for (const material of materials(object)) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          if (material.name === 'car_brake' || material.name === 'car_tail') this.brakeLamps.push(material);
          if (material.name === 'car_reverse') this.reverseLamps.push(material);
        }
      }
    });
    for (const { node } of this.wheels) node.rotation.order = 'YXZ';
    this.spec = this.measure();
  }

  private measure(): CarSpec {
    const box = new Box3().setFromObject(this.root);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const length = size.z;
    const width = Math.min(size.x, 2.0);
    if (this.wheels.length === 4) {
      const positions = this.wheels.map(({ node }) => node.getWorldPosition(new Vector3()));
      const zs = positions.map((p) => p.z);
      const xs = positions.map((p) => Math.abs(p.x));
      const wheelBox = new Box3().setFromObject(this.wheels[0]!.node);
      return {
        wheelbase: Math.max(...zs) - Math.min(...zs),
        track: (xs.reduce((a, b) => a + b, 0) / 4) * 2,
        wheelRadius: wheelBox.getSize(new Vector3()).y / 2,
        length,
        width,
        centreOffset: -centre.z
      };
    }
    // No wheel nodes (older exports): typical small-car proportions from the body.
    return { wheelbase: length * 0.58, track: width * 0.85, wheelRadius: 0.31, length, width, centreOffset: -centre.z };
  }

  update(car: Vehicle): void {
    this.root.position.set(car.x, car.y, car.z);
    this.root.rotation.set(car.pitch, car.yaw, car.roll);
    for (const { node, front } of this.wheels) node.rotation.set(-car.wheelSpin, front ? -car.steer : 0, 0);
    for (const lamp of this.brakeLamps) lamp.emissiveIntensity = car.braking ? 6 : 1;
    for (const lamp of this.reverseLamps) lamp.emissiveIntensity = car.reversing ? 4 : 0;
  }
}

function materials(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}
