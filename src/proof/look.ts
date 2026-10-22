/**
 * Light and colour targets for direction C (art/style-frames/STYLE-C.md), shared by both renderer routes.
 * Values are tuned by eye against the reference frame, not physically derived.
 */
import { ACESFilmicToneMapping } from 'three';

export const PROOF_LOOK = {
  /** ACES keeps the saturated storybook colour of direction C; AgX (the spike's choice) washed it out. */
  toneMapping: { mapping: ACESFilmicToneMapping, exposure: 0.95 },
  /**
   * Toward the sun: 34° up over the river, almost straight down the street (as in the style frame), so light runs
   * down the 6 m wide Bica and grazes the left-hand façades. Any real sideways component puts the whole street in
   * the shade of the right-hand houses. Same as TO_SUN in art/blender/lisbon/scene_setup.py.
   */
  sunDirection: [0.100, 0.559, -0.823] as const,
  sunColor: '#ffd29a',
  sunIntensity: 4.6,
  /**
   * Cool blue-violet sky fill against the warm sun (the reference frame's shade colour), with only a muted
   * bounce from the ground, so shade reads as cool lilac, never grey or orange. The painted sky's warm horizon
   * also lights the scene through the environment, so that stays low.
   */
  hemisphereSky: '#6d70d0',
  hemisphereGround: '#9c7a72',
  hemisphereIntensity: 1.05,
  environmentIntensity: 0.22,
  /** Cool multiply on the painted far shore and bridge so they separate from the warm horizon haze. */
  cardTint: '#c9bdd0',
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
