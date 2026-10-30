import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface Arm {
  url: string;
  apiKey: string;
}
export interface ServerOptions {
  dbPath?: string;
  adminKey?: string;
  arms?: Partial<Record<'alice' | 'bob', Arm>>;
  distPath?: string;
  fetch?: typeof fetch;
  now?: () => number;
  autoDrain?: boolean;
}
interface SessionRow {
  id: string;
  token_hash: string;
  player_id: string;
  game_id: string;
  arm: 'alice' | 'bob';
  expires_at: number;
}
interface ChoiceRow {
  id: string;
  session_id: string;
  payload: string;
  fingerprint: string;
  endpoint: string;
  status: string;
  attempts: number;
  next_attempt: number;
  created_at: number;
  last_error: string;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const secretEqual = (a: string, b: string) => {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
export function createApp(options: ServerOptions = {}) {
  const app = Fastify({ bodyLimit: 16 * 1024, requestTimeout: 15000, logger: false });
  const path = options.dbPath || resolve('.local/portal.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, player_id TEXT NOT NULL, game_id TEXT NOT NULL, arm TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS choices (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), payload TEXT NOT NULL, fingerprint TEXT NOT NULL, endpoint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_error TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS choices_queue ON choices(status, next_attempt);`);
  const arms = options.arms || {},
    now = options.now || Date.now,
    send = options.fetch || fetch;
  let draining = false;
  const authorize = (header: string | undefined): SessionRow | null => {
    if (!header?.startsWith('Bearer ') || header.length > 200) return null;
    const s = db
      .prepare('SELECT * FROM sessions WHERE token_hash = ?')
      .get(hash(header.slice(7))) as unknown as SessionRow | undefined;
    return s && s.expires_at > now() ? s : null;
  };
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('Referrer-Policy', 'no-referrer').header('X-Content-Type-Options', 'nosniff');
    return payload;
  });
  app.get('/api/health', async () => ({
    ok: true,
    service: 'batyskaf-portal',
    configuredArms: Object.keys(arms),
  }));
  app.post<{
    Body: { playerId: string; gameId: string; arm: 'alice' | 'bob'; ttlSeconds?: number };
  }>(
    '/api/sessions',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['playerId', 'gameId', 'arm'],
          properties: {
            playerId: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
              pattern: '^[^\\r\\n\\x00-\\x1f]+$',
            },
            gameId: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
              pattern: '^[^\\r\\n\\x00-\\x1f]+$',
            },
            arm: { type: 'string', enum: ['alice', 'bob'] },
            ttlSeconds: { type: 'integer', minimum: 60, maximum: 86400 },
          },
        },
      },
    },
    async (request, reply) => {
      const key = options.adminKey;
      if (!key || !secretEqual(request.headers.authorization || '', `Bearer ${key}`))
        return reply.code(401).send({ error: 'Portal authorization required' });
      const b = request.body;
      if (!arms[b.arm]?.url || !arms[b.arm]?.apiKey)
        return reply.code(503).send({ error: 'Arm not configured' });
      const token = randomBytes(32).toString('base64url'),
        id = randomUUID(),
        expiresAt = now() + (b.ttlSeconds || 7200) * 1000;
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        hash(token),
        b.playerId,
        b.gameId,
        b.arm,
        expiresAt,
      );
      reply.header('Cache-Control', 'no-store');
      return { token, expiresAt, launchFragment: `#session=${token}` };
    },
  );
  app.get('/api/session', async (request, reply) => {
    const s = authorize(request.headers.authorization);
    if (!s) return reply.code(401).send({ error: 'Session expired or invalid' });
    reply.header('Cache-Control', 'no-store');
    return {
      id: s.id,
      playerId: s.player_id,
      gameId: s.game_id,
      arm: s.arm,
      expiresAt: s.expires_at,
    };
  });
  app.post<{
    Body: {
      id: string;
      bit: 0 | 1;
      timestamp_generation: string;
      metadata: Record<string, unknown>;
    };
  }>(
    '/api/choices',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'bit', 'timestamp_generation', 'metadata'],
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 256 },
            bit: { type: 'integer', enum: [0, 1] },
            timestamp_generation: { type: 'string', minLength: 20, maxLength: 40 },
            metadata: {
              type: 'object',
              additionalProperties: false,
              required: [
                'session_id',
                'sequence',
                'game_time',
                'attempt',
                'type',
                'option',
                'level',
              ],
              properties: {
                session_id: { type: 'string', minLength: 1, maxLength: 100 },
                sequence: { type: 'string', maxLength: 30, pattern: '^[0-9]+$' },
                game_time: { type: 'number', minimum: 0, maximum: 1e9 },
                attempt: { type: 'integer', minimum: 0, maximum: 1e7 },
                type: { type: 'string', minLength: 1, maxLength: 40 },
                option: { type: 'string', maxLength: 80 },
                level: { type: 'integer', minimum: 1, maximum: 5 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const session = authorize(request.headers.authorization);
      if (!session) return reply.code(401).send({ error: 'Session expired or invalid' });
      const b = request.body;
      if (
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(b.timestamp_generation) ||
        !Number.isFinite(Date.parse(b.timestamp_generation))
      )
        return reply.code(400).send({ error: 'UTC generation timestamp required' });
      if (
        new Date(b.timestamp_generation).toISOString().replace(/\.0+Z$/, 'Z') !==
        b.timestamp_generation
          .replace(/\.(\d{1,3})Z$/, (_, n: string) => '.' + n.padEnd(3, '0') + 'Z')
          .replace(/\.0+Z$/, 'Z')
      )
        return reply.code(400).send({ error: 'Invalid calendar timestamp' });
      const arm = arms[session.arm];
      if (!arm) return reply.code(503).send({ error: 'Arm unavailable' });
      const metadata = Object.fromEntries(
        Object.entries(b.metadata).sort(([a], [b]) => a.localeCompare(b)),
      );
      const payload = JSON.stringify({
        bit: b.bit,
        timestamp_generation: b.timestamp_generation,
        metadata: { ...metadata, event_id: b.id },
      });
      const id = `${session.id}:${b.id}`,
        fingerprint = hash(payload),
        existing = db.prepare('SELECT fingerprint, status FROM choices WHERE id = ?').get(id) as
          { fingerprint: string; status: string } | undefined;
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          return reply.code(409).send({ error: 'Event ID already used with different contents' });
        return { id: b.id, accepted: true, status: existing.status, duplicate: true };
      }
      db.prepare(
        'INSERT INTO choices (id,session_id,payload,fingerprint,endpoint,created_at) VALUES (?,?,?,?,?,?)',
      ).run(id, session.id, payload, fingerprint, arm.url, now());
      reply.code(202);
      return { id: b.id, accepted: true, status: 'pending' };
    },
  );
  app.get('/api/delivery', async (request, reply) => {
    const s = authorize(request.headers.authorization);
    if (!s) return reply.code(401).send({ error: 'Session expired or invalid' });
    const rows = db
      .prepare('SELECT status, COUNT(*) AS count FROM choices WHERE session_id = ? GROUP BY status')
      .all(s.id) as { status: string; count: number }[];
    reply.header('Cache-Control', 'no-store');
    return Object.fromEntries(rows.map((r) => [r.status, r.count]));
  });
  app.post<{ Body: { arm: 'alice' | 'bob' } }>(
    '/api/admin/retry-blocked',
    {
      schema: {
        body: {
          type: 'object',
          required: ['arm'],
          additionalProperties: false,
          properties: { arm: { type: 'string', enum: ['alice', 'bob'] } },
        },
      },
    },
    async (request, reply) => {
      if (
        !options.adminKey ||
        !secretEqual(request.headers.authorization || '', `Bearer ${options.adminKey}`)
      )
        return reply.code(401).send({ error: 'Portal authorization required' });
      const arm = arms[request.body.arm];
      if (!arm) return reply.code(503).send({ error: 'Arm not configured' });
      const result = db
        .prepare(
          "UPDATE choices SET status='pending',attempts=0,next_attempt=0,last_error='',endpoint=? WHERE status='blocked' AND session_id IN (SELECT id FROM sessions WHERE arm=?)",
        )
        .run(arm.url, request.body.arm);
      return { retried: Number(result.changes) };
    },
  );
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      const rows = db
        .prepare(
          "SELECT * FROM choices WHERE status='pending' AND next_attempt <= ? ORDER BY created_at, rowid LIMIT 16",
        )
        .all(now()) as unknown as ChoiceRow[];
      for (const row of rows) {
        const s = db
          .prepare('SELECT * FROM sessions WHERE id = ?')
          .get(row.session_id) as unknown as SessionRow;
        const arm = arms[s.arm];
        if (!arm) continue;
        if (row.endpoint !== arm.url) {
          db.prepare(
            "UPDATE choices SET status='blocked',last_error='Endpoint changed' WHERE id=?",
          ).run(row.id);
          continue;
        }
        try {
          const response = await send(row.endpoint, {
            method: 'POST',
            redirect: 'error',
            headers: {
              'Content-Type': 'application/json',
              'X-Game-ID': s.game_id,
              'X-Player-ID': s.player_id,
              'X-API-Key': arm.apiKey,
            },
            body: row.payload,
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            db.prepare("UPDATE choices SET status='delivered',last_error='' WHERE id=?").run(
              row.id,
            );
          } else {
            const retry =
              response.status >= 500 || response.status === 408 || response.status === 429;
            db.prepare(
              'UPDATE choices SET status=?,attempts=attempts+1,next_attempt=?,last_error=? WHERE id=?',
            ).run(
              retry ? 'pending' : 'blocked',
              now() + Math.min(30000, 500 * 2 ** Math.min(row.attempts, 6)),
              `HTTP ${response.status}`,
              row.id,
            );
          }
          await response.body?.cancel();
        } catch {
          db.prepare(
            'UPDATE choices SET attempts=attempts+1,next_attempt=?,last_error=? WHERE id=?',
          ).run(
            now() + Math.min(30000, 500 * 2 ** Math.min(row.attempts, 6)),
            'Network error',
            row.id,
          );
        }
      }
    } finally {
      draining = false;
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined,
    closing = false;
  if (options.autoDrain !== false) {
    const tick = async () => {
      if (closing) return;
      await drain();
      if (!closing) {
        timer = setTimeout(tick, 500);
        timer.unref();
      }
    };
    app.addHook('onReady', async () => {
      timer = setTimeout(tick, 10);
      timer.unref();
    });
  }
  app.addHook('onClose', async () => {
    closing = true;
    if (timer) clearTimeout(timer);
    while (draining) await new Promise((resolve) => setTimeout(resolve, 20));
    db.close();
  });
  if (options.distPath && existsSync(options.distPath))
    void app.register(fastifyStatic, { root: resolve(options.distPath), maxAge: '1h' });
  return { app, drain };
}
