/** Collects frame times and per-frame render counts, then summarises them. */
export interface FrameSummary {
  frames: number;
  seconds: number;
  averageFps: number;
  /** Average fps over the slowest 1 % of frames. */
  onePercentLowFps: number;
  frameMs: { median: number; p95: number; p99: number; worst: number };
  drawCalls: { average: number; max: number };
  triangles: { average: number; max: number };
  /** Frames slower than 50 ms (a visible hitch). */
  hitches: number;
}

export class FrameRecorder {
  private readonly frameTimes: number[] = [];
  private drawCallSum = 0;
  private drawCallMax = 0;
  private triangleSum = 0;
  private triangleMax = 0;

  add(frameMs: number, drawCalls: number, triangles: number): void {
    this.frameTimes.push(frameMs);
    this.drawCallSum += drawCalls;
    this.drawCallMax = Math.max(this.drawCallMax, drawCalls);
    this.triangleSum += triangles;
    this.triangleMax = Math.max(this.triangleMax, triangles);
  }

  summary(): FrameSummary {
    const frames = this.frameTimes.length;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const totalMs = sorted.reduce((sum, value) => sum + value, 0);
    const at = (fraction: number): number => sorted[Math.min(frames - 1, Math.floor(fraction * frames))] ?? 0;
    const slowest = sorted.slice(Math.floor(frames * 0.99));
    const slowestAverage = slowest.reduce((sum, value) => sum + value, 0) / Math.max(1, slowest.length);
    const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

    return {
      frames,
      seconds: round(totalMs / 1000, 2),
      averageFps: round(frames / Math.max(0.001, totalMs / 1000)),
      onePercentLowFps: round(slowestAverage > 0 ? 1000 / slowestAverage : 0),
      frameMs: { median: round(at(0.5), 2), p95: round(at(0.95), 2), p99: round(at(0.99), 2), worst: round(sorted[frames - 1] ?? 0, 2) },
      drawCalls: { average: Math.round(this.drawCallSum / Math.max(1, frames)), max: this.drawCallMax },
      triangles: { average: Math.round(this.triangleSum / Math.max(1, frames)), max: this.triangleMax },
      hitches: sorted.filter((value) => value > 50).length
    };
  }
}
