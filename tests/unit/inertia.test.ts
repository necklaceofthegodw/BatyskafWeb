import { expect, it } from 'vitest';
import { GameCore } from '../../src/game/core';
import { dot, v } from '../../src/game/math';

function turning(dt: number, brake = false) {
  const game = new GameCore();
  game.start();
  game.position = v(20, 10, 0);
  game.yaw = game.pitch = 0;
  game.velocity = v(0, 0, 8);
  for (let i = 0; i < Math.round(0.6 / dt); i++)
    game.step(dt, { throttle: false, brake, aim: false, turn: 1 });
  return game;
}

it('retains outward sideways motion during a turn and lets the brake arrest it', () => {
  const game = turning(1 / 60);
  const right = v(Math.cos(game.yaw), 0, -Math.sin(game.yaw));
  expect(dot(game.velocity, right)).toBeLessThan(-2);
  const stopped = turning(1 / 60, true);
  expect(stopped.speed).toBeLessThan(game.speed * 0.1);
});

it('keeps turning inertia consistent across simulation rates', () => {
  const reference = turning(1 / 60);
  for (const dt of [1 / 30, 1 / 120]) {
    const game = turning(dt);
    expect(Math.abs(game.position.x - reference.position.x)).toBeLessThan(0.06);
    expect(Math.abs(game.position.z - reference.position.z)).toBeLessThan(0.06);
    expect(Math.abs(game.speed - reference.speed)).toBeLessThan(0.06);
  }
});
