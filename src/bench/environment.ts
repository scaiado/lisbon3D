/**
 * Facts about the machine and page that make a benchmark result comparable. Browsers hide some of
 * these (macOS version, exact GPU), so the results form also asks the tester to type them in.
 */
export interface EnvironmentReport {
  userAgent: string;
  userAgentData: Record<string, unknown> | null;
  screen: { width: number; height: number };
  viewportCss: { width: number; height: number };
  devicePixelRatio: number;
  renderPixelRatio: number;
  drawingBuffer: { width: number; height: number };
  hardwareConcurrency: number | null;
  transfer: { totalKB: number; resources: number; note: string };
}

export async function collectEnvironment(canvas: HTMLCanvasElement, renderPixelRatio: number): Promise<EnvironmentReport> {
  return {
    userAgent: navigator.userAgent,
    userAgentData: await highEntropyHints(),
    screen: { width: window.screen.width, height: window.screen.height },
    viewportCss: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    renderPixelRatio,
    drawingBuffer: { width: canvas.width, height: canvas.height },
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    transfer: transferSize()
  };
}

async function highEntropyHints(): Promise<Record<string, unknown> | null> {
  const data = (navigator as Navigator & {
    userAgentData?: { getHighEntropyValues(hints: string[]): Promise<Record<string, unknown>> };
  }).userAgentData;
  if (!data) return null;
  try {
    return await data.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'model', 'fullVersionList']);
  } catch {
    return null;
  }
}

function transferSize(): EnvironmentReport['transfer'] {
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource')
  ] as PerformanceResourceTiming[];
  const bytes = entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
  return {
    totalKB: Math.round(bytes / 1024),
    resources: entries.length,
    note: 'Bytes over the network for this page load (0 for cached files). Use a hard reload for a cold number.'
  };
}
