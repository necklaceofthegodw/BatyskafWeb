import './style.css';
import { GameCore } from './game/core';
import { Controls } from './game/input';
import { World } from './render/world';
import { Storage } from './services/storage';
import { Portal } from './services/portal';
import { Audio } from './services/audio';
import { Interface } from './ui/interface';

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!,
    root = document.querySelector<HTMLElement>('#ui')!;
  const portal = new Portal(Portal.tokenFromLocation());
  await portal.connect();
  const storage = new Storage(
    portal.session ? `player:${portal.session.gameId}:${portal.session.playerId}` : 'local',
    portal.session ? `session:${portal.session.id}` : 'local',
  );
  await storage.init();
  const save = await storage.load(),
    game = new GameCore(save),
    audio = new Audio();
  game.clock = () => portal.now();
  const summaryKey = portal.session ? `batyskaf-summary:${portal.session.id}` : null;
  if (summaryKey) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(summaryKey) || 'null');
      if (
        saved &&
        Number.isFinite(saved.maxDepth) &&
        saved.maxDepth >= 0 &&
        Number.isInteger(saved.maxLevel) &&
        saved.maxLevel >= 1 &&
        saved.maxLevel <= 5 &&
        Number.isFinite(saved.moneyEarned) &&
        saved.moneyEarned >= 0
      )
        Object.assign(game.summary, {
          maxDepth: saved.maxDepth,
          maxLevel: saved.maxLevel,
          moneyEarned: saved.moneyEarned,
        });
    } catch {
      /* Summary remains available in memory when browser storage is unavailable. */
    }
  }
  let lastSummary = '';
  const returnTimer = window.setInterval(() => portal.returnIfDue(), 250);
  portal.returnIfDue();
  const controls = new Controls(canvas, game, () => game.pause());
  const ui = new Interface(root, game, portal, storage, (action) => {
    if (action === 'capture') void controls.lock();
    if (action === 'release') controls.unlock();
    if (action === 'audio') void audio.unlock();
    if (action === 'save') void storage.saveSettings(game.save.settings);
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document.documentElement
          .requestFullscreen()
          .catch(() => game.notice('Pełny ekran jest niedostępny w tym osadzeniu.'));
    }
  });
  if (!portal.local && !portal.session) {
    clearInterval(returnTimer);
    ui.loading('Nie udało się potwierdzić sesji portalu. Odśwież link z portalu.');
    return;
  }
  if (portal.slotState === 'ended') {
    // A returning player should see their summary immediately, without loading 3D assets.
    ui.ready();
    ui.update(performance.now());
    const summaryTimer = window.setInterval(() => ui.update(performance.now()), 250);
    window.addEventListener(
      'pagehide',
      () => {
        clearInterval(returnTimer);
        clearInterval(summaryTimer);
        controls.dispose();
        audio.dispose();
        void storage.close();
      },
      { once: true },
    );
    return;
  }
  let world: World;
  try {
    world = new World(canvas, game);
    await world.load((text) => ui.loading(text));
  } catch (error) {
    ui.loading('Nie udało się uruchomić grafiki 3D. Sprawdź obsługę WebGL2 i odśwież stronę.');
    console.error(error);
    return;
  }
  ui.ready();
  portal.start(storage);
  if (storage.failed) game.notice('Trwały zapis jest niedostępny w tej przeglądarce.');
  if (world.loadErrors.length)
    game.notice('Część modeli nie została wczytana. Odśwież grę po sprawdzeniu połączenia.', 'bad');
  let previous = performance.now(),
    accumulator = 0,
    stopped = false;
  const tick = () => {
    if (stopped) return;
    portal.returnIfDue();
    const now = performance.now(),
      dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    if (portal.slotState !== 'active') {
      game.pause();
      controls.unlock();
      accumulator = 0;
    }
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      if (portal.slotState === 'active') game.step(1 / 60, controls.state);
      accumulator -= 1 / 60;
    }
    for (const event of game.events.splice(0)) {
      ui.event(event);
      world.event(event);
      if (['collect', 'charge', 'shot', 'impact'].includes(event.type)) audio.play(event.type);
      if (event.type === 'choice' && event.decision)
        void storage.record(event.decision).then(() => portal.flush(storage));
    }
    if (summaryKey) {
      const summary = JSON.stringify(game.summary);
      if (summary !== lastSummary) {
        try {
          sessionStorage.setItem(summaryKey, summary);
        } catch {
          /* Keep the in-memory summary. */
        }
        lastSummary = summary;
      }
    }
    world.update(dt);
    world.render();
    ui.update(now);
    audio.update(
      game.speed,
      game.phase === 'dive' || game.phase === 'oasis',
      game.save.settings.volume,
    );
  };
  world.engine.runRenderLoop(tick);
  const resize = () => world.resize();
  window.addEventListener('resize', resize);
  const visibility = () => {
    if (document.hidden) {
      game.pause();
      controls.clear();
      accumulator = 0;
    }
    previous = performance.now();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener(
    'pagehide',
    () => {
      stopped = true;
      clearInterval(returnTimer);
      portal.stop();
      controls.dispose();
      audio.dispose();
      void storage.close();
      world.dispose();
    },
    { once: true },
  );
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('diagnostics') === '1') {
    Object.assign(window, {
      __BATYSKAF_TEST__: {
        game,
        world,
        storage,
        portal,
        controls,
        ui,
        snapshot: () => ({
          phase: game.phase,
          level: game.save.level,
          battery: game.battery,
          money: game.save.money,
          choices: game.save.choices,
          progress: game.progress,
          position: game.position,
          ...world.metrics(),
        }),
      },
    });
  }
}
void main().catch((error) => {
  console.error(error);
  document.querySelector('#ui')!.textContent =
    'Nie udało się przygotować gry. Spróbuj odświeżyć stronę.';
});
