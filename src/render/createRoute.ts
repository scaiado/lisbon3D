import type { RendererRoute } from '../core/options';
import type { RenderRoute, RouteContext } from './types';

/** Loads only the code for the requested route, so each route's download size can be measured on its own. */
export async function createRoute(route: RendererRoute, context: RouteContext): Promise<RenderRoute> {
  if (route === 'webgl') {
    const { createWebGLRoute } = await import('./webglRoute');
    return createWebGLRoute(context);
  }
  const { createWebGPURoute } = await import('./webgpuRoute');
  return createWebGPURoute(context, route === 'webgpu-gl2');
}
