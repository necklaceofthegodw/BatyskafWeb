import { describe, it, expect } from 'vitest';
import { GameCore, type Entity } from '../../src/game/core';
import { v } from '../../src/game/math';
const idle = { throttle: false, brake: false, aim: false };
function corridor(level = 0) {
  const g = new GameCore();
  g.save.level = level;
  g.launch();
  g.entities = [];
  // A straight tube isolates hazard timing from corners and other obstacles.
  const route = {
    ...g.layout.routes[0],
    kind: 'connector' as const,
    path: [v(0, -100, 0), v(0, -100, 200)],
    lengths: [0, 200],
    length: 200,
  };
  g.layout.routes = [route];
  g.position = v(0, -100, 20);
  g.yaw = 0;
  g.pitch = 0;
  return g;
}
function hazard(g: GameCore, kind: Entity['kind'], z = 20): Entity {
  const e: Entity = {
    id: `test-${kind}`,
    kind,
    position: v(0, -100, z),
    origin: v(0, -100, z),
    forward: v(0, 0, 1),
    pair: 0,
    route: g.layout.routes[0].id,
    radius: 5.4,
    value: 1,
    variant: 1,
    active: true,
    resolved: false,
    age: 0,
    health: 1,
    cooldown: 0.3,
  };
  g.entities.push(e);
  return e;
}
describe('hazard balance', () => {
  it('halves current speed once per gas entry, including overlapping clouds, and permits recovery', () => {
    const g = corridor(),
      control = corridor();
    hazard(g, 'gas');
    const second = hazard(g, 'gas');
    second.id = 'gas-2';
    g.velocity = control.velocity = v(0, 0, 10);
    for (let i = 0; i < 60; i++) {
      g.position = control.position = v(0, -100, 20);
      g.step(1 / 60, idle);
      control.step(1 / 60, idle);
      expect(g.speed).toBeCloseTo(control.speed * 0.5, 7);
    }
    g.position = v(0, -100, 50);
    g.step(1 / 60, idle);
    g.position = control.position = v(0, -100, 20);
    g.velocity = control.velocity = v(0, 0, 8);
    g.step(1 / 60, idle);
    control.step(1 / 60, idle);
    expect(g.speed).toBeCloseTo(control.speed * 0.5, 7);
    const slowed = g.speed;
    for (let i = 0; i < 30; i++) {
      g.position = v(0, -100, 20);
      g.step(1 / 60, { ...idle, throttle: true });
    }
    expect(g.speed).toBeGreaterThan(slowed);
  });
  it('red meteor halves velocity without a lasting engine penalty or repeated contact hit', () => {
    const g = corridor(),
      control = corridor();
    const e = hazard(g, 'meteor');
    g.velocity = control.velocity = v(0, 0, 10);
    g.step(1 / 60, idle);
    control.step(1 / 60, idle);
    expect(g.speed).toBeCloseTo(control.speed * 0.5, 7);
    expect(e.active).toBe(false);
    expect(g.stats).toEqual(control.stats);
    g.step(1 / 60, idle);
    control.step(1 / 60, idle);
    expect(g.speed).toBeCloseTo(control.speed * 0.5, 7);
  });
  it('corals detect within 60 units, explode after 3 seconds, and halve speed only within the blast', () => {
    for (const close of [true, false]) {
      const g = corridor(),
        control = corridor();
      const e = hazard(g, 'coral', 81);
      g.step(1 / 60, idle);
      expect(e.health).toBe(1);
      e.position.z = 80;
      g.step(1 / 60, idle);
      expect(e.health).toBe(2);
      for (let i = 0; i < 179; i++) g.step(1 / 60, idle);
      expect(e.active).toBe(true);
      g.position = control.position = v(0, -100, close ? 75 : 20);
      g.velocity = control.velocity = v(0, 0, 8);
      g.step(1 / 60, idle);
      control.step(1 / 60, idle);
      // Allow one fixed tick for floating point accumulation at the fuse boundary.
      if (e.active) {
        g.step(1 / 60, idle);
        control.step(1 / 60, idle);
      }
      expect(e.active).toBe(false);
      expect(g.speed).toBeCloseTo(control.speed * (close ? 0.5 : 1), 7);
      expect(g.stats).toEqual(control.stats);
      expect(g.events.filter((e) => e.type === 'impact')).toHaveLength(1);
    }
  });
  it('monsters detect at 70 units and sustain twice the firing rate on every level', () => {
    for (let level = 0; level < 5; level++) {
      const g = corridor(level);
      hazard(g, 'monster', 90);
      const times: number[] = [];
      const ids = new Set<number>();
      for (let i = 0; i < 360; i++) {
        g.step(1 / 60, idle);
        for (const b of g.bullets)
          if (b.enemy && !ids.has(b.id)) {
            ids.add(b.id);
            times.push((i + 1) / 60);
          }
        expect(g.bullets.filter((b) => b.enemy && b.active).length).toBeLessThanOrEqual(5);
      }
      expect(times.length).toBeGreaterThanOrEqual(5);
      expect(times[0]).toBeLessThanOrEqual(0.32);
      for (let i = 1; i < times.length; i++)
        expect(Math.abs(times[i] - times[i - 1] - (2.7 - level * 0.18) / 2)).toBeLessThan(0.034);
      expect(g.battery).toBeLessThan(g.stats.battery); // Projectiles actually reach the player from the new range.
    }
  });
});
