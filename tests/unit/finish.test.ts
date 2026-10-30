import { expect, it } from 'vitest';
import { GameCore } from '../../src/game/core';
import { freshSave } from '../../src/game/data';

it.each([0, 1, 2, 3, 4])('awards the level %i diamond once, only on contact', (level) => {
  const save = freshSave();
  save.level = level;
  save.money = 37;
  const game = new GameCore(save);
  game.launch();
  game.pair = game.layout.sectors.length - 1;
  game.position = { ...game.layout.exit, z: game.layout.exit.z - 6 };
  game.finishLevel();
  expect(game.phase).toBe('dive');
  expect(save.money).toBe(37);
  game.position = { ...game.layout.exit };
  game.step(1 / 60, { throttle: false, brake: false, aim: false });
  expect(game.phase).toBe('return');
  expect(game.completedLevel).toBe(level + 1);
  expect(game.completionReward).toBe((level + 1) * 100);
  expect(save.money).toBe(37 + (level + 1) * 100);
  expect(save.won).toBe(level === 4);
  game.finishLevel();
  expect(save.money).toBe(37 + (level + 1) * 100);
});
