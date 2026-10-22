/**
 * Spike options, read once from the URL so every run is reproducible from its link.
 *
 *   ?renderer=webgpu      WebGPURenderer, WebGPU backend when available (auto WebGL 2 fallback)
 *   ?renderer=webgpu-gl2  WebGPURenderer with forceWebGL: true (its WebGL 2 backend)
 *   ?renderer=webgl       classic WebGLRenderer + EffectComposer (stable WebGL 2 route)
 *   ?shadows=0 ?ao=0 ?bloom=0 ?dof=0 ?aa=0   switch single effects off to isolate their cost
 *   ?dpr=1.5              device pixel ratio cap (default 1.5)
 *   ?density=1            prop density multiplier (default 1)
 *   ?bench=60             run the scripted benchmark for N seconds after warm-up
 *   ?fallback=<reason>    set automatically when the WebGPU route failed and the page reloaded on WebGL 2
 */

export type RendererRoute = 'webgpu' | 'webgpu-gl2' | 'webgl';

export interface EffectFlags {
  shadows: boolean;
  ao: boolean;
  bloom: boolean;
  dof: boolean;
  aa: boolean;
}

export interface SpikeOptions {
  route: RendererRoute;
  effects: EffectFlags;
  dprCap: number;
  density: number;
  benchSeconds: number | null;
  /** Why an earlier WebGPU attempt failed, if this run is an automatic WebGL 2 fallback. */
  fallbackReason: string | null;
}

const ROUTES: readonly RendererRoute[] = ['webgpu', 'webgpu-gl2', 'webgl'];

export function readOptions(search: string = window.location.search): SpikeOptions {
  const params = new URLSearchParams(search);
  const route = params.get('renderer');
  const flag = (name: string): boolean => params.get(name) !== '0';
  const number = (name: string, fallback: number, min: number, max: number): number => {
    const value = Number(params.get(name));
    return Number.isFinite(value) && params.has(name) ? Math.min(max, Math.max(min, value)) : fallback;
  };

  return {
    route: ROUTES.includes(route as RendererRoute) ? (route as RendererRoute) : 'webgpu',
    effects: {
      shadows: flag('shadows'),
      ao: flag('ao'),
      bloom: flag('bloom'),
      dof: flag('dof'),
      aa: flag('aa')
    },
    dprCap: number('dpr', 1.5, 0.5, 3),
    density: number('density', 1, 0.25, 4),
    benchSeconds: params.has('bench') ? number('bench', 60, 1, 600) : null,
    fallbackReason: params.get('fallback')
  };
}

export function optionsToSearch(options: SpikeOptions): string {
  const params = new URLSearchParams();
  params.set('renderer', options.route);
  for (const [name, enabled] of Object.entries(options.effects)) {
    if (!enabled) params.set(name, '0');
  }
  if (options.dprCap !== 1.5) params.set('dpr', String(options.dprCap));
  if (options.density !== 1) params.set('density', String(options.density));
  if (options.benchSeconds !== null) params.set('bench', String(options.benchSeconds));
  if (options.fallbackReason) params.set('fallback', options.fallbackReason);
  return `?${params.toString()}`;
}
