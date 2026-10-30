import { submarineArt, startShape, speedDial } from './art';
import { GameCore, type GameEvent } from '../game/core';
import { upgrades, upgradeInfo, upgradeValues, freshSave, type Upgrade } from '../game/data';
import { direction, sub, norm, dot, clamp } from '../game/math';
import type { Portal } from '../services/portal';
import type { Storage } from '../services/storage';

export type Action = 'capture' | 'release' | 'audio' | 'save' | 'fullscreen';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const logo = `<svg viewBox="0 0 52 32" fill="none" aria-hidden="true"><path d="M7 12h26a8 8 0 0 1 0 16H7a8 8 0 0 1 0-16Z" stroke="currentColor" stroke-width="2"/><path d="M19 12V5h10V1M43 17l7-5v15l-7-5M9 28v3m23-3v3" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="20" r="3" stroke="currentColor"/><circle cx="27" cy="20" r="3" stroke="currentColor"/></svg>`;

export class Interface {
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private toastRoot: HTMLElement;
  private last = '';
  private updateTime = 0;
  private popup = '';
  private notices: { text: string; tone: string; until: number }[] = [];
  private map: HTMLCanvasElement;
  private compass: HTMLElement;
  constructor(
    readonly root: HTMLElement,
    readonly game: GameCore,
    private portal: Portal,
    private storage: Storage,
    private action: (action: Action) => void,
  ) {
    root.innerHTML = `<div id="screen-flash"></div><div id="hud" hidden>
      <div class="coins brass"><span class="coin-symbol" aria-hidden="true">$</span><strong><span id="money">0</span> $</strong></div>
      <div class="depth-record brass" aria-label="Największa osiągnięta głębokość"><small>MAX GŁĘBOKOŚĆ</small><strong><span id="best-depth">0</span> m</strong></div>
      <div class="stage"><span id="stage-number">Poziom 1 / 5</span><div class="stage-track"><i id="stage-progress"></i></div></div>
      <div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i><span id="target-hint"></span></div>
      <div id="guidance"><span id="guide-arrow">⌃</span><small id="guide-label">Do tunelu</small></div>
      <div class="base-prompt" id="base-prompt"><button data-action="launch" class="button primary">Zanurz się ↓</button><button data-action="shop" class="button secondary">Ulepszenia</button></div>
      <section class="instruments" aria-label="Prędkość i energia">
        <div class="battery brass" aria-label="Energia"><span class="battery-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M14 2 5 13h6l-1 9 9-12h-6z" fill="currentColor"/></svg></span><div class="battery-track"><i id="battery-bar"></i><strong id="battery-number">100%</strong></div></div>
        <div class="dial">${speedDial}<div class="speed-readout"><strong id="speed">0</strong><small>m/s</small></div></div>
        <span id="effect-label" hidden></span>
      </section>
      <section class="depth brass" aria-label="Głębokość"><strong><span id="depth">0</span><small> m</small></strong><div class="depth-scale">${Array.from({ length: 11 }, (_, i) => `<span style="top:${i * 10}%">${i}</span>`).join('')}<i id="depth-marker"></i></div><small class="scale-unit">km</small></section>
      <section class="navigation brass" aria-label="Mapa tunelu"><canvas id="minimap" width="210" height="130" aria-label="Schemat najbliższego odcinka"></canvas><span id="pair-number">Fragment 1 / 4</span></section>
      </div><div id="notices" aria-live="polite"></div><div id="overlay"></div><div id="loading"><div class="brand">${logo}<span>BATYSKAF</span></div><div class="loading-line"><i></i></div><p id="loading-text">Przygotowanie gry…</p></div>`;
    this.overlay = root.querySelector('#overlay')!;
    this.hud = root.querySelector('#hud')!;
    this.toastRoot = root.querySelector('#notices')!;
    this.map = root.querySelector('#minimap')!;
    this.compass = root.querySelector('#guidance')!;
    root.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (button && !button.disabled) this.handle(button.dataset.action!);
    });
    root.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.dataset.setting) return;
      const s = this.game.save.settings;
      if (input.dataset.setting === 'volume') s.volume = Number(input.value);
      if (input.dataset.setting === 'sensitivity') s.sensitivity = Number(input.value);
      if (input.dataset.setting === 'invertY') s.invertY = input.checked;
      if (input.dataset.setting === 'quality') s.quality = input.value === 'low' ? 'low' : 'high';
      this.action('save');
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.popup) {
        this.popup = '';
        this.last = '';
      }
    });
  }
  loading(text: string) {
    this.root.querySelector('#loading-text')!.textContent = text;
  }
  ready() {
    this.root.querySelector('#loading')!.remove();
    this.refresh();
  }
  private button(action: string, label: string, primary = false) {
    return `<button class="button ${primary ? 'primary' : 'secondary'}" data-action="${action}">${label}<span>↗</span></button>`;
  }
  private handle(action: string) {
    const g = this.game;
    if (action === 'rest') {
      g.start();
      g.phase = 'oasis';
    } else if (action === 'play') {
      g.start();
      this.action('audio');
    } else if (action === 'launch') {
      g.launch();
      this.action('audio');
      this.action('capture');
    } else if (action === 'pause') {
      g.pause();
      this.action('release');
    } else if (action === 'resume') {
      if (g.phase === 'shop') g.closeShop();
      else g.resume();
      this.popup = '';
      this.action('capture');
    } else if (action === 'shop') {
      if (g.phase === 'paused' && g.previousPhase === 'oasis') g.phase = 'oasis';
      g.openShop();
      this.action('release');
    } else if (action === 'base') {
      this.popup = '';
      g.returnToBase();
      this.action('release');
    } else if (action.startsWith('buy:')) {
      g.buy(action.slice(4) as Upgrade);
      this.last = '';
    } else if (action === 'settings' || action === 'help' || action === 'new') {
      this.popup = action;
      if (g.phase === 'oasis' || g.phase === 'dive') g.pause();
      this.action('release');
    } else if (action === 'back') this.popup = '';
    else if (action === 'reset') {
      const settings = g.save.settings;
      g.save = freshSave();
      g.save.settings = settings;
      this.popup = '';
      this.action('save');
      g.start();
      this.action('audio');
      this.action('capture');
    } else if (action === 'fullscreen') this.action('fullscreen');
    else if (action === 'journal') void this.exportJournal();
    this.last = '';
    this.refresh();
  }
  private async exportJournal() {
    const records = await this.storage.journal(),
      blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'batyskaf-decyzje.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  event(e: GameEvent) {
    if (e.type === 'notice' && e.text)
      this.notices.push({ text: e.text, tone: e.tone || 'info', until: performance.now() + 4300 });
  }
  refresh() {
    const g = this.game,
      signature = `${g.phase}/${this.popup}/${g.save.money}/${Object.values(g.save.upgrades).join()}`;
    this.hud.hidden = this.popup !== '' || !['oasis', 'dive'].includes(g.phase);
    this.toastRoot.hidden = this.hud.hidden;
    if (signature === this.last) return;
    this.last = signature;
    const frame = (content: string, cls = '') =>
      `<div class="veil"><section class="panel ${cls}">${content}</section></div>`;
    if (this.popup === 'settings') {
      const s = g.save.settings;
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">TWÓJ BATYSKAF</span><h2>Ustawienia</h2><p>Dostosuj obraz, dźwięk i sterowanie.</p><label class="setting">Głośność<input data-setting="volume" aria-label="Głośność" type="range" min="0" max="1" step=".05" value="${s.volume}"></label><label class="setting">Czułość myszy<input data-setting="sensitivity" aria-label="Czułość myszy" type="range" min=".2" max="2.5" step=".1" value="${s.sensitivity}"></label><label class="setting">Jakość obrazu<select data-setting="quality" aria-label="Jakość obrazu"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>Wysoka</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Oszczędna</option></select></label><label class="setting">Odwróć oś pionową myszy<input data-setting="invertY" type="checkbox" ${s.invertY ? 'checked' : ''}></label><div class="panel-actions">${this.button('back', 'Wróć')}${this.button('fullscreen', 'Pełny ekran')}</div>`,
      );
    } else if (this.popup === 'help') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">PRZED ZANURZENIEM</span><h2>Poznaj swój batyskaf</h2><div class="help-grid"><kbd>W</kbd><span>Przytrzymaj, żeby uruchomić napęd. Po puszczeniu pojazd płynie siłą rozpędu.</span><kbd>MYSZ</kbd><span>Wyznacza kierunek. Kółkiem zmienisz odległość kamery.</span><kbd>A / D</kbd><span>Skręcaj w lewo lub w prawo. Działają też strzałki ← i →.</span><kbd>↑ / ↓</kbd><span>Kieruj batyskaf w górę lub w dół. Możesz sterować samą klawiaturą.</span><kbd>S / SPACJA</kbd><span>Hamuj przed zakrętem lub zamkniętą przesłoną.</span><kbd>F</kbd><span>Przytrzymaj, żeby wycelować. Puść, żeby wystrzelić rakietę.</span><kbd>ESC</kbd><span>Wstrzymaj wyprawę i uwolnij kursor.</span></div><p>Łup przed pojazdem zbierasz automatycznie. Węgorze odnawiają energię. Gdy bateria się wyczerpie, wracasz do oazy z zebranymi pieniędzmi.</p>${this.button('back', 'Rozumiem', true)}`,
        'wide',
      );
    } else if (this.popup === 'new') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">NOWA EKSPEDYCJA</span><h2>Zacząć od początku?</h2><p>Rozpoczniesz od pierwszego etapu bez pieniędzy i ulepszeń. Zapisana historia decyzji pozostanie zachowana.</p><div class="panel-actions">${this.button('back', 'Zachowaj postęp')}${this.button('reset', 'Nowa gra', true)}</div>`,
      );
    } else if (g.phase === 'menu') {
      this.overlay.innerHTML = `<main class="main-menu" data-version="0.11"><h1>BATYSKAF</h1><div class="menu-submarine">${submarineArt}</div><button class="submarine-start" data-action="play" aria-label="Rozpocznij wyprawę">${startShape}<span>Graj</span></button><nav class="menu-links" aria-label="Menu gry"><button data-action="settings">Ustawienia</button><button data-action="help">Jak grać</button></nav></main>`;
    } else if (g.phase === 'paused') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">CHWILA ODDECHU</span><h2>Wyprawa wstrzymana</h2><p>${esc(g.level.name)} · Energia ${Math.ceil((g.battery / g.stats.battery) * 100)}%</p><div class="stack">${this.button('resume', 'Wracaj do głębin', true)}${this.button('settings', 'Ustawienia')}${this.button('help', 'Sterowanie')}${g.previousPhase === 'oasis' ? this.button('launch', 'Zanurz się') + this.button('shop', 'Ulepszenia') : this.button('base', 'Wróć do oazy')}</div>`,
      );
    } else if (g.phase === 'shop') {
      this.overlay.innerHTML = frame(
        `<div class="shop-heading"><span class="shop-money">${g.save.money.toLocaleString('pl-PL')} $</span><h2>Ulepszenia</h2><button data-action="resume" class="close-button" aria-label="Zamknij ulepszenia">×</button></div><div class="upgrades">${upgrades
          .map((type) => {
            const info = upgradeInfo[type],
              level = g.save.upgrades[type],
              row = upgradeValues(type),
              cost = row.Cost[level];
            const names = {
              MaxSpeed: 'Prędkość',
              Acceleration: 'Przyspieszenie',
              Aerodynamics: 'Opór kadłuba',
              Battery: 'Pojemność baterii',
              Sonar: 'Zasięg sonaru',
            };
            const value = (n: number) =>
              (type === 'Battery' ? n / 3 : n).toLocaleString('pl-PL', {
                maximumFractionDigits: 1,
              });
            return `<article class="upgrade"><div class="upgrade-icon" aria-hidden="true">${info.icon}</div><div class="upgrade-description"><h3>${names[type]}</h3><div class="upgrade-levels" aria-label="Poziom ${level} z 4">${[1, 2, 3, 4].map((l) => `<i class="${level >= l ? 'filled' : ''}"></i>`).join('')}<span>${level}/4</span></div></div><button class="buy-button" data-action="buy:${type}" aria-label="Kup: ${names[type]}, ${cost ?? 0} dolarów" ${level >= 4 || g.save.money < cost ? 'disabled' : ''}>${level >= 4 ? 'Maks.' : cost + ' $'}</button><div class="upgrade-values"><span>${value(row.Value[level])}</span>${level < 4 ? `<span aria-hidden="true">→</span><strong>${value(row.Value[level + 1])}</strong>` : '<small>Maksimum</small>'}</div></article>`;
          })
          .join('')}</div>`,
        'shop',
      );
    } else if (g.phase === 'return') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">${g.returnReason === 'battery' ? 'SYSTEM RATUNKOWY' : 'POWRÓT DO BAZY'}</span><h2>Wracamy na powierzchnię.</h2><p>${g.completed ? `Poziom ${g.completedLevel} ukończony! Nagroda: +${g.completionReward} ◈. ` : g.returnReason === 'battery' ? 'Energia się wyczerpała. ' : ''}Pieniądze i ulepszenia zostają z Tobą.</p><div class="return-stats"><div><strong>◈ ${g.runLoot}</strong><small>ZEBRANY ŁUP</small></div></div><div class="loading-line"><i></i></div>`,
        'return-panel',
      );
    } else if (g.phase === 'stageComplete') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">POWRÓT NA POWIERZCHNIĘ</span><h2>Poziom ${g.completedLevel} ukończony!</h2><p>Nagroda za ukończenie: +${g.completionReward} ◈.</p><p>Odblokowano poziom ${g.save.level + 1}: ${esc(g.level.name)}. Czeka na Ciebie ${g.layout.fragments.length} fragmentów i fragment końcowy.</p><div class="return-stats"><div><strong>◈ ${g.runLoot}</strong><small>ZEBRANY ŁUP</small></div></div><div class="stack">${this.button('launch', `Rozpocznij poziom ${g.save.level + 1}`, true)}${this.button('play', 'Zostań w oazie')}</div>`,
      );
    } else if (g.phase === 'won') {
      this.overlay.innerHTML = frame(
        `<span class="eyebrow">EKSPEDYCJA ZAKOŃCZONA</span><h2>Gratulacje, wygrywasz!</h2><p>Wszystkie pięć etapów za Tobą.${g.completionReward ? ` Nagroda za ukończenie: +${g.completionReward} ◈.` : ''} Każdy wybór był częścią tej podróży.</p><div class="return-stats"><div><strong>${Math.round(g.save.bestDepth)} m</strong><small>NAJWIĘKSZA GŁĘBOKOŚĆ</small></div></div><div class="stack">${this.button('rest', 'Odpocznij w oazie', true)}${this.button('new', 'Nowa ekspedycja')}</div>`,
      );
    } else this.overlay.innerHTML = '';
    if (this.overlay.innerHTML) this.action('release');
  }
  update(now: number) {
    this.root.classList.toggle(
      'in-tunnel',
      this.game.position.y < -1 && this.game.phase !== 'menu',
    );
    this.refresh();
    const g = this.game;
    (this.root.querySelector('#screen-flash') as HTMLElement).style.opacity = String(
      g.hitFlash * 0.6,
    );
    this.notices = this.notices.filter((n) => n.until > now).slice(-3);
    const html = this.notices
      .map((n) => `<div class="notice ${n.tone}"><i></i>${esc(n.text)}</div>`)
      .join('');
    if (this.toastRoot.innerHTML !== html) this.toastRoot.innerHTML = html;
    if (now - this.updateTime < 100) return;
    this.updateTime = now;
    const text = (id: string, value: string) => {
      this.root.querySelector(`#${id}`)!.textContent = value;
    };
    const battery = clamp(g.battery / g.stats.battery, 0, 1);
    text('money', g.save.money.toLocaleString('pl-PL'));
    text('depth', Math.round(g.depth).toLocaleString('pl-PL'));
    text('best-depth', Math.round(g.save.bestDepth).toLocaleString('pl-PL'));
    text('speed', g.speed.toFixed(1));
    text('battery-number', `${Math.ceil(battery * 100)}%`);
    text('stage-number', `Poziom ${g.save.level + 1} / 5`);
    text(
      'pair-number',
      g.phase === 'oasis'
        ? 'OAZA'
        : g.inFinish
          ? 'ZBIERZ DIAMENT'
          : `FRAGMENT ${g.fragmentNumber} / ${g.layout.fragments.length}`,
    );
    const bar = this.root.querySelector<HTMLElement>('#battery-bar')!;
    bar.style.width = `${battery * 100}%`;
    bar.style.background = battery < 0.2 ? '#d96745' : '#6cbd54';
    this.root.querySelector<HTMLElement>('#stage-progress')!.style.width = `${g.progress * 100}%`;
    this.root.querySelector<SVGGElement>('#speed-needle')!.style.transform =
      `rotate(${-120 + 240 * clamp(g.speed / g.stats.speed, 0, 1)}deg)`;
    this.root.querySelector<HTMLElement>('#depth-marker')!.style.top =
      `${clamp(g.depth / 10000, 0, 1) * 100}%`;
    this.root.querySelector<HTMLElement>('#effect-label')!.hidden =
      !g.effects.length && battery >= 0.2;
    text(
      'effect-label',
      g.effects.length
        ? `${g.effects.length} aktywne efekty · ${Math.ceil(Math.max(...g.effects.map((e) => e.remaining)))} s`
        : battery < 0.2
          ? 'Niski poziom energii'
          : 'Systemy gotowe',
    );
    this.root.querySelector<HTMLElement>('#base-prompt')!.hidden =
      g.phase !== 'oasis' || g.save.won;
    const crosshair = this.root.querySelector<HTMLElement>('#crosshair')!;
    crosshair.classList.toggle('aiming', g.aim);
    crosshair.classList.toggle('target', !!g.targetId);
    text('target-hint', g.aim && g.targetId ? 'PUŚĆ F · STRZAŁ' : '');
    const target = norm(sub(g.guidance(), g.position)),
      forward = direction(g.yaw, 0),
      side = target.x * forward.z - target.z * forward.x;
    this.root.querySelector<HTMLElement>('#guide-arrow')!.style.transform =
      `rotate(${Math.atan2(side, dot(target, forward))}rad)`;
    text('guide-label', g.phase === 'oasis' ? 'Do tunelu' : g.inFinish ? 'Do oazy' : 'Dalej');
    this.compass.hidden = g.phase !== 'dive' && g.phase !== 'oasis';
    this.drawMap();
  }
  private drawMap() {
    const ctx = this.map.getContext('2d')!,
      g = this.game;
    ctx.clearRect(0, 0, 210, 130);
    ctx.strokeStyle = '#8cb4b118';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 210; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 130);
      ctx.stroke();
    }
    for (let y = 0; y <= 130; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(210, y);
      ctx.stroke();
    }
    const routes = g.layout.routes.filter((r) => Math.abs(r.pair - g.pair) <= 1),
      center = g.phase === 'oasis' ? { x: 0, y: 0, z: 0 } : g.position;
    const point = (p: { x: number; z: number }) => [
      105 + (p.x - center.x) * 0.65,
      80 - (p.z - center.z) * 0.65,
    ];
    if (g.phase === 'oasis') {
      ctx.strokeStyle = '#9dcbb8';
      ctx.beginPath();
      ctx.arc(105, 80, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else
      for (const route of routes) {
        ctx.strokeStyle = route.pair === g.pair ? '#8cbca9' : '#68867b55';
        ctx.lineWidth = 3;
        ctx.beginPath();
        route.path.forEach((p, i) => {
          const [x, y] = point(p);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    ctx.save();
    const [x, y] = point(g.position);
    ctx.translate(x, y);
    ctx.rotate(g.yaw);
    ctx.fillStyle = '#e5c78d';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
