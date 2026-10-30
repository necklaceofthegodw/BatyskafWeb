import type { GameCore, Input } from './core';
export class Controls {
  state: Input = { throttle: false, brake: false, aim: false };
  locked = false;
  private cleanups: (() => void)[] = [];
  private held = new Set<string>();
  constructor(
    private canvas: HTMLCanvasElement,
    private game: GameCore,
    private onPause: () => void,
  ) {
    const listen = <K extends keyof DocumentEventMap>(
      name: K,
      fn: (e: DocumentEventMap[K]) => void,
    ) => {
      document.addEventListener(name, fn);
      this.cleanups.push(() => document.removeEventListener(name, fn));
    };
    listen('keydown', (e) => {
      if ((e.target as HTMLElement).matches('input, select, textarea')) return;
      if (e.code === 'Escape') {
        this.clear();
        if (game.phase === 'oasis' || game.phase === 'dive') onPause();
        return;
      }
      if (game.phase !== 'dive' && game.phase !== 'oasis') return;
      this.held.add(e.code);
      this.updateKeys();
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    listen('keyup', (e) => {
      if (e.code === 'KeyF') {
        if (this.state.aim) game.shoot();
      }
      this.held.delete(e.code);
      this.updateKeys();
    });
    listen('mousemove', (e) => {
      if (this.locked) game.look(e.movementX, e.movementY);
    });
    listen('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) {
        this.clear();
        if (game.phase === 'dive' || game.phase === 'oasis') onPause();
      }
    });
    listen('visibilitychange', () => {
      if (document.hidden) {
        this.clear();
        onPause();
      }
    });
    const blur = () => {
      this.clear();
      onPause();
    };
    window.addEventListener('blur', blur);
    this.cleanups.push(() => window.removeEventListener('blur', blur));
    const wheel = (e: WheelEvent) => {
      if (game.phase === 'dive' || game.phase === 'oasis') {
        game.zoom = Math.max(4, Math.min(14, game.zoom + e.deltaY * 0.008));
        e.preventDefault();
      }
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    this.cleanups.push(() => canvas.removeEventListener('wheel', wheel));
    const click = () => {
      if (game.phase === 'dive' || game.phase === 'oasis') void this.lock();
    };
    canvas.addEventListener('click', click);
    this.cleanups.push(() => canvas.removeEventListener('click', click));
  }
  async lock() {
    this.canvas.focus();
    try {
      await this.canvas.requestPointerLock();
    } catch {
      /* A visible click on the canvas can retry the browser's gesture requirement. */
    }
  }
  unlock() {
    this.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  clear() {
    this.held.clear();
    this.game.clearLook();
    this.state.throttle = false;
    this.state.brake = false;
    this.state.aim = false;
    this.state.turn = 0;
    this.state.tilt = 0;
  }
  private updateKeys() {
    this.state.throttle = this.held.has('KeyW');
    this.state.brake = this.held.has('Space') || this.held.has('KeyS');
    this.state.aim = this.held.has('KeyF');
    this.state.turn =
      Number(this.held.has('KeyD') || this.held.has('ArrowRight')) -
      Number(this.held.has('KeyA') || this.held.has('ArrowLeft'));
    this.state.tilt = Number(this.held.has('ArrowUp')) - Number(this.held.has('ArrowDown'));
  }
  dispose() {
    this.cleanups.forEach((f) => f());
    this.unlock();
  }
}
