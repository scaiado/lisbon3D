import { Color, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from 'three';
import { PROOF_LOOK } from './look';
import { createSkyTexture } from './sky';

export interface ProofLighting {
  sun: DirectionalLight;
  sunDirection: Vector3;
  /** Fits the sun's shadow box around a world-space area so texel density stays high where we look. */
  fitShadow(center: Vector3, radius: number): void;
}

/** One warm low sun, coloured sky/bounce fill, painted sky and warm haze toward the river. */
export function addProofLighting(scene: Scene, shadows: boolean): ProofLighting {
  const sunDirection = new Vector3(...PROOF_LOOK.sunDirection).normalize();
  const sky = createSkyTexture(sunDirection);
  scene.background = sky;
  scene.environment = sky;
  scene.environmentIntensity = PROOF_LOOK.environmentIntensity;
  scene.fog = new Fog(new Color(PROOF_LOOK.haze.color), PROOF_LOOK.haze.near, PROOF_LOOK.haze.far);

  scene.add(new HemisphereLight(PROOF_LOOK.hemisphereSky, PROOF_LOOK.hemisphereGround, PROOF_LOOK.hemisphereIntensity));

  const sun = new DirectionalLight(PROOF_LOOK.sunColor, PROOF_LOOK.sunIntensity);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(PROOF_LOOK.shadowMapSize, PROOF_LOOK.shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const fitShadow = (center: Vector3, radius: number): void => {
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(sunDirection, radius * 2.5);
    const camera = sun.shadow.camera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = 1;
    camera.far = radius * 5;
    camera.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  };
  fitShadow(new Vector3(0, -8, -50), 70);

  return { sun, sunDirection, fitShadow };
}
