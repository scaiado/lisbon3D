/**
 * Light and colour targets for direction C (art/style-frames/STYLE-C.md), shared by both renderer routes.
 * Values are tuned by eye against the reference frame, not physically derived.
 */
export const PROOF_LOOK = {
  /** Direction toward the sun: low, ahead-right of a camera looking down the Bica (-Z) toward the river. */
  sunDirection: [0.55, 0.3, -0.78] as const,
  sunColor: '#ffd7a0',
  sunIntensity: 3.1,
  /** Blue-violet sky fill and warm ochre bounce, so shade is coloured, never grey. */
  hemisphereSky: '#7d86c4',
  hemisphereGround: '#c98a52',
  hemisphereIntensity: 1.15,
  environmentIntensity: 0.35,
  haze: { color: '#f0cfa2', near: 45, far: 900 },
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
