import { optionsToSearch, type EffectFlags, type RendererRoute, type SpikeOptions } from '../core/options';

const ROUTE_LABELS: Record<RendererRoute, string> = {
  webgpu: 'WebGPURenderer (WebGPU, auto fallback)',
  'webgpu-gl2': 'WebGPURenderer, forced WebGL 2',
  webgl: 'WebGLRenderer (classic WebGL 2)'
};

const EFFECT_LABELS: Record<keyof EffectFlags, string> = {
  shadows: 'Shadows',
  ao: 'Ambient occlusion',
  bloom: 'Bloom',
  dof: 'Depth of field',
  aa: 'FXAA'
};

/** Spike controls. Every change reloads the page so each configuration starts from a clean renderer. */
export function mountControlPanel(parent: HTMLElement, options: SpikeOptions, backendLabel: string): void {
  const panel = document.createElement('form');
  panel.className = 'panel controls';
  panel.innerHTML = `
    <p class="eyebrow">Lisbon3D · renderer spike</p>
    <h1>Look test</h1>
    <p class="muted">Running: <strong data-backend-label></strong></p>
    <label class="field">Renderer
      <select name="renderer">${Object.entries(ROUTE_LABELS)
        .map(([value, label]) => `<option value="${value}" ${value === options.route ? 'selected' : ''}>${label}</option>`)
        .join('')}</select>
    </label>
    <fieldset class="effects">${Object.entries(EFFECT_LABELS)
      .map(([name, label]) => `<label><input type="checkbox" name="${name}" ${options.effects[name as keyof EffectFlags] ? 'checked' : ''}/> ${label}</label>`)
      .join('')}</fieldset>
    <div class="row">
      <button type="submit">Apply</button>
      <button type="button" data-bench class="primary">Run 60 s benchmark</button>
    </div>
    <p class="hint">Hide this panel and the readout: <kbd>H</kbd> / <kbd>\`</kbd></p>
  `;
  panel.querySelector<HTMLElement>('[data-backend-label]')!.textContent = backendLabel;

  const next = (bench: number | null): string => {
    const data = new FormData(panel);
    const effects = Object.fromEntries(Object.keys(EFFECT_LABELS).map((name) => [name, data.get(name) === 'on'])) as unknown as EffectFlags;
    return optionsToSearch({ ...options, route: data.get('renderer') as RendererRoute, effects, benchSeconds: bench, fallbackReason: null });
  };
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    window.location.search = next(null);
  });
  panel.querySelector('[data-bench]')!.addEventListener('click', () => {
    window.location.search = next(60);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'h' || event.key === 'H') panel.hidden = !panel.hidden;
  });
  parent.append(panel);
}
