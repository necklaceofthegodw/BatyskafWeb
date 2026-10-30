import { describe, expect, it } from 'vitest';
import { GameCore } from '../../src/game/core';
import { makeLayout } from '../../src/game/layout';
import { dist, v, alongPath } from '../../src/game/math';
const idle = { throttle: false, brake: false, aim: false };
const returnSteps = (g: GameCore) => {
  for (let i = 0; i < 160; i++) g.step(1 / 60, idle);
};
const reachFinish = (g: GameCore) => {
  g.position = { ...g.layout.exit };
  g.pair = g.layout.sectors.length - 1;
  g.velocity = v();
  g.step(1 / 60, idle);
};

describe('finite five-level campaign', () => {
  it('zeros the depth gauge for every dive and every level', () => {
    const g = new GameCore();
    for (let level = 0; level < 5; level++) {
      g.save.level = level;
      g.launch();
      expect(g.depth).toBe(0);
      g.position.y -= 10;
      expect(g.depth).toBe(180);
      g.returnToBase();
      returnSteps(g);
      expect(g.depth).toBe(0);
      g.launch();
      expect(g.depth).toBe(0);
      g.position.y += 5;
      expect(g.depth).toBe(0);
    }
  });
  it('has 4/6/8/10/12 playable fragments and one additional final fragment per level', () => {
    for (let level = 0; level < 5; level++) {
      const layout = makeLayout(level);
      expect(layout.fragments).toHaveLength([4, 6, 8, 10, 12][level]);
      expect(layout.routes.filter((r) => r.kind === 'finish')).toHaveLength(1);
      const finish = layout.routes.at(-1)!;
      expect(finish.kind).toBe('finish');
      expect(dist(finish.path[0], layout.sectors.at(-1)!.end)).toBeLessThan(1e-8);
      expect(finish.length).toBeGreaterThan(30);
      expect(layout.spawns.some((e) => e.route === finish.id)).toBe(false);
      for (const fragment of layout.fragments) {
        expect(fragment.routeIds).toHaveLength(fragment.kind === 'fork' ? 2 : 1);
        expect(fragment.routeIds.every((id) => layout.routes.some((r) => r.id === id))).toBe(true);
      }
      for (const route of layout.routes)
        for (let i = 1; i < route.path.length; i++)
          expect(route.path[i].y).toBeLessThanOrEqual(route.path[i - 1].y + 1e-8);
      expect(layout.entry).toEqual(v(0, -19, 0));
    }
  });
  it('does not complete the level at the last ordinary fragment or the start of the final fragment', () => {
    const g = new GameCore();
    g.launch();
    g.entities = [];
    g.pair = g.layout.sectors.length - 1;
    for (const pos of [
      g.layout.sectors.at(-1)!.end,
      alongPath(g.layout.routes.at(-1)!.path, g.layout.routes.at(-1)!.lengths, 12),
    ]) {
      g.position = { ...pos };
      g.step(1 / 60, idle);
      g.finishLevel();
      expect(g.phase).toBe('dive');
      expect(g.save.level).toBe(0);
    }
    reachFinish(g);
    expect(g.phase).toBe('return');
    expect(g.completed).toBe(true);
  });
  it('returns to the surface and announces each next level, then wins once after the fifth', () => {
    const g = new GameCore();
    g.save.money = 321;
    for (let level = 0; level < 5; level++) {
      g.launch();
      g.cargo = [1, 2];
      g.runLoot = 42;
      reachFinish(g);
      g.finishLevel();
      expect(g.phase).toBe('return');
      expect(g.save.level).toBe(Math.min(level + 1, 4));
      expect(g.completedLevel).toBe(level + 1);
      expect(g.cargo).toEqual([1, 2]);
      returnSteps(g);
      expect(g.depth).toBe(0);
      expect(g.phase).toBe(level === 4 ? 'won' : 'stageComplete');
      expect(g.save.money).toBe(321 + (((level + 1) * (level + 2)) / 2) * 100);
      expect(g.runLoot).toBe(42);
    }
    const runs = g.save.runs;
    g.launch();
    expect(g.phase).toBe('won');
    expect(g.save.runs).toBe(runs);
    const restored = new GameCore(structuredClone(g.save));
    restored.start();
    expect(restored.phase).toBe('won');
  });
  it('manual and energy returns never advance an unfinished level, including after reload', () => {
    const g = new GameCore();
    g.launch();
    reachFinish(g);
    returnSteps(g);
    g.launch();
    for (const reason of ['manual', 'battery'] as const) {
      if (reason === 'manual') g.returnToBase();
      else {
        g.battery = 0;
        g.step(1 / 60, idle);
      }
      returnSteps(g);
      expect(g.phase).toBe('oasis');
      expect(g.save.level).toBe(1);
      g.launch();
      expect(g.position).toEqual(v(0, -19, 0));
    }
    const restored = new GameCore(structuredClone(g.save));
    restored.start();
    restored.launch();
    expect(restored.layout.fragments).toHaveLength(6);
    expect(restored.position).toEqual(v(0, -19, 0));
  });
});
