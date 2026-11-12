import type { Storage } from './storage';
export interface PortalSession {
  id: string;
  playerId: string;
  gameId: string;
  arm: 'alice' | 'bob';
  expiresAt: number;
  startAt?: number | null;
  endAt?: number | null;
  portalEndpoint?: string | null;
  serverTime?: number;
}

export class Portal {
  session: PortalSession | null = null;
  error = '';
  pending = 0;
  delivered = 0;
  private busy = false;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private clock?: { server: number; local: number };
  private returning = false;
  constructor(private token: string | null) {}
  get local() {
    return !this.token;
  }
  now() {
    return this.clock ? this.clock.server + performance.now() - this.clock.local : Date.now();
  }
  get slotState(): 'waiting' | 'active' | 'ended' {
    const s = this.session;
    if (!s) return this.local ? 'active' : 'waiting';
    if (this.now() >= Math.min(s.endAt != null ? s.endAt - 10000 : Infinity, s.expiresAt))
      return 'ended';
    return s.startAt != null && this.now() < s.startAt ? 'waiting' : 'active';
  }
  returnIfDue() {
    const s = this.session;
    if (!this.returning && s?.endAt != null && s.portalEndpoint && this.now() >= s.endAt) {
      this.returning = true;
      try {
        sessionStorage.removeItem('batyskaf-session');
      } catch {
        /* Navigation still works without storage. */
      }
      location.assign(s.portalEndpoint);
    }
  }
  static tokenFromLocation() {
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('session');
    if (token) {
      sessionStorage.setItem('batyskaf-session', token);
      history.replaceState(null, '', location.pathname + location.search);
    }
    return token || sessionStorage.getItem('batyskaf-session');
  }
  async connect() {
    if (!this.token) return;
    try {
      const response = await fetch('/api/session', {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(7000),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Sesja portalu jest niedostępna lub wygasła.');
      this.session = await response.json();
      if (this.session?.serverTime != null)
        this.clock = { server: this.session.serverTime, local: performance.now() };
    } catch (e) {
      this.error = (e as Error).message;
    }
  }
  async flush(storage: Storage) {
    if (this.busy) return;
    this.busy = true;
    try {
      const records = await storage.pending();
      this.pending = records.length;
      if (!this.token || !this.session) return;
      if (this.slotState !== 'active') return;
      for (const { delivered: _, profile: __, owner: ___, ...record } of records.slice(0, 40)) {
        if (this.slotState !== 'active') break;
        const response = await fetch('/api/choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify(record),
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) {
          this.error =
            response.status === 401
              ? 'Sesja portalu wygasła. Decyzje pozostają zapisane.'
              : 'Oczekiwanie na połączenie z portalem.';
          break;
        }
        // ACK means the portal durably accepted the record, not that Master performed an experiment.
        await storage.acknowledge(record.id);
        this.delivered++;
        this.pending--;
        this.error = '';
      }
    } catch {
      this.error = 'Brak połączenia. Decyzje pozostają w kolejce.';
    } finally {
      this.busy = false;
    }
  }
  start(storage: Storage) {
    this.stopped = false;
    const tick = async () => {
      await this.flush(storage);
      if (!this.stopped) this.timer = setTimeout(tick, 2500);
    };
    void tick();
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
