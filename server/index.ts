import { createApp, type Arm } from './app';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const arms: Partial<Record<'alice' | 'bob', Arm>> = {};
for (const name of ['alice', 'bob'] as const) {
  const prefix = `ARM_${name.toUpperCase()}`,
    url = process.env[`${prefix}_URL`],
    apiKey = process.env[`${prefix}_API_KEY`];
  if (url && apiKey) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new Error('Arm endpoint must use HTTP(S)');
    arms[name] = { url, apiKey };
  }
}
const { app } = createApp({
  dbPath: process.env.BATYSKAF_DB || resolve('.local/portal.sqlite'),
  adminKey: process.env.PORTAL_ADMIN_KEY,
  arms,
  distPath: resolve('dist'),
});
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 8787) });
console.log(`Batyskaf: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8787}`);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
