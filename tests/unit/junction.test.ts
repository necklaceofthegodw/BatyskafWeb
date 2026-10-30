import { it, expect } from 'vitest';
import { GameCore } from '../../src/game/core';
import { v, add } from '../../src/game/math';

it.each([-8.4, 8.4])(
  'advances past fragment six of level five near the wall at x offset %i',
  (offset) => {
    const game = new GameCore();
    game.save.level = 4;
    game.launch();
    game.entities = [];
    game.pair = 2;
    game.position = add(game.layout.sectors[2].end, v(offset, 0, -2));
    game.yaw = game.pitch = 0;
    game.velocity = v(0, 0, 8);
    for (let i = 0; i < 60; i++) game.step(1 / 60, { throttle: false, brake: false, aim: false });
    expect(game.pair).toBe(3);
  },
);
