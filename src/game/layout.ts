import { campaign, lootTier } from './data';
import {
  v,
  add,
  sub,
  mul,
  len,
  norm,
  cross,
  pathLengths,
  alongPath,
  seeded,
  type V3,
} from './math';

export type Kind = 'loot' | 'eel' | 'disc' | 'power' | 'meteor' | 'gas' | 'coral' | 'monster';
export const TUNNEL_RADIUS = 10;
export interface Route {
  id: string;
  pair: number;
  kind: 'shaft' | 'left' | 'right' | 'connector' | 'finish';
  path: V3[];
  lengths: number[];
  length: number;
  radius: number;
}
export interface Spawn {
  id: string;
  pair: number;
  kind: Kind;
  position: V3;
  forward: V3;
  radius: number;
  value: number;
  variant: number;
  route: string;
}
export interface Sector {
  index: number;
  start: V3;
  fork: V3;
  join: V3;
  end: V3;
  crossroad: number;
  spline: string;
}
export interface Fragment {
  index: number;
  kind: 'fork' | 'tunnel';
  routeIds: string[];
}
export interface Layout {
  fragments: Fragment[];
  entry: V3;
  routes: Route[];
  sectors: Sector[];
  spawns: Spawn[];
  exit: V3;
  length: number;
  index: number;
}

type PathSection = { straight: number } | { turn: number; radius: number };

// Exact circular elbows preserve their radius instead of overshooting at spline
// control points. Separate elbows with straight sections; no turn exceeds 90°.
function elbowPath(first: V3, drop: number, sections: PathSection[]): V3[] {
  const path = [{ ...first }],
    distances = [0];
  let heading = 0,
    distance = 0;
  for (const section of sections) {
    const start = path[path.length - 1],
      initialHeading = heading;
    const angle = 'turn' in section ? (section.turn * Math.PI) / 180 : 0;
    const length = 'straight' in section ? section.straight : Math.abs(angle) * section.radius;
    const count = Math.ceil(length / 2);
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      let x: number, z: number;
      if ('straight' in section) {
        x = Math.sin(heading) * length * t;
        z = Math.cos(heading) * length * t;
      } else {
        const signedRadius = section.radius * Math.sign(angle);
        x = signedRadius * (Math.cos(initialHeading) - Math.cos(initialHeading + angle * t));
        z = signedRadius * (Math.sin(initialHeading + angle * t) - Math.sin(initialHeading));
      }
      path.push(v(start.x + x, first.y, start.z + z));
      distances.push(distance + length * t);
    }
    heading += angle;
    distance += length;
  }
  return path.map((point, i) => {
    const t = distances[i] / distance;
    return v(point.x, first.y - drop * t * t * (3 - 2 * t), point.z);
  });
}

// Different silhouettes: square dogleg, S-bend, sweeping offset and chicane.
// All finish facing forward and never turn back towards an earlier fragment.
const connectorShapes = [
  { turns: [90, -90], radius: 26, straight: 18 },
  { turns: [45, -90, 45], radius: 30, straight: 16 },
  { turns: [60, -60], radius: 32, straight: 32 },
  { turns: [60, -60, -60, 60], radius: 26, straight: 24 },
  { turns: [30, -60, 30], radius: 38, straight: 18 },
  { turns: [75, -75], radius: 28, straight: 26 },
];

function connectorPath(first: V3, drop: number, variant: number, mirror: number) {
  const shape = connectorShapes[variant % connectorShapes.length];
  const sections: PathSection[] = [{ straight: 10 }];
  shape.turns.forEach((turn, i) => {
    sections.push({ turn: turn * mirror, radius: shape.radius });
    if (i < shape.turns.length - 1) sections.push({ straight: shape.straight });
  });
  sections.push({ straight: 12 });
  return elbowPath(first, drop, sections);
}

function branchPath(first: V3, drop: number, variant: number, mirror: number) {
  const angle = [30, 45, 60][variant % 3] * mirror;
  const radius = [34, 30, 26][variant % 3];
  const diagonal = 12 + (variant % 3) * 4;
  return elbowPath(first, drop, [
    { straight: 6 },
    { turn: angle, radius },
    { straight: diagonal },
    { turn: -angle, radius },
    { straight: 18 + (variant % 2) * 8 },
    { turn: -angle, radius },
    { straight: diagonal },
    { turn: angle, radius },
    { straight: 6 },
  ]);
}

// Broad bows with horizontal end tangents keep the radius-10 tube from folding
// through itself, including where consecutive modules meet.
function gentlePath(first: V3, last: V3, lateral: number) {
  const count = Math.ceil((last.z - first.z) / 2.5);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      ease = t * t * (3 - 2 * t);
    return v(
      first.x + (last.x - first.x) * ease + lateral * Math.sin(Math.PI * t) ** 2,
      first.y + (last.y - first.y) * ease,
      first.z + (last.z - first.z) * t,
    );
  });
}

function makeRoute(id: string, pair: number, kind: Route['kind'], path: V3[]): Route {
  const lengths = pathLengths(path);
  return {
    id,
    pair,
    kind,
    path,
    lengths,
    length: lengths[lengths.length - 1],
    radius: TUNNEL_RADIUS,
  };
}
export function makeLayout(index: number): Layout {
  const def = campaign[index],
    random = seeded(def.seed),
    routes: Route[] = [],
    sectors: Sector[] = [],
    spawns: Spawn[] = [];
  const entry = v(0, -19, 0);
  // A radius-28 quarter bend replaces the tight elbow beneath the surface.
  const shaftPath: V3[] = [];
  for (let i = 0; i <= 10; i++) shaftPath.push(v(0, 0.3 + ((-19 - 0.3) * i) / 10, 0));
  for (let i = 1; i <= 24; i++) {
    const angle = (Math.PI * 0.5 * i) / 24;
    shaftPath.push(v(0, -19 - 28 * Math.sin(angle), 28 * (1 - Math.cos(angle))));
  }
  shaftPath.push(v(0, -47, 32), v(0, -47, 36));
  const shaft = makeRoute('shaft', 0, 'shaft', shaftPath);
  routes.push(shaft);
  let start = v(0, -47, 36),
    total = shaft.length;
  def.pairs.forEach((pair, p) => {
    const id = `p${p}`,
      fork = { ...start };
    const drop = (14 + index * 5) * 1.15;
    const variant = p + index * 2;
    let join = fork;
    for (const side of ['left', 'right'] as const) {
      const path = branchPath(fork, drop, variant, side === 'left' ? -1 : 1);
      // Mirrored branches share one exact endpoint, avoiding microscopic cracks.
      path[path.length - 1].x = fork.x;
      join = path[path.length - 1];
      const route = makeRoute(`${id}-${side}`, p, side, path);
      routes.push(route);
      total += route.length / 2;
    }
    const depthDrop = 18 + index * 7;
    const conn = makeRoute(
      `${id}-connector`,
      p,
      'connector',
      connectorPath(join, depthDrop, variant, (p + index) % 2 ? -1 : 1),
    );
    routes.push(conn);
    total += conn.length;
    const end = conn.path[conn.path.length - 1];
    sectors.push({
      index: p,
      start: fork,
      fork,
      join,
      end,
      crossroad: pair.crossroad,
      spline: pair.spline,
    });
    start = { ...end };
  });
  // A fork counts as one fragment whichever branch the player selects.
  const fragments: Fragment[] = sectors.flatMap((sector) => [
    {
      index: sector.index * 2,
      kind: 'fork' as const,
      routeIds: [`p${sector.index}-left`, `p${sector.index}-right`],
    },
    {
      index: sector.index * 2 + 1,
      kind: 'tunnel' as const,
      routeIds: [`p${sector.index}-connector`],
    },
  ]);
  const finish = makeRoute(
    'level-finish',
    sectors.length - 1,
    'finish',
    gentlePath(start, add(start, v(0, -6, 48)), 0),
  );
  routes.push(finish);
  total += finish.length;
  const exit = finish.path[finish.path.length - 1];
  let legendaryPlaced = false;
  const lootVariant = (position: V3) => {
    const max = lootTier(-position.y * 18);
    if (max === 7 && !legendaryPlaced) {
      legendaryPlaced = true;
      return 7;
    }
    return Math.floor(random() * Math.min(7, max + 1));
  };
  for (const route of routes) {
    if (route.kind === 'shaft' || route.kind === 'finish') continue;
    const spots = route.kind === 'connector' ? 4 + index : 3;
    for (let n = 0; n < spots; n++) {
      const s = ((n + 1) / (spots + 1)) * route.length,
        position = alongPath(route.path, route.lengths, s);
      const forward = norm(
        sub(
          alongPath(route.path, route.lengths, s + 1),
          alongPath(route.path, route.lengths, s - 1),
        ),
      );
      const right = norm(cross(v(0, 1, 0), forward));
      const list: Kind[] = ['loot', 'power', 'disc', 'gas', 'meteor', 'coral', 'monster'];
      let kind = list[Math.floor(random() * list.length)];
      if (index === 0 && n < 2) kind = n === 0 ? 'loot' : 'power';
      const make = (k: Kind, pos: V3, variant = Math.floor(random() * 5), value = 1) =>
        spawns.push({
          id: `${route.id}-${n}-${k}-${spawns.length}`,
          pair: route.pair,
          kind: k,
          position: pos,
          forward,
          radius:
            k === 'gas'
              ? 3.4
              : k === 'disc'
                ? TUNNEL_RADIUS - 0.4
                : k === 'monster'
                  ? 2
                  : k === 'coral'
                    ? 3.2
                    : 1.2,
          value,
          variant,
          route: route.id,
        });
      if (kind === 'power') {
        const a = Math.floor(random() * 5),
          b = (a + 1 + Math.floor(random() * 4)) % 5;
        make(kind, add(position, mul(right, -3.1)), a, 0);
        make(kind, add(position, mul(right, 3.1)), b, 1);
      } else if (kind === 'gas') {
        // Keep a continuous clear lane on the opposite side of each tunnel.
        const side = (route.pair + index) % 2 === 0 ? -1 : 1;
        make(kind, add(position, mul(right, side * 4.4)));
      } else
        make(kind, position, kind === 'loot' ? lootVariant(position) : Math.floor(random() * 5));
      // Energy and an attainable trail of loot provide recovery between obstacles.
      if (n % 2 === 0) make('eel', add(position, add(mul(right, 3.8), v(0, 1.5, 6))), 0);
      if (kind !== 'loot')
        make('loot', add(position, add(mul(right, -3), v(0, 0.5, 8))), lootVariant(position));
    }
  }
  return { entry, fragments, routes, sectors, spawns, exit, length: total, index };
}
