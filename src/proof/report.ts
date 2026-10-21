import { FrameRecorder, type FrameSummary } from '../bench/frameStats';
import { collectEnvironment, type EnvironmentReport } from '../bench/environment';
import type { RenderRoute } from '../render/types';
import { PROOF_VIEWS, type ProofView } from './views';

/**
 * ?report=1: frame-rate measurement of the proof on real hardware (the M4). Each review view is held for a
 * warm-up and then recorded for a fixed time. The results are shown on the page as copyable JSON, and each view
 * is also sent as a GET to ./__perf?…, so a plain static server (python3 -m http.server) logs the numbers
 * even if nobody copies them. The 404 that request gets is expected.
 */
export interface ViewResult {
  view: ProofView;
  summary: FrameSummary;
}

export interface ProofReport {
  version: string;
  backend: string;
  gpu: string;
  environment: EnvironmentReport;
  warmupSeconds: number;
  recordSeconds: number;
  views: ViewResult[];
}

export interface ReportRun {
  /** Called once per frame with the time since the previous frame. Returns false when the run has finished. */
  frame(frameMs: number): boolean;
}

export function startReport(
  route: RenderRoute,
  pixelRatio: number,
  show: (view: ProofView) => void,
  done: (report: ProofReport) => void,
  params: URLSearchParams
): ReportRun {
  const warmupMs = Number(params.get('warmup') ?? 3) * 1000;
  const recordMs = Number(params.get('seconds') ?? 10) * 1000;
  const views = PROOF_VIEWS;
  const results: ViewResult[] = [];
  let index = 0;
  let elapsed = 0;
  let recorder = new FrameRecorder();
  let finished = false;
  show(views[0]!);

  const finishView = (): void => {
    const view = views[index]!;
    const summary = recorder.summary();
    results.push({ view, summary });
    const query = new URLSearchParams({
      view,
      fps: String(summary.averageFps),
      low1: String(summary.onePercentLowFps),
      p95ms: String(summary.frameMs.p95),
      draws: String(summary.drawCalls.average),
      tris: String(summary.triangles.average),
      gpu: route.gpuDescription()
    });
    void fetch(`./__perf?${query.toString()}`).catch(() => undefined);
  };

  return {
    frame(frameMs) {
      if (finished) return false;
      elapsed += frameMs;
      if (elapsed > warmupMs) {
        const stats = route.frameStats();
        recorder.add(frameMs, stats.drawCalls, stats.triangles);
      }
      if (elapsed < warmupMs + recordMs) return true;
      finishView();
      index++;
      if (index < views.length) {
        elapsed = 0;
        recorder = new FrameRecorder();
        show(views[index]!);
        return true;
      }
      finished = true;
      void collectEnvironment(route.canvas, pixelRatio).then((environment) =>
        done({
          version: __APP_VERSION__,
          backend: route.backend,
          gpu: route.gpuDescription(),
          environment,
          warmupSeconds: warmupMs / 1000,
          recordSeconds: recordMs / 1000,
          views: results
        })
      );
      return false;
    }
  };
}

/** Shows the finished report as a short table plus the full JSON with a copy button. */
export function showReport(parent: HTMLElement, report: ProofReport): void {
  const panel = document.createElement('section');
  panel.className = 'panel proof-report';
  const heading = document.createElement('h1');
  heading.textContent = 'Proof frame-rate report';
  const lines = report.views.map(
    ({ view, summary: s }) =>
      `${view.padEnd(10)} ${String(s.averageFps).padStart(6)} fps avg · ${String(s.onePercentLowFps).padStart(5)} 1% low · p95 ${s.frameMs.p95} ms · ${s.drawCalls.average} draws · ${(s.triangles.average / 1e6).toFixed(2)} M tris`
  );
  const table = document.createElement('pre');
  table.textContent = `${report.gpu}\n${report.environment.drawingBuffer.width}×${report.environment.drawingBuffer.height} px\n\n${lines.join('\n')}`;
  const json = JSON.stringify(report, null, 2);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy JSON';
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(json).then(() => (copy.textContent = 'Copied'));
  });
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Full JSON';
  const full = document.createElement('pre');
  full.textContent = json;
  details.append(summary, full);
  panel.append(heading, table, copy, details);
  parent.append(panel);
  document.body.dataset['report'] = 'done';
  window.__lisbonProof = { ...window.__lisbonProof, report };
}
