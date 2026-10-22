import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, Vector3 } from 'three';
import { PROOF_LOOK } from './look';

/**
 * Painted late-afternoon sky as an equirectangular canvas, used both as the background and as the
 * (weak) reflection environment, so glossy paint and glass pick up the same warm sky the scene shows.
 */
export function createSkyTexture(sunDirection: Vector3): CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable for the sky');

  const { sky } = PROOF_LOOK;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, sky.zenith);
  gradient.addColorStop(0.32, sky.upper);
  gradient.addColorStop(0.47, sky.horizon);
  gradient.addColorStop(0.5, sky.horizonGlow);
  gradient.addColorStop(0.56, sky.below);
  gradient.addColorStop(1, sky.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // Equirect coordinates of the sun, matching three's EquirectangularReflectionMapping.
  const azimuth = Math.atan2(sunDirection.x, -sunDirection.z);
  const sunX = (0.5 + azimuth / (2 * Math.PI)) * width;
  const sunY = (0.5 - Math.asin(sunDirection.y) / Math.PI) * height;
  for (const offset of [-width, 0, width]) {
    const glow = context.createRadialGradient(sunX + offset, sunY, 0, sunX + offset, sunY, height * 0.42);
    glow.addColorStop(0, sky.sunCore);
    glow.addColorStop(0.05, sky.sunHalo);
    glow.addColorStop(1, 'rgba(255, 214, 160, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  }

  paintClouds(context, width, height, sunX);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft, flat-bottomed cumulus bands near the horizon, lit from the sun side. Deterministic. */
function paintClouds(context: CanvasRenderingContext2D, width: number, height: number, sunX: number): void {
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < 34; index++) {
    const x = random() * width;
    const y = height * (0.3 + random() * 0.16);
    const scale = 40 + random() * 110;
    const towardSun = 1 - Math.min(1, Math.abs(x - sunX) / (width * 0.35));
    for (let puff = 0; puff < 7; puff++) {
      const px = x + (random() - 0.5) * scale * 2.6;
      const py = y - random() * scale * 0.45;
      const radius = scale * (0.35 + random() * 0.4);
      const gradient = context.createRadialGradient(px, py - radius * 0.3, 0, px, py, radius);
      const light = 0.22 + towardSun * 0.3;
      gradient.addColorStop(0, `rgba(255, 228, 196, ${light})`);
      gradient.addColorStop(0.6, `rgba(232, 190, 170, ${light * 0.55})`);
      gradient.addColorStop(1, 'rgba(232, 190, 170, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(px, py, radius * 1.5, radius * 0.6, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
}
