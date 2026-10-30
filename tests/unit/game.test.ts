import { describe, it, expect } from 'vitest';
import { GameCore } from '../../src/game/core';
import { freshSave, validateSave, getStats, campaign } from '../../src/game/data';
import { makeLayout } from '../../src/game/layout';
import { dist, v, sub, norm, closestOnPath, direction } from '../../src/game/math';

const idle = { throttle: false, brake: false, aim: false };
describe('campaign and progression', () => {
  it('preserves all five source module sequences and deterministic spawns', () => {
    expect(campaign.map((l) => l.pairs.length)).toEqual([2, 3, 4, 5, 6]);
    for (let i = 0; i < 5; i++) {
      const a = makeLayout(i),
        b = makeLayout(i);
      expect(a.spawns).toEqual(b.spawns);
      expect(a.sectors).toHaveLength(i + 2);
      for (let p = 0; p < a.sectors.length; p++) {
        const routes = a.routes.filter(
          (r) => r.pair === p && r.kind !== 'shaft' && r.kind !== 'finish',
        );
        expect(routes).toHaveLength(3);
        const [left, right, connector] = routes;
        expect(dist(left.path[0], right.path[0])).toBeLessThan(0.001);
        expect(dist(left.path.at(-1)!, connector.path[0])).toBeLessThan(0.001);
        expect(dist(right.path.at(-1)!, connector.path[0])).toBeLessThan(0.001);
        if (p) expect(dist(a.sectors[p - 1].end, left.path[0])).toBeLessThan(0.001);
      }
    }
  });
  it('only completion advances a stage; energy failure preserves purchases and money', () => {
    const save = freshSave();
    save.money = 50;
    save.upgrades.Battery = 2;
    const game = new GameCore(save);
    game.launch();
    game.returnToBase('battery');
    for (let i = 0; i < 160; i++) game.step(1 / 60, idle);
    expect(game.phase).toBe('oasis');
    expect(game.save.level).toBe(0);
    expect(game.save.money).toBe(50);
    expect(game.save.upgrades.Battery).toBe(2);
    for (let level = 0; level < 5; level++) {
      game.launch();
      game.position = { ...game.layout.exit };
      game.pair = game.layout.sectors.length - 1;
      game.finishLevel();
      for (let i = 0; i < 160; i++) game.step(1 / 60, idle);
      expect(game.save.level).toBe(Math.min(4, level + 1));
    }
    expect(game.phase).toBe('won');
    expect(validateSave(game.save).won).toBe(true);
  });
  it('charges upgrades once and rejects unaffordable or maxed purchases', () => {
    const game = new GameCore();
    game.start();
    game.openShop();
    game.save.money = 60;
    expect(game.buy('MaxSpeed')).toBe(true);
    expect(game.save.money).toBe(50);
    expect(game.buy('MaxSpeed')).toBe(true);
    expect(game.save.money).toBe(0);
    expect(game.buy('MaxSpeed')).toBe(false);
    expect(game.save.upgrades.MaxSpeed).toBe(2);
    game.save.money = 100000;
    for (let i = 0; i < 10; i++) game.buy('MaxSpeed');
    expect(game.save.upgrades.MaxSpeed).toBe(4);
    expect(game.stats.speed).toBe(getStats(game.save.upgrades).speed);
  });
  it('validates saved values instead of accepting corrupt upgrades or currency', () => {
    const save = validateSave({
      ...freshSave(),
      money: NaN,
      level: 999,
      upgrades: { ...freshSave().upgrades, Battery: -9, MaxSpeed: 99 },
      settings: { volume: 8 },
    });
    expect(save.money).toBe(0);
    expect(save.level).toBe(4);
    expect(save.upgrades.Battery).toBe(0);
    expect(save.upgrades.MaxSpeed).toBe(4);
    expect(save.settings.volume).toBe(1);
  });
});

describe('simulation and decisions', () => {
  it('uses a fixed simulation rate independently of render frame rate', () => {
    const states = [30, 60, 144].map((fps) => {
      const game = new GameCore();
      game.launch();
      let accumulator = 0;
      for (let frame = 0; frame < fps * 5; frame++) {
        accumulator += 1 / fps;
        while (accumulator + 1e-9 >= 1 / 60) {
          game.step(1 / 60, { ...idle, throttle: true });
          accumulator -= 1 / 60;
        }
      }
      return game;
    });
    expect(states[0].battery).toBeCloseTo(states[1].battery, 6);
    expect(dist(states[0].position, states[2].position)).toBeLessThan(0.001);
  });
  it('does not drain battery, timers or create shots while paused', () => {
    const game = new GameCore();
    game.launch();
    game.pause();
    const battery = game.battery;
    for (let i = 0; i < 600; i++) game.step(1 / 60, { throttle: true, brake: false, aim: true });
    expect(game.battery).toBe(battery);
    expect(game.routeTime).toBe(0);
    expect(game.shoot()).toBe(false);
  });
  it('prevents escaping the dome or pipe interior even at full upgrades', () => {
    const game = new GameCore();
    game.start();
    game.position = v(62, 3, 0);
    game.yaw = Math.PI / 2;
    for (let i = 0; i < 600; i++) game.step(1 / 60, { ...idle, throttle: true });
    expect(Math.hypot(game.position.x, game.position.z)).toBeLessThanOrEqual(63.01);
    game.launch();
    game.yaw = Math.PI / 2;
    for (let i = 0; i < 600; i++) game.step(1 / 60, { ...idle, throttle: true });
    expect(
      Math.min(
        ...game.layout.routes.map(
          (r) => closestOnPath(game.position, r.path, r.lengths).distance - r.radius,
        ),
      ),
    ).toBeLessThan(0);
  });
  it('records a fork once even if overlapping its trigger repeatedly', () => {
    const game = new GameCore();
    game.launch();
    const left = game.layout.routes.find((r) => r.kind === 'left')!;
    const right = game.layout.routes.find((r) => r.kind === 'right')!;
    const branchPoint = left.path.find(
      (point, i) =>
        left.lengths[i] > 15 && closestOnPath(point, right.path, right.lengths).distance > 8,
    )!;
    for (let i = 0; i < 100; i++) {
      game.position = { ...branchPoint };
      game.step(1 / 60, idle);
    }
    const choices = game.events.filter((e) => e.decision?.metadata.type === 'fork');
    expect(choices).toHaveLength(1);
    expect(choices[0].decision!.bit).toBe(1);
    expect(choices[0].decision!.timestamp_generation).toMatch(/Z$/);
  });
  it('makes the two bonuses mutually exclusive without disabling later pairs', () => {
    const game = new GameCore();
    game.launch();
    const power = game.entities.find((e) => e.kind === 'power')!,
      group = power.group;
    const other = game.entities.find((e) => e.kind === 'power' && e.group !== group)!;
    game.position = { ...power.position };
    game.step(1 / 60, idle);
    expect(game.entities.filter((e) => e.group === group).every((e) => !e.active)).toBe(true);
    expect(other.active).toBe(true);
    expect(game.events.filter((e) => e.decision?.metadata.type === 'power')).toHaveLength(1);
  });
  it('collects an item once and adds its value immediately', () => {
    const game = new GameCore();
    game.launch();
    const loot = game.entities.find((e) => e.kind === 'loot')!;
    game.position = { ...loot.position };
    const target = direction(game.yaw, game.pitch);
    loot.position = {
      x: game.position.x + target.x,
      y: game.position.y + target.y,
      z: game.position.z + target.z,
    };
    const before = game.save.money;
    for (let i = 0; i < 100; i++) game.step(1 / 60, idle);
    expect(game.save.money).toBeGreaterThan(before);
    expect(loot.active).toBe(false);
    const after = game.save.money;
    for (let i = 0; i < 100; i++) game.step(1 / 60, idle);
    expect(game.save.money).toBe(after);
  });
});
