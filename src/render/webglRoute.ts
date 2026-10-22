import { AgXToneMapping, PCFShadowMap, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import type { RenderRoute, RouteContext } from './types';
import { LOOK } from './look';
import { describeWebGL } from './gpuInfo';

/**
 * Classic WebGLRenderer route: the stable, recommended path for pure WebGL 2 in three.js.
 * Same scene and materials; post-processing is rebuilt with EffectComposer passes.
 */
export function createWebGLRoute(context: RouteContext): RenderRoute {
  const { scene, camera, effects } = context;
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = context.toneMapping?.mapping ?? AgXToneMapping;
  renderer.toneMappingExposure = context.toneMapping?.exposure ?? LOOK.exposure;
  renderer.shadowMap.enabled = effects.shadows;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let gtao: GTAOPass | null = null;
  if (effects.ao) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: LOOK.aoRadius });
    composer.addPass(gtao);
  }

  let bokeh: BokehPass | null = null;
  if (effects.dof) {
    bokeh = new BokehPass(scene, camera, {
      focus: LOOK.focusDistance,
      aperture: LOOK.classicAperture,
      maxblur: LOOK.classicMaxBlur
    });
    composer.addPass(bokeh);
  }

  let bloom: UnrealBloomPass | null = null;
  if (effects.bloom) {
    bloom = new UnrealBloomPass(new Vector2(1, 1), LOOK.bloomStrength, LOOK.bloomRadius, LOOK.bloomThreshold);
    composer.addPass(bloom);
  }

  composer.addPass(new OutputPass());

  let fxaa: ShaderPass | null = null;
  if (effects.aa) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  }

  return {
    route: 'webgl',
    backend: 'webgl2',
    canvas: renderer.domElement,
    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      const resolution = fxaa?.material.uniforms['resolution'];
      if (resolution) resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    },
    setFocusDistance(meters) {
      const focus = bokeh?.uniforms as { focus?: { value: number } } | undefined;
      if (focus?.focus) focus.focus.value = meters;
    },
    render() {
      renderer.info.reset();
      composer.render();
    },
    frameStats() {
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    gpuDescription() {
      return describeWebGL(renderer.getContext() as WebGL2RenderingContext);
    },
    dispose() {
      composer.dispose();
      renderer.dispose();
    }
  };
}
