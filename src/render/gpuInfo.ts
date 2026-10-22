/** Human-readable GPU string from a WebGL 2 context. Browsers may mask or round this value. */
export function describeWebGL(gl: WebGL2RenderingContext): string {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return `WebGL 2 · ${String(renderer)}`;
}
