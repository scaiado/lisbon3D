/**
 * Small synthesised soundscape, no audio files: the electric motor's whine rising with speed, tyre rumble on the
 * cobbles, thumps on knocks, a chime for each delivery and the funicular's bell. Starts on the first key press
 * (browsers only allow audio after a user gesture). M mutes.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private motor: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;
  private rumble: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  muted = false;

  start(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    const soft = ctx.createGain();
    soft.gain.value = 0.25;
    osc.connect(gain);
    osc2.connect(soft).connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    this.motor = { osc, osc2, gain };

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 2);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 0.8;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    noise.connect(filter).connect(rumbleGain).connect(this.master);
    noise.start();
    this.rumble = { gain: rumbleGain, filter };
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** Per frame: motor pitch and level from speed and throttle, cobble rumble from speed and bumpiness. */
  drive(speed: number, throttle: number, bump: number): void {
    if (!this.ctx || !this.motor || !this.rumble) return;
    const t = this.ctx.currentTime;
    const v = Math.abs(speed);
    this.motor.osc.frequency.setTargetAtTime(110 + v * 34, t, 0.08);
    this.motor.osc2.frequency.setTargetAtTime(220 + v * 68, t, 0.08);
    this.motor.gain.gain.setTargetAtTime(Math.min(0.08, 0.006 + v * 0.002 + throttle * 0.03), t, 0.1);
    this.rumble.gain.gain.setTargetAtTime(Math.min(0.5, v * 0.025 + bump * 2), t, 0.05);
    this.rumble.filter.frequency.setTargetAtTime(140 + v * 14, t, 0.1);
  }

  thump(strength: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(1.2, 0.2 + strength * 0.18), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  chime(): void {
    this.notes([[784, 0], [988, 0.09], [1319, 0.18]], 0.16, 'sine', 0.6);
  }

  bell(): void {
    this.notes([[1245, 0], [1245, 0.28]], 0.12, 'triangle', 0.9);
  }

  private notes(notes: [number, number][], level: number, type: OscillatorType, decay: number): void {
    if (!this.ctx || !this.master) return;
    for (const [frequency, delay] of notes) {
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
