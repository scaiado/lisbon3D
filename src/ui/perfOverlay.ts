/** Small always-available performance readout. Toggle with ` (backquote) or F3. */
export class PerfOverlay {
  readonly element: HTMLElement;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  constructor(parent: HTMLElement, private readonly header: string) {
    this.element = document.createElement('div');
    this.element.className = 'perf';
    this.element.setAttribute('aria-live', 'off');
    parent.append(this.element);
    window.addEventListener('keydown', (event) => {
      if (event.key === '`' || event.key === 'F3') {
        event.preventDefault();
        this.element.hidden = !this.element.hidden;
      }
    });
  }

  /** Call once per frame; the text refreshes four times a second to keep DOM work negligible. */
  update(frameMs: number, drawCalls: number, triangles: number): void {
    this.frames++;
    this.elapsed += frameMs;
    this.worst = Math.max(this.worst, frameMs);
    if (this.elapsed < 250 || this.element.hidden) return;
    const fps = (this.frames * 1000) / this.elapsed;
    this.element.textContent =
      `${this.header}\n${fps.toFixed(0)} fps · ${(this.elapsed / this.frames).toFixed(1)} ms avg · ${this.worst.toFixed(1)} ms worst\n` +
      `${drawCalls} draw calls · ${(triangles / 1000).toFixed(0)}k triangles`;
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }
}
