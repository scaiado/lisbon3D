/**
 * Light and colour targets for direction C (art/style-frames/STYLE-C.md), shared by both renderer routes.
 * Values are tuned by eye against the reference frame, not physically derived.
 */
export const PROOF_LOOK = {
  /** Toward the sun: low (17°), ahead-right of the downhill view; same as TO_SUN in art/blender/lisbon/scene_setup.py. */
  sunDirection: [0.72, 0.306, -0.62] as const,
  sunColor: '#ffd7a0',
  sunIntensity: 3.1,
  /** Blue-violet sky fill and warm ochre bounce, so shade is coloured, never grey. */
  hemisphereSky: '#7d86c4',
  hemisphereGround: '#c98a52',
  hemisphereIntensity: 1.15,
  environmentIntensity: 0.35,
  haze: { color: '#f0cfa2', near: 60, far: 2600 },
  shadowMapSize: 4096,
  sky: {
    zenith: '#6f8fb8',
    upper: '#b9b6c8',
    horizon: '#f2cfa0',
    horizonGlow: '#ffe2b4',
    below: '#d9a878',
    ground: '#6b4a36',
    sunCore: 'rgba(255, 246, 222, 1)',
    sunHalo: 'rgba(255, 220, 160, 0.85)'
  }
} as const;
