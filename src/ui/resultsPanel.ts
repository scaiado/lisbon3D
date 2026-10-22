import { optionsToSearch, type SpikeOptions } from '../core/options';

/** Shows benchmark results with fields for facts the browser can't report reliably. */
export function mountResultsPanel(parent: HTMLElement, result: Record<string, unknown>, options: SpikeOptions): void {
  const panel = document.createElement('section');
  panel.className = 'panel results';
  panel.innerHTML = `
    <p class="eyebrow">Benchmark finished</p>
    <h1>Results</h1>
    <dl class="summary" data-summary></dl>
    <p class="muted">Please fill these in; browsers hide or round them.</p>
    <label class="field">Device <input name="device" value="MacBook Air M4" /></label>
    <label class="field">Browser and version <input name="browser" placeholder="e.g. Safari 26.1" /></label>
    <label class="field">macOS version <input name="os" placeholder="e.g. macOS 26.1" /></label>
    <label class="field">Power <select name="power"><option>Plugged in</option><option>Battery</option></select></label>
    <label class="field">Notes <input name="notes" placeholder="other apps open, window size, anything odd" /></label>
    <div class="row">
      <button type="button" data-copy class="primary">Copy JSON</button>
      <button type="button" data-download>Download JSON</button>
      <button type="button" data-again>Back to look test</button>
    </div>
    <p class="hint" data-status></p>
  `;

  const summary = result['summary'] as Record<string, unknown>;
  const facts: [string, unknown][] = [
    ['Renderer', `${String(result['route'])} → ${String(result['backend'])}`],
    ['Average', `${String(summary['averageFps'])} fps`],
    ['1 % low', `${String(summary['onePercentLowFps'])} fps`],
    ['Frame time p95', `${String((summary['frameMs'] as Record<string, number>)['p95'])} ms`],
    ['Hitches > 50 ms', summary['hitches']],
    ['Draw calls (avg)', (summary['drawCalls'] as Record<string, number>)['average']],
    ['Triangles (avg)', (summary['triangles'] as Record<string, number>)['average']]
  ];
  const list = panel.querySelector<HTMLElement>('[data-summary]')!;
  for (const [label, value] of facts) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = String(value);
    list.append(term, detail);
  }

  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  const json = (): string => {
    const tester: Record<string, string> = {};
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((field) => {
      tester[field.name] = field.value;
    });
    return JSON.stringify({ ...result, tester }, null, 2);
  };

  panel.querySelector('[data-copy]')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json());
      status.textContent = 'Copied. Paste it into the project thread.';
    } catch {
      status.textContent = 'Copy was blocked by the browser; use Download instead.';
    }
  });
  panel.querySelector('[data-download]')!.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json()], { type: 'application/json' }));
    link.download = `lisbon3d-bench-${String(result['route'])}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  panel.querySelector('[data-again]')!.addEventListener('click', () => {
    window.location.search = optionsToSearch({ ...options, benchSeconds: null, fallbackReason: null });
  });
  parent.append(panel);
}
