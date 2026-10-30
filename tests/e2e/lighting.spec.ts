import { test, expect } from '@playwright/test';

test('tunnel walls stay bright in both directions without any real-time lights', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?diagnostics=1');
  await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).waitFor({ timeout: 45000 });
  const samples = await page.evaluate(async () => {
    const { game, world } = (window as any).__BATYSKAF_TEST__;
    world.engine.stopRenderLoop();
    const samples: { level: number; quality: string; angle: number; mean: number; dark: number }[] =
      [];
    const target = document.createElement('canvas');
    target.width = 240;
    target.height = 150;
    const ctx = target.getContext('2d')!;
    for (let level = 0; level < 5; level++)
      for (const quality of ['high', 'low'])
        for (const angle of [0, Math.PI]) {
          game.save.level = level;
          game.save.settings.quality = quality;
          game.launch();
          const route = game.layout.routes.find((r: any) => r.kind === 'connector');
          const i = Math.floor(route.path.length * 0.42),
            a = route.path[i],
            b = route.path[i + 1];
          game.position = { ...a };
          game.yaw = Math.atan2(b.x - a.x, b.z - a.z) + angle;
          game.pitch = angle ? 0 : Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
          game.pause();
          world.update(0);
          // Isolate the surfaces under test: a closed disc can fill the whole
          // camera when looking back, and actors use the room's uniform light.
          world.entities.forEach((root: any) => root.setEnabled(false));
          world.boat.setEnabled(false);
          world.scene.lights.forEach((light: any) => (light.intensity = 0));
          await world.scene.whenReadyAsync();
          world.render();
          ctx.drawImage(world.canvas, 0, 0, 240, 150);
          const pixels = ctx.getImageData(0, 0, 240, 150).data;
          let sum = 0,
            count = 0,
            dark = 0;
          for (let y = 30; y < 130; y++)
            for (let x = 20; x < 220; x++) {
              if (x > 76 && x < 164) continue; // Exclude the submarine and central hazards.
              const p = (y * 240 + x) * 4;
              const value = pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722;
              sum += value;
              count++;
              if (value < 95) dark++;
            }
          samples.push({ level, quality, angle, mean: sum / count, dark: dark / count });
        }
    return samples;
  });
  for (const sample of samples) {
    expect(sample.mean, JSON.stringify(sample)).toBeGreaterThan(145);
    expect(sample.dark, JSON.stringify(sample)).toBeLessThan(0.08);
  }
  expect(errors).toEqual([]);
});
