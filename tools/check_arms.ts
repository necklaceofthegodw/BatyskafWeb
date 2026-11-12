import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

await Promise.all(
  (['alice', 'bob'] as const).map(async (name) => {
    const endpoint = process.env[`ARM_${name.toUpperCase()}_URL`];
    if (!endpoint) {
      console.error(`${name}: brak adresu w konfiguracji`);
      process.exitCode = 1;
      return;
    }
    try {
      const health = new URL(endpoint);
      health.pathname = health.pathname.replace(/\/data\/?$/, '/health');
      health.search = '';
      health.hash = '';
      if (health.pathname === new URL(endpoint).pathname) {
        throw new Error('Adres odbiornika musi kończyć się /data');
      }
      const response = await fetch(health, { signal: AbortSignal.timeout(5000) });
      const body = (await response.text()).trim();
      if (response.status !== 200 || body !== 'ok') {
        throw new Error(`oczekiwano HTTP 200 i ok, otrzymano HTTP ${response.status}`);
      }
      console.log(`${name}: HTTP 200 · ok`);
    } catch (error) {
      console.error(`${name}: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }),
);
