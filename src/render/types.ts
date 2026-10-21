import type { PerspectiveCamera, Scene, ToneMapping } from 'three';
import type { EffectFlags, RendererRoute } from '../core/options';

/** What the rest of the app needs from a renderer route, independent of WebGPU or WebGL. */
export interface RenderRoute {
  readonly route: RendererRoute;
  /** Backend actually running: 'webgpu' or 'webgl2'. A WebGPU request can fall back to WebGL 2. */
  readonly backend: 'webgpu' | 'webgl2';
  readonly canvas: HTMLCanvasElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  /** Updates per-frame effect uniforms (for example the depth-of-field focus distance). */
  setFocusDistance(meters: number): void;
  render(): void;
  /** Draw calls and triangles for the last frame, post-processing passes included. */
  frameStats(): { drawCalls: number; triangles: number };
  /** GPU description as reported by the browser (may be generic or masked). */
  gpuDescription(): string;
  dispose(): void;
}

export interface RouteContext {
  scene: Scene;
  camera: PerspectiveCamera;
  effects: EffectFlags;
  /** Tone mapping and exposure; the renderer spike's AgX look when left out. */
  toneMapping?: { mapping: ToneMapping; exposure: number };
  /** Called if the GPU device is lost after start-up, so the app can fall back to WebGL 2. */
  onFatal?: (reason: string) => void;
}
