import source from '../data/source.json';
export type Upgrade = 'MaxSpeed' | 'Acceleration' | 'Aerodynamics' | 'Battery' | 'Sonar';
export const upgrades: Upgrade[] = ['MaxSpeed', 'Acceleration', 'Aerodynamics', 'Battery', 'Sonar'];
export const upgradeInfo: Record<Upgrade, { name: string; description: string; icon: string }> = {
  MaxSpeed: { name: 'Napęd', description: 'Większa prędkość maksymalna', icon: '↗' },
  Acceleration: { name: 'Turbina', description: 'Szybsze nabieranie prędkości', icon: '≋' },
  Aerodynamics: { name: 'Kadłub', description: 'Mniejszy opór, dłuższy ślizg', icon: '◇' },
  Battery: { name: 'Akumulator', description: 'Więcej energii na wyprawę', icon: 'ϟ' },
  Sonar: { name: 'Sonar', description: 'Większy zasięg zbierania', icon: '◎' },
};
export const palettes = [
  {
    name: 'Płytkie kanały',
    subtitle: 'Pierwszy ślad pod powierzchnią',
    wall: '#527c73',
    water: '#123b48',
    glow: '#7be5cd',
    accent: '#d6b97b',
  },
  {
    name: 'Omszałe tunele',
    subtitle: 'Tam, gdzie światło spotyka mech',
    wall: '#526c48',
    water: '#163c36',
    glow: '#b3db82',
    accent: '#b7bf73',
  },
  {
    name: 'Korytarze koralowe',
    subtitle: 'Nie wszystko tutaj śpi',
    wall: '#635877',
    water: '#29233d',
    glow: '#d4a1ee',
    accent: '#ec9e7d',
  },
  {
    name: 'Głębokie ruiny',
    subtitle: 'Echa dawno zapomnianych przejść',
    wall: '#3b546a',
    water: '#102434',
    glow: '#84b9e4',
    accent: '#b0a9d3',
  },
  {
    name: 'Rdzeń głębin',
    subtitle: 'Ostatnie światło w głębinach',
    wall: '#364b59',
    water: '#091e2c',
    glow: '#70f0d5',
    accent: '#d0bb83',
  },
];
export const campaign = source.levels.map((l, index) => ({
  ...l,
  index,
  ...palettes[index],
  seed: 3554 + index * 2719,
}));
export const sourceData = source;
export function lootTier(depth: number) {
  return source.collectables.reduce(
    (tier, item, index) => (depth >= -item.MinDepth ? index : tier),
    0,
  );
}
export function upgradeValues(type: Upgrade) {
  return source.upgrades.find((u) => u.UpgradeType === type)!;
}
export function getStats(levels: Record<Upgrade, number>) {
  const val = (type: Upgrade) => upgradeValues(type).Value[levels[type]];
  return {
    speed: val('MaxSpeed') * 0.0024,
    acceleration: val('Acceleration') * 0.002,
    drag: 0.18 + val('Aerodynamics') * 0.0008,
    battery: val('Battery') / 3,
    sonar: val('Sonar') * 0.008,
  };
}
export interface Settings {
  volume: number;
  sensitivity: number;
  invertY: boolean;
  quality: 'low' | 'high';
}
export interface Save {
  version: 1;
  level: number;
  money: number;
  upgrades: Record<Upgrade, number>;
  won: boolean;
  runs: number;
  choices: number;
  bestDepth: number;
  settings: Settings;
}
export const freshSave = (): Save => ({
  version: 1,
  level: 0,
  money: 0,
  upgrades: { MaxSpeed: 0, Acceleration: 0, Aerodynamics: 0, Battery: 0, Sonar: 0 },
  won: false,
  runs: 0,
  choices: 0,
  bestDepth: 0,
  settings: { volume: 0.45, sensitivity: 1, invertY: false, quality: 'high' },
});
export function validateSave(raw: unknown): Save {
  const fresh = freshSave();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<Save>;
  if (r.version !== 1) return fresh;
  const finite = (n: unknown, fallback: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
  fresh.level = Math.floor(finite(r.level, 0, 4));
  fresh.money = Math.floor(finite(r.money, 0, 1e9));
  fresh.won = r.won === true;
  fresh.runs = Math.floor(finite(r.runs, 0, 1e7));
  fresh.choices = Math.floor(finite(r.choices, 0, 1e9));
  fresh.bestDepth = finite(r.bestDepth, 0, 1e7);
  for (const key of upgrades) fresh.upgrades[key] = Math.floor(finite(r.upgrades?.[key], 0, 4));
  fresh.settings = {
    volume: finite(r.settings?.volume, 0.45, 1),
    sensitivity: Math.max(0.2, finite(r.settings?.sensitivity, 1, 2.5)),
    invertY: r.settings?.invertY === true,
    quality: r.settings?.quality === 'low' ? 'low' : 'high',
  };
  return fresh;
}
