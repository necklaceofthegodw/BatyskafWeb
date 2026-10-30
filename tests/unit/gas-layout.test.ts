import { expect, it } from 'vitest';
import { makeLayout } from '../../src/game/layout';
import { add, mul, norm, sub, dist, closestOnPath } from '../../src/game/math';

it('leaves a wide continuous bypass lane around every gas cloud on all levels', () => {
  let clouds = 0;
  for (let level = 0; level < 5; level++) {
    const layout = makeLayout(level);
    for (const gas of layout.spawns.filter((e) => e.kind === 'gas')) {
      clouds++;
      const route = layout.routes.find((r) => r.id === gas.route)!;
      const center = closestOnPath(gas.position, route.path, route.lengths).point;
      const offset = sub(gas.position, center);
      expect(dist(gas.position, center) + gas.radius).toBeLessThan(route.radius);
      const bypass = add(center, mul(norm(offset), -4));
      // Includes the submarine's collision margin and generous steering clearance.
      expect(dist(bypass, gas.position) - (gas.radius + 1)).toBeGreaterThan(3);
      expect(dist(bypass, center) + 2).toBeLessThan(route.radius);
    }
  }
  expect(clouds).toBeGreaterThan(0);
});
