/** Local contract receiver. It never contacts the real experimental table. */
import Fastify from 'fastify';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const app = Fastify({ bodyLimit: 16384 });
const key = process.env.MOCK_ARM_API_KEY || 'local-test-only';
const directory = resolve('.local');
mkdirSync(directory, { recursive: true });
let count = 0;
app.post('/bit', async (request, reply) => {
  if (
    request.headers['x-api-key'] !== key ||
    !request.headers['x-game-id'] ||
    !request.headers['x-player-id']
  )
    return reply.code(401).send({ error: 'Missing arm headers' });
  const body = request.body as { bit?: number; timestamp_generation?: string } | undefined;
  if (!body || ![0, 1].includes(body.bit!) || !body.timestamp_generation)
    return reply.code(400).send({ error: 'Invalid bit' });
  appendFileSync(
    resolve(directory, 'mock-arm.jsonl'),
    JSON.stringify({
      received: new Date().toISOString(),
      gameId: request.headers['x-game-id'],
      playerId: request.headers['x-player-id'],
      ...body,
    }) + '\n',
  );
  console.log(`Odebrano bit ${++count}: ${body.bit} (${body.timestamp_generation})`);
  return reply.code(204).send();
});
await app.listen({ host: '127.0.0.1', port: Number(process.env.MOCK_ARM_PORT || 8790) });
console.log('Odbiornik testowy: http://127.0.0.1:8790/bit · zapis .local/mock-arm.jsonl');
