import {
  campaign,
  freshSave,
  getStats,
  upgradeValues,
  upgrades,
  sourceData,
  lootTier,
  type Save,
  type Upgrade,
} from './data';
import { makeLayout, type Layout, type Spawn, type Route } from './layout';
import {
  v,
  add,
  sub,
  mul,
  dot,
  cross,
  len,
  norm,
  dist,
  mix,
  clamp,
  direction,
  closestOnPath,
  alongPath,
  type V3,
} from './math';

export const CORAL_FUSE_SECONDS = 3;
const HAZARD_DETECTION_RANGE = 80;
export const CORAL_DETECTION_RANGE = 60;

export type Phase =
  'menu' | 'oasis' | 'dive' | 'paused' | 'shop' | 'return' | 'stageComplete' | 'won';
export interface Input {
  throttle: boolean;
  brake: boolean;
  aim: boolean;
  turn?: number;
  tilt?: number;
}
export interface Decision {
  id: string;
  bit: 0 | 1;
  timestamp_generation: string;
  metadata: {
    session_id: string;
    sequence: string;
    game_time: number;
    attempt: number;
    type: string;
    option: string;
    level: number;
  };
}
export interface GameEvent {
  moneyGained?: number;
  type:
    'notice' | 'collect' | 'charge' | 'shot' | 'impact' | 'choice' | 'return' | 'save' | 'level';
  text?: string;
  tone?: 'good' | 'bad' | 'info';
  position?: V3;
  decision?: Decision;
}
export interface Entity extends Spawn {
  active: boolean;
  resolved: boolean;
  age: number;
  health: number;
  cooldown: number;
  origin: V3;
  group?: string;
}
export interface Bullet {
  id: number;
  position: V3;
  velocity: V3;
  life: number;
  enemy: boolean;
  owner: string;
  active: boolean;
}
interface Effect {
  id: string;
  type: Upgrade;
  value: number;
  remaining: number;
}

export class GameCore {
  phase: Phase = 'menu';
  previousPhase: 'oasis' | 'dive' = 'oasis';
  position = v(16, 2.8, -17);
  velocity = v();
  yaw = -0.75;
  pitch = -0.1;
  battery = 40;
  gameTime = 0;
  routeTime = 0;
  cooldown = 0;
  pair = 0;
  aim = false;
  zoom = 6.5;
  targetId: string | null = null;
  entities: Entity[] = [];
  bullets: Bullet[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  layout: Layout;
  save: Save;
  cargo: number[] = [];
  resolved = new Set<string>();
  attempt = 0;
  runLoot = 0;
  runChoices = 0;
  returnTime = 0;
  completed = false;
  returnReason: 'manual' | 'battery' | 'complete' = 'manual';
  completedLevel = 0;
  completionReward = 0;
  hitFlash = 0;
  aimCharge = 0;
  shopArmed = true;
  private sequence = 0;
  private bulletId = 0;
  private age = 0;
  private diveOriginY = 0;
  private inGas = false;
  private lookYaw = 0;
  private lookPitch = 0;
  readonly sessionId = globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`;

  constructor(save = freshSave()) {
    this.save = save;
    this.layout = makeLayout(save.level);
    this.battery = this.stats.battery;
    this.resetEntities();
  }
  get stats() {
    const stats = getStats(this.save.upgrades);
    for (const e of this.effects) {
      if (e.type === 'MaxSpeed') stats.speed += e.value * 0.0024;
      if (e.type === 'Acceleration') stats.acceleration += e.value * 0.002;
      if (e.type === 'Aerodynamics') stats.drag += e.value * 0.0008;
      if (e.type === 'Sonar') stats.sonar += (e.value * 0.008) / 2;
    }
    stats.speed = Math.max(4, stats.speed);
    stats.acceleration = Math.max(1, stats.acceleration);
    stats.drag = Math.max(0.12, stats.drag);
    return stats;
  }
  get depth() {
    return Math.max(0, (this.diveOriginY - this.position.y) * 18);
  }
  get speed() {
    return len(this.velocity);
  }
  get level() {
    return campaign[this.save.level];
  }
  get progress() {
    if (this.completed || this.inFinish) return 1;
    return this.phase === 'oasis' || this.phase === 'menu'
      ? 0
      : clamp((this.pair + this.sectorProgress()) / this.layout.sectors.length, 0, 1);
  }
  emit(event: GameEvent) {
    this.events.push(event);
  }
  notice(text: string, tone: GameEvent['tone'] = 'info') {
    this.emit({ type: 'notice', text, tone });
  }
  private resetEntities() {
    this.entities = this.layout.spawns.map((s) => ({
      ...s,
      position: { ...s.position },
      origin: { ...s.position },
      active: true,
      resolved: false,
      age: 0,
      health: 1,
      cooldown: s.kind === 'monster' ? 0.3 : 1.8,
      group: s.kind === 'power' ? `${s.route}:${s.id.split('-power')[0]}` : undefined,
    }));
  }
  start() {
    this.clearLook();
    this.completed = false;
    this.phase = this.save.won ? 'won' : 'oasis';
    this.position = v(16, 2.8, -17);
    this.velocity = v();
    this.yaw = -0.75;
    this.pitch = -0.1;
    this.battery = this.stats.battery;
    this.notice('Witaj w oazie. Wpłyń do kanału lub odwiedź rybę z ulepszeniami.');
  }
  launch() {
    this.clearLook();
    if (this.phase === 'won') return;
    this.layout = makeLayout(this.save.level);
    this.resetEntities();
    this.phase = 'dive';
    this.velocity = v();
    this.enterStage();
    this.pair = 0;
    this.routeTime = 0;
    this.inGas = false;
    this.effects = [];
    this.cargo = [];
    this.bullets = [];
    this.resolved.clear();
    this.battery = this.stats.battery;
    this.save.runs++;
    this.attempt++;
    this.runLoot = 0;
    this.completionReward = 0;
    this.runChoices = 0;
    this.completed = false;
    this.emit({ type: 'level' });
    this.emit({ type: 'save' });
    this.notice(`${this.level.name} — kieruj się w głąb tunelu.`);
  }
  private enterStage() {
    this.position = { ...this.layout.entry };
    this.diveOriginY = this.position.y;
    const shaft = this.layout.routes[0];
    const near = closestOnPath(this.position, shaft.path, shaft.lengths);
    const forward = norm(sub(alongPath(shaft.path, shaft.lengths, near.along + 18), this.position));
    this.yaw = Math.atan2(forward.x, forward.z);
    this.pitch = Math.asin(clamp(forward.y, -1, 1));
  }

  finishLevel() {
    if (this.phase !== 'dive') return;
    const near = this.nearest(this.position);
    if (
      this.pair !== this.layout.sectors.length - 1 ||
      near.route.kind !== 'finish' ||
      near.along < near.route.length - 8 ||
      dist(this.position, this.layout.exit) >= 3.5
    )
      return;
    this.completedLevel = this.save.level + 1;
    this.completionReward = this.completedLevel * 100;
    this.save.money += this.completionReward;
    this.emit({ type: 'collect', position: { ...this.layout.exit } });
    this.notice(`Poziom ukończony! Nagroda: +${this.completionReward} ◈`, 'good');
    this.save.bestDepth = Math.max(this.save.bestDepth, this.depth);
    if (this.save.level === campaign.length - 1) this.save.won = true;
    else this.save.level++;
    this.returnToBase('complete');
  }
  get fragmentNumber() {
    if (this.phase === 'oasis' || this.phase === 'menu' || this.phase === 'shop') return 0;
    const near = this.nearest(this.position);
    if (near.route.kind === 'finish') return this.layout.fragments.length;
    return Math.min(
      this.layout.fragments.length,
      near.route.pair * 2 + (near.route.kind === 'connector' ? 2 : 1),
    );
  }
  get wrongWay() {
    if (this.phase !== 'dive' || this.speed < 0.5) return false;
    return dot(this.velocity, this.nearest(this.position).tangent) < -0.35 * this.speed;
  }
  get inFinish() {
    return this.phase === 'dive' && this.nearest(this.position).route.kind === 'finish';
  }
  pause() {
    if (this.phase === 'dive' || this.phase === 'oasis') {
      this.previousPhase = this.phase;
      this.phase = 'paused';
      this.aim = false;
      this.clearLook();
    }
  }
  resume() {
    if (this.phase === 'paused') this.phase = this.previousPhase;
  }
  openShop() {
    if (this.phase === 'oasis') {
      this.phase = 'shop';
      this.velocity = v();
      this.shopArmed = false;
      this.aim = false;
    }
  }
  closeShop() {
    if (this.phase === 'shop') {
      this.phase = 'oasis';
      this.battery = this.stats.battery;
    }
  }
  buy(type: Upgrade) {
    const level = this.save.upgrades[type],
      row = upgradeValues(type),
      cost = row.Cost[level];
    if (level >= 4 || cost === undefined || this.save.money < cost || this.phase !== 'shop')
      return false;
    this.save.money -= cost;
    this.save.upgrades[type]++;
    this.battery = this.stats.battery;
    this.emit({ type: 'save' });
    this.notice('Ulepszenie zamontowane.', 'good');
    return true;
  }
  look(dx: number, dy: number) {
    if (this.phase !== 'dive' && this.phase !== 'oasis') return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const s = 0.00095 * this.save.settings.sensitivity * (this.aim ? 0.55 : 1);
    this.lookYaw = clamp(this.lookYaw + dx * s, -0.32, 0.32);
    this.lookPitch = clamp(
      this.lookPitch - dy * s * 0.75 * (this.save.settings.invertY ? -1 : 1),
      -0.24,
      0.24,
    );
  }
  clearLook() {
    this.lookYaw = 0;
    this.lookPitch = 0;
  }
  private steer(dt: number, input: Input) {
    const smoothing = 1 - Math.exp(-16 * dt);
    const yaw = clamp(this.lookYaw * smoothing, -1.15 * dt, 1.15 * dt);
    const pitch = clamp(this.lookPitch * smoothing, -0.85 * dt, 0.85 * dt);
    this.lookYaw -= yaw;
    this.lookPitch -= pitch;
    this.yaw += yaw + clamp(input.turn ?? 0, -1, 1) * 1.05 * dt;
    this.pitch = clamp(this.pitch + pitch + clamp(input.tilt ?? 0, -1, 1) * 0.75 * dt, -1.25, 1.25);
  }
  private decide(key: string, bit: 0 | 1, type: string, option: string) {
    if (this.resolved.has(key)) return;
    this.resolved.add(key);
    this.sequence++;
    this.runChoices++;
    this.save.choices++;
    const decision: Decision = {
      id: `${this.sessionId}:${this.attempt}:level-${this.save.level}:${key}`,
      bit,
      timestamp_generation: new Date().toISOString(),
      metadata: {
        session_id: this.sessionId,
        sequence: String(this.sequence),
        game_time: Number(this.gameTime.toFixed(3)),
        attempt: this.attempt,
        type,
        option,
        level: this.save.level + 1,
      },
    };
    this.emit({ type: 'choice', decision });
    this.emit({ type: 'save' });
  }
  private slowDown() {
    this.velocity = mul(this.velocity, 0.5);
  }
  private effect(id: string, type: Upgrade, value: number, seconds = 10) {
    this.effects = this.effects.filter((e) => e.id !== id);
    this.effects.push({ id, type, value, remaining: seconds });
  }
  private nearest(point: V3) {
    let best: { route: Route; point: V3; distance: number; along: number; tangent: V3 } | null =
      null;
    for (const route of this.layout.routes) {
      if (route.pair < this.pair - 1 || route.pair > this.pair + 1) continue;
      const c = closestOnPath(point, route.path, route.lengths);
      if (!best || c.distance - route.radius < best.distance - best.route.radius)
        best = { ...c, route };
    }
    return best!;
  }
  private sectorProgress() {
    const c = this.nearest(this.position);
    if (c.route.pair !== this.pair || c.route.kind === 'shaft') return 0;
    return c.route.kind === 'connector'
      ? 0.5 + (0.5 * c.along) / c.route.length
      : (0.5 * c.along) / c.route.length;
  }
  guidance(): V3 {
    if (this.phase === 'oasis' || this.phase === 'menu' || this.phase === 'shop')
      return v(0, -4, 0);
    const c = this.nearest(this.position);
    const branch = (pair: number) => {
      const choices = this.layout.routes.filter(
        (r) => r.pair === pair && (r.kind === 'left' || r.kind === 'right'),
      );
      const forward = direction(this.yaw, this.pitch);
      return choices.sort(
        (a, b) =>
          dot(norm(sub(alongPath(b.path, b.lengths, 35), this.position)), forward) -
          dot(norm(sub(alongPath(a.path, a.lengths, 35), this.position)), forward),
      )[0];
    };
    if (c.route.pair < this.pair) {
      const next = branch(this.pair);
      return alongPath(next.path, next.lengths, 18);
    }
    if (c.along + 18 <= c.route.length)
      return alongPath(c.route.path, c.route.lengths, c.along + 18);
    const next =
      c.route.kind === 'shaft'
        ? branch(0)
        : c.route.kind === 'left' || c.route.kind === 'right'
          ? this.layout.routes.find((r) => r.pair === c.route.pair && r.kind === 'connector')
          : c.route.pair + 1 < this.layout.sectors.length
            ? branch(c.route.pair + 1)
            : c.route.kind === 'connector'
              ? this.layout.routes.find((r) => r.kind === 'finish')
              : undefined;
    return next
      ? alongPath(next.path, next.lengths, c.along + 18 - c.route.length)
      : this.layout.exit;
  }
  private move(dt: number, input: Input) {
    const dir = direction(this.yaw, this.pitch),
      stats = this.stats;
    const inGas =
      this.phase === 'dive' &&
      this.entities.some(
        (e) => e.active && e.kind === 'gas' && dist(e.position, this.position) < e.radius + 1,
      );
    // Apply once on entry into the cloud, not repeatedly while overlapping it.
    if (inGas && !this.inGas) this.slowDown();
    this.inGas = inGas;
    const throttle = input.throttle && (this.phase === 'oasis' || this.battery > 0);
    // Steering rotates the hull, not its momentum. Water gradually damps sideways
    // motion while thrust accelerates along the new heading, producing a wider turn.
    const longitudinal = mul(dir, dot(this.velocity, dir));
    const lateral = sub(this.velocity, longitudinal);
    this.velocity = add(longitudinal, mul(lateral, Math.exp(-0.9 * dt)));
    if (throttle) this.velocity = add(this.velocity, mul(dir, stats.acceleration * dt));
    this.velocity = mul(
      this.velocity,
      Math.exp(-(input.brake ? 5 : throttle ? 0.04 : stats.drag) * dt),
    );
    const cap = this.phase === 'oasis' ? 8 : stats.speed;
    if (len(this.velocity) > cap) this.velocity = mul(norm(this.velocity), cap);
    if (this.phase === 'dive' && throttle) this.battery = Math.max(0, this.battery - dt * 0.65);
    let next = add(this.position, mul(this.velocity, dt));
    if (this.phase === 'oasis') {
      const r = Math.hypot(next.x, next.z);
      if (r > 63) {
        next.x *= 63 / r;
        next.z *= 63 / r;
        this.velocity = mul(this.velocity, 0.5);
      }
      const ceiling = Math.sqrt(Math.max(0, 70 * 70 - r * r)) * 0.68;
      next.y = clamp(next.y, r < 10 ? -4 : 2.2, Math.max(3, ceiling));
      if (r < 9 && next.y < -0.8) {
        this.launch();
        return;
      }
    } else {
      const c = this.nearest(next),
        wall = c.route.radius - 1.15;
      if (c.distance > wall) {
        const n = norm(sub(next, c.point));
        next = add(c.point, mul(n, wall));
        const outward = dot(this.velocity, n);
        if (outward > 0) this.velocity = sub(this.velocity, mul(n, outward));
      }
      // Swept travel is subdivided by fixed simulation steps; closed discs block the whole tube.
      for (const e of this.entities) {
        if (!e.active || e.kind !== 'disc') continue;
        const before = dot(sub(this.position, e.position), e.forward),
          after = dot(sub(next, e.position), e.forward);
        const radial = len(sub(sub(next, e.position), mul(e.forward, after)));
        if (before * after <= 0 && radial < e.radius + 0.3 && this.discClosed(e)) {
          if (this.speed > this.discRequiredSpeed(e)) {
            this.destroy(e, 'ram');
            this.slowDown();
          } else {
            next = add(next, mul(e.forward, (before < 0 ? -1 : 1) * 1.7 - after));
            this.velocity = mul(e.forward, before < 0 ? -3 : 3);
            this.hitFlash = 0.25;
            if (e.cooldown <= 0) {
              this.notice('Przesłona zamknięta — zaczekaj albo użyj F.', 'bad');
              e.cooldown = 3;
            }
          }
        }
      }
    }
    this.position = next;
  }
  discRequiredSpeed(e?: Entity) {
    const depth = e ? -e.position.y * 18 : this.depth;
    return sourceData.discs.reduce(
      (speed, row) => (depth >= -row.MinDepth ? row.RequiredSpeed * 0.004 : speed),
      4,
    );
  }
  discClosed(e: Entity) {
    return (e.age + e.variant * 0.7) % 7.2 > 3.4;
  }
  shoot() {
    if (this.phase !== 'dive' || this.cooldown > 0) return false;
    this.cooldown = 0.5;
    const forward = direction(this.yaw, this.pitch);
    const right = norm(cross(v(0, 1, 0), forward));
    // A visible bow-side launch point keeps the rocket out of the hull silhouette.
    let muzzle = add(add(this.position, mul(forward, 3.4)), mul(right, 1.2));
    const corridor = this.nearest(muzzle);
    if (corridor.distance > corridor.route.radius - 0.5)
      muzzle = add(
        corridor.point,
        mul(norm(sub(muzzle, corridor.point)), corridor.route.radius - 0.5),
      );
    const target = this.entities.find((e) => e.id === this.targetId && e.active);
    const dir = target ? norm(sub(target.position, muzzle)) : forward;
    this.bullets.push({
      id: ++this.bulletId,
      position: muzzle,
      velocity: mul(dir, 40),
      life: 2.5,
      enemy: false,
      owner: '',
      active: true,
    });
    this.emit({ type: 'shot' });
    return true;
  }
  private destroy(e: Entity, option: string) {
    e.active = false;
    this.emit({ type: 'impact', position: { ...e.position } });
    if (e.kind === 'monster') {
      this.decide(e.id, 1, 'monster', option);
      for (let i = 0; i < 4; i++)
        this.entities.push({
          ...e,
          id: `${e.id}-loot-${i}`,
          kind: 'loot',
          active: true,
          position: add(e.position, v(Math.cos(i * 1.6) * 2, Math.sin(i * 1.6), 2)),
          origin: { ...e.position },
          radius: 1,
          age: 0,
          value: 1,
          variant: Math.min(6, lootTier(-e.position.y * 18)),
          health: 1,
        });
    } else if (e.kind === 'meteor') this.decide(e.id, 0, 'meteor', option);
    else if (e.kind === 'coral') this.decide(e.id, 1, 'coral', option);
    else if (e.kind === 'disc') this.decide(e.id, option === 'ram' ? 1 : 0, 'disc', option);
  }
  private updateEntities(dt: number) {
    const stats = this.stats,
      dir = direction(this.yaw, this.pitch);
    this.targetId = null;
    let targetAngle = 0.97;
    for (const e of this.entities) {
      if (!e.active || Math.abs(e.pair - this.pair) > 1) continue;
      e.age += dt;
      e.cooldown -= dt;
      const d = dist(e.position, this.position),
        rel = sub(e.position, this.position),
        facing = dot(norm(rel), dir);
      if (
        ['disc', 'meteor', 'coral', 'monster'].includes(e.kind) &&
        d < 85 &&
        facing > targetAngle
      ) {
        this.targetId = e.id;
        targetAngle = facing;
      }
      if (
        (e.kind === 'loot' || e.kind === 'eel') &&
        d < stats.sonar &&
        facing > Math.cos(Math.PI / 4)
      ) {
        e.position = mix(e.position, add(this.position, mul(dir, 1.6)), 1 - Math.exp(-7 * dt));
        if (d < 3.2) {
          e.active = false;
          if (e.kind === 'eel') {
            this.battery = Math.min(stats.battery, this.battery + stats.battery * 0.2);
            this.emit({ type: 'charge' });
            this.notice('Węgorz: +20% energii', 'good');
          } else {
            const item = sourceData.collectables[e.variant % sourceData.collectables.length],
              value = item.MarketPrice;
            this.save.money += value;
            this.runLoot += value;
            this.cargo.push(e.variant);
            this.emit({ type: 'collect', moneyGained: value });
            this.emit({ type: 'save' });
          }
        }
      } else if (e.kind === 'eel') {
        e.position = add(
          e.origin,
          v(Math.sin(e.age * 1.5) * 1.2, Math.cos(e.age) * 0.4, Math.sin(e.age * 0.7)),
        );
      }
      if (e.kind === 'power' && d < 2.7) {
        const type = upgrades[e.variant % 5];
        this.decide(e.group || e.id, e.value === 1 ? 1 : 0, 'power', type);
        for (const other of this.entities)
          if (other.group && other.group === e.group) other.active = false;
        e.active = false;
        if (type === 'Battery') {
          this.battery = Math.min(stats.battery, this.battery + stats.battery * 0.2);
          this.notice('Doładowanie baterii', 'good');
        } else {
          const values = {
            MaxSpeed: 2000,
            Acceleration: 1000,
            Aerodynamics: -500,
            Sonar: 1000,
            Battery: 0,
          };
          this.effect(e.id, type, values[type]);
          this.notice('Bonus aktywny przez 10 sekund', 'good');
        }
        this.emit({ type: 'charge' });
      }
      if (e.kind === 'meteor') {
        e.position = add(
          e.origin,
          v(Math.sin(e.age * 1.4 + e.variant) * 4.1, Math.cos(e.age * 0.8) * 2.6, 0),
        );
        if (d < 2.5) {
          if (e.variant % 2) this.slowDown();
          else this.effect(e.id, 'MaxSpeed', 1000);
          this.decide(
            e.id,
            e.variant % 2 ? 1 : 0,
            'meteor',
            e.variant % 2 ? 'red-contact' : 'contact',
          );
          e.active = false;
          this.hitFlash = 0.35;
          this.notice(
            e.variant % 2 ? 'Spowolnienie napędu' : 'Impuls prędkości',
            e.variant % 2 ? 'bad' : 'good',
          );
        }
      }
      if (e.kind === 'coral') {
        if (d <= CORAL_DETECTION_RANGE && e.health === 1) {
          e.health = 2;
          e.age = 0;
          this.notice('Koral się budzi — oddal się lub strzel!', 'bad');
        }
        if (e.health === 2 && e.age >= CORAL_FUSE_SECONDS) {
          if (d < 9) {
            this.slowDown();
            this.decide(e.id, 0, 'coral', 'caught');
            this.hitFlash = 0.5;
          } else this.decide(e.id, 0, 'coral', 'escaped');
          e.active = false;
          this.emit({ type: 'impact', position: e.position });
        }
      }
      if (
        e.kind === 'monster' &&
        d < HAZARD_DETECTION_RANGE &&
        d > 5 &&
        e.cooldown <= 0 &&
        this.bullets.filter((b) => b.active && b.enemy && b.owner === e.id).length < 5
      ) {
        e.cooldown = (2.7 - this.save.level * 0.18) / 2;
        this.bullets.push({
          id: ++this.bulletId,
          position: { ...e.position },
          velocity: mul(norm(sub(this.position, e.position)), 16 + this.save.level * 2),
          life: HAZARD_DETECTION_RANGE / (16 + this.save.level * 2) + 0.25,
          enemy: true,
          owner: e.id,
          active: true,
        });
      }
      // Once passed, resolve non-selected hazards without frame-dependent duplicate overlaps.
      if (
        !e.resolved &&
        ['disc', 'meteor', 'monster'].includes(e.kind) &&
        dot(sub(this.position, e.origin), e.forward) > 14
      ) {
        e.resolved = true;
        this.decide(e.id, 0, e.kind, 'passed');
      }
    }
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      const old = bullet.position;
      bullet.position = add(old, mul(bullet.velocity, dt));
      bullet.life -= dt;
      const corridor = this.nearest(bullet.position);
      if (corridor.distance > corridor.route.radius) {
        bullet.active = false;
        if (bullet.enemy) this.decide(`bullet-${bullet.id}`, 0, 'projectile', 'wall');
        continue;
      }
      if (bullet.enemy) {
        if (dist(bullet.position, this.position) < 1.8) {
          this.battery = Math.max(0, this.battery - 2);
          this.hitFlash = 0.4;
          bullet.active = false;
          this.decide(`bullet-${bullet.id}`, 1, 'projectile', 'hit');
          this.emit({ type: 'impact', position: this.position });
        } else if (bullet.life <= 0) this.decide(`bullet-${bullet.id}`, 0, 'projectile', 'avoided');
      } else {
        for (const e of this.entities) {
          if (!e.active || !['disc', 'meteor', 'coral', 'monster'].includes(e.kind)) continue;
          if (
            dist(bullet.position, e.position) <
            (e.kind === 'disc' ? e.radius - 0.2 : e.radius + 0.65)
          ) {
            this.destroy(e, 'shot');
            bullet.active = false;
            break;
          }
        }
      }
      if (bullet.life <= 0) bullet.active = false;
    }
    this.bullets = this.bullets.filter((b) => b.active);
  }
  returnToBase(reason: 'manual' | 'battery' | 'complete' = 'manual') {
    if (this.phase === 'return' || this.phase === 'won') return;
    this.completed = reason === 'complete';
    this.returnReason = reason;
    this.clearLook();
    this.returnTime = 0;
    this.inGas = false;
    this.phase = 'return';
    this.velocity = v();
    this.aim = false;
    this.effects = [];
    this.emit({
      type: 'return',
      text:
        reason === 'battery'
          ? 'Energia wyczerpana — powrót ratunkowy do oazy.'
          : 'Wracamy do oazy.',
    });
    this.emit({ type: 'save' });
  }
  step(dt: number, input: Input) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.phase === 'return') {
      this.returnTime += dt;
      if (this.returnTime > 2.5) {
        this.position = v(16, 2.8, -17);
        this.yaw = -0.75;
        this.pitch = -0.1;
        this.battery = this.stats.battery;
        this.bullets = [];
        this.phase = this.completed ? (this.save.won ? 'won' : 'stageComplete') : 'oasis';
        this.pair = 0;
        this.layout = makeLayout(this.save.level);
        this.resetEntities();
        this.emit({ type: 'level' });
        this.shopArmed = true;
      }
      return;
    }
    if (this.phase !== 'dive' && this.phase !== 'oasis') return;
    this.gameTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.aim = input.aim && this.phase === 'dive';
    this.steer(dt, input);
    this.aimCharge = clamp(this.aimCharge + (this.aim ? dt * 3 : -dt * 5), 0, 1);
    this.effects = this.effects
      .map((e) => ({ ...e, remaining: e.remaining - dt }))
      .filter((e) => e.remaining > 0);
    this.move(dt, input);
    if (this.phase === 'oasis') {
      const fishDistance = dist(this.position, v(28, 3, 10));
      if (fishDistance > 10) this.shopArmed = true;
      if (fishDistance < 5.5 && this.shopArmed) this.openShop();
      return;
    }
    if (this.phase !== 'dive') return;
    this.routeTime += dt;
    this.save.bestDepth = Math.max(this.save.bestDepth, this.depth);
    this.updateEntities(dt);
    const nearest = this.nearest(this.position),
      sector = this.layout.sectors[this.pair];
    if (
      nearest.route.pair === this.pair &&
      ['left', 'right'].includes(nearest.route.kind) &&
      nearest.along > 15
    ) {
      const opposite = this.layout.routes.find(
        (r) =>
          r.pair === this.pair && r.kind === (nearest.route.kind === 'left' ? 'right' : 'left'),
      )!;
      if (closestOnPath(this.position, opposite.path, opposite.lengths).distance > 2)
        this.decide(
          `fork-${this.pair}`,
          nearest.route.kind === 'left' ? 1 : 0,
          'fork',
          nearest.route.kind,
        );
    }
    if (
      (nearest.route.pair === this.pair &&
        nearest.route.kind === 'connector' &&
        nearest.along > nearest.route.length * 0.8 &&
        dist(this.position, sector.end) < 8) ||
      // Near-wall pilots can miss the central trigger. Entering the next connected
      // route must also advance the active sector, or later routes become unreachable.
      (nearest.route.pair === this.pair + 1 &&
        nearest.distance <= nearest.route.radius - 1.15 + 1e-6 &&
        dot(
          sub(this.position, sector.end),
          nearest.route.path.length > 1
            ? sub(nearest.route.path[1], nearest.route.path[0])
            : v(0, 0, 1),
        ) >= 0)
    ) {
      if (this.pair < this.layout.sectors.length - 1) {
        this.pair++;
        this.notice(`Fragment ${this.pair * 2 + 1} z ${this.layout.fragments.length}`, 'info');
      }
    }
    if (nearest.route.kind === 'finish') this.finishLevel();
    if (this.phase === 'dive' && this.battery <= 0) this.returnToBase('battery');
  }
}
