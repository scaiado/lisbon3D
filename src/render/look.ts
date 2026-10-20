/** Shared look values so both renderer routes are tuned to the same target image. */
export const LOOK = {
  exposure: 1.05,
  aoRadius: 0.6,
  bloomStrength: 0.18,
  bloomRadius: 0.35,
  bloomThreshold: 0.9,
  focusDistance: 9,
  /** World-space distance from the focal plane before things are fully blurred (WebGPU route). */
  focalRange: 22,
  bokehScale: 2.2,
  /** Classic BokehPass aperture, hand-matched to the WebGPU route's blur at the bench camera. */
  classicAperture: 0.0016,
  classicMaxBlur: 0.006
} as const;
