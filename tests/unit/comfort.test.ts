import { describe, it, expect } from 'vitest';
import { GameCore } from '../../src/game/core';
import { direction, dot, norm, v } from '../../src/game/math';

const idle = { throttle: false, brake: false, aim: false };
describe('comfortable piloting', () => {
  it('smooths mouse input and reduces the same movement to a small turn', () => {
    const game = new GameCore();
    game.start();
    const yaw = game.yaw;
    game.look(100, 0);
    expect(game.yaw).toBe(yaw);
    game.step(1 / 60, idle);
    expect(game.yaw - yaw).toBeGreaterThan(0);
    expect(game.yaw - yaw).toBeLessThan(0.02);
    for (let i = 0; i < 60; i++) game.step(1 / 60, idle);
    expect(game.yaw - yaw).toBeCloseTo(0.095, 4);
  });
  it('caps a pointer-lock spike and discards queued turning on pause', () => {
    const game = new GameCore();
    game.start();
    const yaw = game.yaw;
    game.look(20000, -20000);
    game.step(1 / 60, idle);
    expect(game.yaw - yaw).toBeLessThanOrEqual(1.15 / 60 + 1e-9);
    game.pause();
    game.resume();
    const stopped = game.yaw;
    for (let i = 0; i < 60; i++) game.step(1 / 60, idle);
    expect(game.yaw).toBe(stopped);
  });
  it('steers the hull with the keyboard while retaining momentum through a turn', () => {
    const game = new GameCore();
    game.start();
    game.yaw = 0;
    game.pitch = 0;
    for (let i = 0; i < 60; i++) game.step(1 / 60, { ...idle, turn: 1, tilt: 1 });
    expect(game.yaw).toBeCloseTo(1.05, 5);
    expect(game.pitch).toBeCloseTo(0.75, 5);
    game.yaw = Math.PI / 2;
    game.pitch = 0;
    game.velocity = v(0, 0, 8);
    for (let i = 0; i < 45; i++) game.step(1 / 60, { ...idle, throttle: true });
    const alignment = dot(norm(game.velocity), direction(game.yaw, game.pitch));
    expect(alignment).toBeLessThan(0.95);
    expect(alignment).toBeGreaterThan(0.5);
    expect(game.velocity.z).toBeGreaterThan(2);
  });
  it('still blocks a closed disc near the outer edge of a wider tunnel', () => {
    const game = new GameCore();
    game.launch();
    const disc = game.entities.find((e) => e.kind === 'disc')!;
    expect(disc).toBeDefined();
    game.layout.routes = [
      {
        id: disc.route,
        kind: 'connector',
        pair: 0,
        radius: 10,
        path: [v(), v(0, 0, 100)],
        lengths: [0, 100],
        length: 100,
      },
    ];
    game.layout.sectors[0].end = v(0, 0, 100);
    game.entities = [
      {
        ...disc,
        position: v(0, 0, 20),
        origin: v(0, 0, 20),
        forward: v(0, 0, 1),
        radius: 9.6,
        age: 4,
        variant: 0,
      },
    ];
    game.position = v(8, 0, 19.99);
    game.velocity = v(0, 0, 2);
    game.yaw = 0;
    game.pitch = 0;
    game.step(1 / 60, idle);
    expect(game.entities[0].active).toBe(true);
    expect(game.position.z).toBeLessThan(20);
  });
});
