import { AgXToneMapping, PCFShadowMap, RenderPipeline, WebGPURenderer } from 'three/webgpu';
import {
  mrt,
  normalView,
  output,
  packNormalToRGB,
  pass,
  renderOutput,
  sample,
  uniform,
  unpackRGBToNormal,
  vec4
} from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import type { RenderRoute, RouteContext } from './types';
import { LOOK } from './look';
import { describeWebGL } from './gpuInfo';

/**
 * WebGPURenderer route. With forceWebGL it runs the same node materials and TSL post chain
 * on its WebGL 2 backend, which is what Firefox and older Safari players will get.
 */
export async function createWebGPURoute(
  context: RouteContext,
  forceWebGL: boolean
): Promise<RenderRoute> {
  const { scene, camera, effects, onFatal } = context;
  const renderer = new WebGPURenderer({ antialias: false, forceWebGL });
  await renderer.init();
  renderer.onDeviceLost = (info: { message?: string; reason?: string | null }) => {
    onFatal?.(`WebGPU device lost: ${info.reason ?? 'unknown'} ${info.message ?? ''}`.trim());
  };

  renderer.toneMapping = context.toneMapping?.mapping ?? AgXToneMapping;
  renderer.toneMappingExposure = context.toneMapping?.exposure ?? LOOK.exposure;
  renderer.shadowMap.enabled = effects.shadows;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';

  const scenePass = pass(scene, camera);
  let color = scenePass.getTextureNode('output');

  if (effects.ao) {
    scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView) }));
    const normalTexture = scenePass.getTextureNode('normal');
    const sceneNormal = sample((uv) => unpackRGBToNormal(normalTexture.sample(uv)));
    const aoPass = ao(scenePass.getTextureNode('depth'), sceneNormal, camera);
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = LOOK.aoRadius;
    const aoValue = aoPass.getTextureNode().r;
    color = vec4(color.rgb.mul(aoValue), color.a) as unknown as typeof color;
  }

  const focusDistance = uniform(LOOK.focusDistance);
  let composite = color as unknown as ReturnType<typeof vec4>;

  if (effects.dof) {
    composite = dof(composite, scenePass.getViewZNode(), focusDistance, LOOK.focalRange, LOOK.bokehScale) as unknown as typeof composite;
  }

  if (effects.bloom) {
    const bloomPass = bloom(composite, LOOK.bloomStrength, LOOK.bloomRadius, LOOK.bloomThreshold);
    composite = composite.add(bloomPass) as unknown as typeof composite;
  }

  const pipeline = new RenderPipeline(renderer);
  if (effects.aa) {
    pipeline.outputColorTransform = false;
    pipeline.outputNode = fxaa(renderOutput(composite));
  } else {
    pipeline.outputNode = composite;
  }

  return {
    route: forceWebGL ? 'webgpu-gl2' : 'webgpu',
    backend,
    canvas: renderer.domElement,
    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
    setFocusDistance(meters) {
      focusDistance.value = meters;
    },
    render() {
      renderer.info.reset();
      pipeline.render();
    },
    frameStats() {
      return { drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles };
    },
    gpuDescription() {
      return describeGPU(renderer, backend);
    },
    dispose() {
      pipeline.dispose();
      void renderer.dispose();
    }
  };
}

function describeGPU(renderer: WebGPURenderer, backend: 'webgpu' | 'webgl2'): string {
  const raw = renderer.backend as unknown as {
    adapter?: { info?: { vendor?: string; architecture?: string; device?: string; description?: string } };
    gl?: WebGL2RenderingContext;
  };
  if (backend === 'webgpu') {
    const info = raw.adapter?.info;
    if (!info) return 'WebGPU adapter (no info)';
    return ['WebGPU', info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' · ');
  }
  return raw.gl ? describeWebGL(raw.gl) : 'WebGL 2 (no context info)';
}
