import { it, expect } from 'vitest';
import { GameCore } from '../../src/game/core';
import { freshSave } from '../../src/game/data';
import { closestOnPath, alongPath, sub, norm, dist, clamp } from '../../src/game/math';

it('can physically swim all five stages, on both fork sides, with stock handling and replenished energy', () => {
  for (const side of ['left', 'right'])
    for (let level = 0; level < 5; level++) {
      const save = freshSave();
      save.level = level;
      const game = new GameCore(save);
      game.launch();
      const routes = game.layout.routes.filter(
        (r) =>
          r.kind === 'shaft' || r.kind === side || r.kind === 'connector' || r.kind === 'finish',
      );
      let routeIndex = 0,
        steps = 0;
      while (game.phase === 'dive' && game.save.level === level && steps++ < 60 * 300) {
        let route = routes[routeIndex];
        let near = closestOnPath(game.position, route.path, route.lengths);
        if (routeIndex < routes.length - 1 && near.along > route.length - 6) {
          route = routes[++routeIndex];
          near = closestOnPath(game.position, route.path, route.lengths);
        }
        const aim = norm(sub(alongPath(route.path, route.lengths, near.along + 8), game.position));
        const yawError = Math.atan2(
          Math.sin(Math.atan2(aim.x, aim.z) - game.yaw),
          Math.cos(Math.atan2(aim.x, aim.z) - game.yaw),
        );
        const pitchError = Math.asin(aim.y) - game.pitch;
        const brake = Math.abs(yawError) > 0.75 || Math.abs(pitchError) > 0.65;
        // This is a route/collision regression, independent of the battery budget.
        game.battery = game.stats.battery;
        game.step(1 / 60, {
          throttle: !brake,
          brake,
          aim: true,
          turn: clamp(yawError * 3.5, -1, 1),
          tilt: clamp(pitchError * 3.5, -1, 1),
        });
        game.shoot();
        // Consume events just as the browser does, without accumulating per-frame history.
        game.events.splice(0);
      }
      expect({
        level,
        side,
        phase: game.phase,
        complete: game.completed,
        routeIndex,
        pair: game.pair,
        position: game.position,
        remaining: dist(game.position, game.layout.exit),
        battery: game.battery,
      }).toMatchObject({ phase: 'return', complete: true });
      expect(game.save.level).toBe(Math.min(level + 1, 4));
      expect(game.runChoices).toBeGreaterThanOrEqual(level + 2);
    }
}, 120000);
