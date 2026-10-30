import { it, expect } from 'vitest';
import { freshSave, getStats, upgradeValues } from '../../src/game/data';
import { GameCore } from '../../src/game/core';

it.each([0, 1, 2, 3, 4])(
  'reduces battery capacity by three at upgrade %i, including launch and refill',
  (level) => {
    const save = freshSave();
    save.upgrades.Battery = level;
    const capacity = upgradeValues('Battery').Value[level] / 3;
    expect(getStats(save.upgrades).battery).toBe(capacity);
    const game = new GameCore(save);
    game.launch();
    expect(game.battery).toBe(capacity);
    game.battery = 0;
    game.returnToBase('battery');
    for (let i = 0; i < 160; i++) game.step(1 / 60, { throttle: false, brake: false, aim: false });
    expect(game.battery).toBe(capacity);
  },
);
