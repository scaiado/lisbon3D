import { type NataRun, formatTime } from './delivery';
import type { RunEvent } from './delivery';

/** The game overlay: order card, clock and pastry condition, speed, toasts, the start card and the results card. */
export class Hud {
  private readonly order: HTMLElement;
  private readonly orderTitle: HTMLElement;
  private readonly orderDetail: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly natas: HTMLElement[];
  private readonly speed: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly start: HTMLElement;
  private readonly results: HTMLElement;
  private readonly stats: HTMLElement;
  private toastTimer = 0;

  constructor(parent: HTMLElement, clean: boolean) {
    const root = el('div', 'play-hud');
    root.hidden = clean;
    this.order = el('section', 'play-card play-order');
    this.arrow = el('span', 'play-arrow', '➤');
    this.orderTitle = el('strong');
    this.orderDetail = el('span');
    const orderText = el('div');
    orderText.append(this.orderTitle, this.orderDetail);
    this.order.append(this.arrow, orderText);

    const status = el('section', 'play-card play-status');
    this.clock = el('strong', 'play-clock', '0:00.0');
    const box = el('div', 'play-natas');
    this.natas = Array.from({ length: 6 }, () => el('i'));
    box.append(...this.natas);
    status.append(this.clock, box);

    this.speed = el('section', 'play-card play-speed', '0');
    this.stats = el('span', 'play-stats');
    this.toast = el('div', 'play-toast');
    this.start = el('section', 'play-card play-start');
    this.start.innerHTML =
      '<p class="eyebrow">Lisbon3D · playable slice</p><h1>Nata Run: the Bica</h1>' +
      '<p>Pick up a box of pastéis de nata at the bakery, then deliver them door to door down the Bica. ' +
      'Pull into each glowing bay and stop to hand over. Quick is good; careful is better.</p>' +
      '<ul><li><b>W / ↑</b> accelerate · <b>S / ↓</b> brake, reverse</li><li><b>A D / ← →</b> steer · <b>Space</b> handbrake</li>' +
      '<li><b>C</b> camera · <b>R</b> back on the road · <b>M</b> sound · gamepad works too</li></ul>' +
      '<p class="play-go">Press <b>W</b> or <b>↑</b> to drive</p>';
    this.results = el('section', 'play-card play-results');
    this.results.hidden = true;
    root.append(this.order, status, this.speed, this.stats, this.toast, this.start, this.results);
    parent.append(root);
  }

  hideStart(): void {
    this.start.hidden = true;
  }

  /** Per frame. bearing: angle (rad) from the camera's view direction to the target, for the arrow. */
  update(run: NataRun, speedMs: number, distance: number | null, bearing: number): void {
    const target = run.target;
    if (run.phase === 'finished' || !target) {
      this.order.hidden = true;
    } else {
      this.order.hidden = false;
      const pickup = run.phase === 'ready' || run.phase === 'pickup';
      this.orderTitle.textContent = pickup ? `Pick up at ${target.name}` : `${run.index + 1}/${run.total} · ${target.name}, ${target.label}`;
      this.orderDetail.textContent = distance === null ? '' : distance < 3 ? (run.handover > 0 ? 'Handing over…' : 'Stop in the bay') : `${Math.round(distance)} m`;
      this.arrow.style.transform = `rotate(${bearing - Math.PI / 2}rad)`;
    }
    this.clock.textContent = formatTime(run.clock);
    const condition = run.condition / 100;
    this.natas.forEach((nata, i) => {
      const share = Math.max(0, Math.min(1, condition * this.natas.length - i));
      nata.style.opacity = String(0.18 + 0.82 * share);
    });
    this.speed.innerHTML = `${Math.round(Math.abs(speedMs) * 3.6)}<small>km/h</small>`;
  }

  setStats(text: string): void {
    this.stats.textContent = text;
  }

  event(event: RunEvent): void {
    this.toast.className = `play-toast play-toast-${event.kind} show`;
    this.toast.innerHTML = `<strong>${event.title}</strong><span>${event.detail}</span>`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), event.kind === 'finished' ? 3500 : 2200);
  }

  showResults(run: NataRun): void {
    const s = run.summary();
    this.results.hidden = false;
    this.results.innerHTML =
      `<p class="eyebrow">Nata Run complete</p><h1>${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</h1>` +
      `<dl><dt>Time</dt><dd>${formatTime(s.seconds)}</dd><dt>Pastries</dt><dd>${Math.round(s.condition)} %</dd>` +
      `<dt>Tips</dt><dd>€${s.tips.toFixed(2)}</dd></dl>` +
      '<p>Press <b>Enter</b> to run it again, or keep driving around the Bica.</p>';
  }

  hideResults(): void {
    this.results.hidden = true;
  }
}

function el(tag: string, className = '', text = ''): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
