import { describe, it, expect } from 'vitest';
import { createApp } from '../../server/app';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { createServer } from 'node:http';

const event = {
  id: 'uuid:attempt:fork-0',
  bit: 1,
  timestamp_generation: '2026-10-28T12:00:00.123Z',
  metadata: {
    session_id: 'uuid',
    sequence: '1',
    game_time: 1,
    attempt: 1,
    type: 'fork',
    option: 'left',
    level: 1,
  },
};
async function session(app: ReturnType<typeof createApp>['app']) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { authorization: 'Bearer admin-test' },
    payload: { playerId: 'player-test', gameId: 'batyskaf', arm: 'alice' },
  });
  expect(response.statusCode).toBe(200);
  return response.json().token as string;
}
describe('portal bridge', () => {
  it('requires portal authentication and never sends the arm secret to browsers', async () => {
    const { app } = createApp({
      dbPath: ':memory:',
      adminKey: 'admin-test',
      arms: { alice: { url: 'http://arm.test/', apiKey: 'arm-secret' } },
      autoDrain: false,
    });
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/sessions',
            payload: { playerId: 'p', gameId: 'g', arm: 'alice' },
          })
        ).statusCode,
      ).toBe(401);
      const token = await session(app),
        response = await app.inject({
          url: '/api/session',
          headers: { authorization: `Bearer ${token}` },
        });
      expect(response.json().playerId).toBe('player-test');
      expect(response.body).not.toContain('arm-secret');
      expect(response.body).not.toContain('arm.test');
      expect(
        (await app.inject({ method: 'POST', url: '/api/choices', payload: event })).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
  it('deduplicates events durably and preserves generation time through retry and restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'batyskaf-test-')),
      dbPath = join(dir, 'queue.sqlite');
    let time = Date.now();
    const sent: { body: string; headers: Record<string, string> }[] = [];
    let status = 503;
    const fakeFetch = (async (_url, init) => {
      sent.push({ body: String(init!.body), headers: init!.headers as Record<string, string> });
      return new Response(null, { status });
    }) as typeof fetch;
    const options = {
      dbPath,
      adminKey: 'admin-test',
      arms: { alice: { url: 'http://arm.test/', apiKey: 'arm-secret' } },
      autoDrain: false,
      now: () => time,
      fetch: fakeFetch,
    };
    let { app, drain } = createApp(options);
    try {
      const token = await session(app),
        headers = { authorization: `Bearer ${token}` };
      expect(
        (await app.inject({ method: 'POST', url: '/api/choices', headers, payload: event }))
          .statusCode,
      ).toBe(202);
      expect(
        (await app.inject({ method: 'POST', url: '/api/choices', headers, payload: event })).json()
          .duplicate,
      ).toBe(true);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/choices',
            headers,
            payload: { ...event, bit: 0 },
          })
        ).statusCode,
      ).toBe(409);
      await drain();
      expect(sent).toHaveLength(1);
      expect((await app.inject({ url: '/api/delivery', headers })).json().pending).toBe(1);
      await app.close();
      ({ app, drain } = createApp(options));
      time += 1000;
      status = 204;
      await drain();
      expect(sent).toHaveLength(2);
      expect(sent[0].body).toBe(sent[1].body);
      expect(JSON.parse(sent[1].body).timestamp_generation).toBe(event.timestamp_generation);
      expect(sent[1].headers['X-API-Key']).toBe('arm-secret');
      expect(sent[1].headers['X-Player-ID']).toBe('player-test');
      expect(sent[1].headers['X-Game-ID']).toBe('batyskaf');
      expect((await app.inject({ url: '/api/delivery', headers })).json().delivered).toBe(1);
      await drain();
      expect(sent).toHaveLength(2);
    } finally {
      await app.close();
      if (
        !resolve(dir).startsWith(resolve(tmpdir()) + '\\') ||
        !basename(dir).startsWith('batyskaf-test-')
      )
        throw new Error('Unsafe temporary path');
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('rejects malformed bits and UTC timestamps; permanent failures remain blocked', async () => {
    const { app, drain } = createApp({
      dbPath: ':memory:',
      adminKey: 'admin-test',
      arms: { alice: { url: 'http://arm.test/', apiKey: 'k' } },
      autoDrain: false,
      fetch: (async () => new Response(null, { status: 401 })) as typeof fetch,
    });
    try {
      const token = await session(app),
        headers = { authorization: `Bearer ${token}` };
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/choices',
            headers,
            payload: { ...event, bit: 7 },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/choices',
            headers,
            payload: { ...event, timestamp_generation: 'yesterday' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/choices',
            headers,
            payload: { ...event, timestamp_generation: '2026-02-31T12:00:00Z' },
          })
        ).statusCode,
      ).toBe(400);
      await app.inject({ method: 'POST', url: '/api/choices', headers, payload: event });
      await drain();
      expect((await app.inject({ url: '/api/delivery', headers })).json().blocked).toBe(1);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/admin/retry-blocked',
            headers,
            payload: { arm: 'alice' },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/admin/retry-blocked',
            headers: { authorization: 'Bearer admin-test' },
            payload: { arm: 'alice' },
          })
        ).json().retried,
      ).toBe(1);
    } finally {
      await app.close();
    }
  });
  it('delivers the actual HTTP contract to a local arm receiver', async () => {
    const received: { headers: Record<string, unknown>; body: string }[] = [];
    const armServer = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        received.push({ headers: request.headers, body });
        response.writeHead(204);
        response.end();
      });
    });
    await new Promise<void>((resolve) => armServer.listen(0, '127.0.0.1', resolve));
    const port = (armServer.address() as { port: number }).port;
    const { app, drain } = createApp({
      dbPath: ':memory:',
      adminKey: 'admin-test',
      arms: { alice: { url: `http://127.0.0.1:${port}/bit`, apiKey: 'local-contract' } },
      autoDrain: false,
    });
    try {
      const token = await session(app);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/choices',
            headers: { authorization: `Bearer ${token}` },
            payload: event,
          })
        ).statusCode,
      ).toBe(202);
      await drain();
      expect(received).toHaveLength(1);
      expect(received[0].headers).toMatchObject({
        'x-game-id': 'batyskaf',
        'x-player-id': 'player-test',
        'x-api-key': 'local-contract',
        'content-type': 'application/json',
      });
      expect(JSON.parse(received[0].body)).toMatchObject({
        bit: 1,
        timestamp_generation: event.timestamp_generation,
        metadata: { event_id: event.id },
      });
    } finally {
      await app.close();
      await new Promise<void>((resolve, reject) =>
        armServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
