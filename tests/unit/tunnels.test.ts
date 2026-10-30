import { describe, expect, it } from 'vitest';
import { makeLayout } from '../../src/game/layout';
import { GameCore } from '../../src/game/core';
import { cross, dist, len, sub, v } from '../../src/game/math';

describe('tunnel bends and player rockets', () => {
  it('mixes distinct turn patterns, including quarter turns, without exceeding 90 degrees', () => {
    const angles = new Set<number>();
    for (let level = 0; level < 5; level++) {
      const patterns = new Set<string>();
      for (const route of makeLayout(level).routes.filter((r) => r.kind === 'connector')) {
        const turns: number[] = [];
        let previous = 0,
          accumulated = 0;
        const finishTurn = () => {
          if (Math.abs(accumulated) > 1e-7) {
            const degrees = Math.abs((accumulated * 180) / Math.PI);
            expect(degrees).toBeLessThanOrEqual(90 + 1e-6);
            angles.add(Math.round(degrees));
            turns.push(Math.round((accumulated * 180) / Math.PI));
          }
          accumulated = 0;
        };
        for (let i = 1; i < route.path.length; i++) {
          const delta = sub(route.path[i], route.path[i - 1]);
          // A right-angle elbow can run sideways, but must not double back.
          expect(delta.z).toBeGreaterThanOrEqual(-1e-8);
          const heading = Math.atan2(delta.x, delta.z);
          const turn = Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous));
          if (Math.abs(turn) < 1e-7 || turn * accumulated < 0) finishTurn();
          accumulated += turn;
          previous = heading;
        }
        finishTurn();
        expect(previous).toBeCloseTo(0, 6);
        patterns.add(turns.map(Math.abs).join(','));
      }
      expect(patterns.size).toBeGreaterThanOrEqual(2);
    }
    expect([...angles].sort((a, b) => a - b)).toEqual([30, 45, 60, 75, 90]);
  });

  it('keeps every bend wider than the tube so its inner wall cannot fold over', () => {
    for (let level = 0; level < 5; level++) {
      for (const route of makeLayout(level).routes) {
        for (let i = 1; i < route.path.length; i++) {
          const a = sub(route.path[i], route.path[i - 1]);
          expect(len(a)).toBeGreaterThan(0.001);
          if (i === route.path.length - 1) continue;
          const b = sub(route.path[i + 1], route.path[i]);
          const c = sub(route.path[i + 1], route.path[i - 1]);
          const area = len(cross(a, b));
          if (area < 1e-8) continue;
          const radius = (len(a) * len(b) * len(c)) / (2 * area);
          expect(radius, `level ${level}, ${route.id}, point ${i}`).toBeGreaterThan(
            route.radius * 2,
          );
        }
      }
    }
  });

  it('fires outside the hull and leaves enough flight time to see the rocket', () => {
    const game = new GameCore();
    game.launch();
    game.entities = [];
    game.layout.routes = [
      {
        ...game.layout.routes[0],
        path: [v(0, -100, 0), v(0, -100, 200)],
        lengths: [0, 200],
        length: 200,
      },
    ];
    game.position = v(0, -100, 20);
    game.yaw = 0;
    game.pitch = 0;
    game.shoot();
    const rocket = game.bullets[0];
    expect(rocket.enemy).toBe(false);
    expect(dist(rocket.position, game.position)).toBeGreaterThan(3);
    const muzzle = { ...rocket.position };
    for (let i = 0; i < 30; i++) {
      game.step(1 / 60, { throttle: false, brake: false, aim: false });
    }
    expect(rocket.active).toBe(true);
    expect(dist(muzzle, rocket.position)).toBeGreaterThan(15);
    expect(dist(muzzle, rocket.position)).toBeLessThan(25);
  });
});
