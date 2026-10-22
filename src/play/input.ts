import type { DriveInput } from './vehicle';

/**
 * Keyboard (WASD or arrows, Space handbrake) and gamepad (triggers, left stick, A handbrake). Keyboard steering is
 * digital; the vehicle smooths it. One-shot actions (reset, camera, mute) are read with take().
 */
export type Action = 'reset' | 'camera' | 'mute' | 'restart';

export class Controls {
  private readonly held = new Set<string>();
  private readonly pending: Action[] = [];
  /** True once any control has been touched (audio needs a user gesture). */
  touched = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.touched = true;
      this.held.add(event.code);
      const action = ({ KeyR: 'reset', KeyC: 'camera', KeyM: 'mute', Enter: 'restart' } as Record<string, Action>)[event.code];
      if (action) this.pending.push(action);
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    });
    target.addEventListener('keyup', (event) => this.held.delete(event.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  take(): Action[] {
    return this.pending.splice(0);
  }

  read(): DriveInput {
    const key = (...codes: string[]): number => (codes.some((code) => this.held.has(code)) ? 1 : 0);
    const input: DriveInput = {
      throttle: key('KeyW', 'ArrowUp'),
      brake: key('KeyS', 'ArrowDown'),
      steer: key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft'),
      handbrake: key('Space') > 0
    };
    const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected);
    if (pad) {
      const trigger = (index: number): number => pad.buttons[index]?.value ?? 0;
      const stick = pad.axes[0] ?? 0;
      const steer = Math.abs(stick) > 0.12 ? Math.sign(stick) * ((Math.abs(stick) - 0.12) / 0.88) ** 1.4 : 0;
      if (trigger(7) > 0.05 || trigger(6) > 0.05 || steer !== 0 || pad.buttons[0]?.pressed) this.touched = true;
      input.throttle = Math.max(input.throttle, trigger(7));
      input.brake = Math.max(input.brake, trigger(6));
      input.steer = Math.abs(steer) > Math.abs(input.steer) ? steer : input.steer;
      input.handbrake ||= Boolean(pad.buttons[0]?.pressed);
    }
    return input;
  }
}
