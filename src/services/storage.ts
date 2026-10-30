import { openDB, type IDBPDatabase } from 'idb';
import { freshSave, validateSave, type Save, type Settings } from '../game/data';
import type { Decision } from '../game/core';

export interface StoredDecision extends Decision {
  delivered: boolean;
  profile: string;
  owner: string;
}
export class Storage {
  private db?: IDBPDatabase;
  private memory = new Map<string, StoredDecision>();
  private write = Promise.resolve();
  failed = false;
  constructor(
    readonly profile: string,
    readonly queueScope = profile,
  ) {}
  async init() {
    try {
      this.db = await openDB('batyskaf-web', 1, {
        upgrade(db) {
          db.createObjectStore('saves');
          db.createObjectStore('decisions', { keyPath: 'id' });
        },
      });
    } catch {
      this.failed = true;
    }
  }
  async load(): Promise<Save> {
    try {
      // Read preferences only, including from legacy saves. Never restore a campaign.
      const stored = await this.db?.get('saves', this.profile);
      const fresh = freshSave();
      fresh.settings = validateSave({ version: 1, settings: stored?.settings }).settings;
      // Replace this profile's legacy progress with preferences only.
      await this.saveSettings(fresh.settings);
      return fresh;
    } catch {
      this.failed = true;
      return freshSave();
    }
  }
  saveSettings(settings: Settings) {
    const snapshot = { settings: structuredClone(settings) };
    this.write = this.write
      .then(async () => {
        if (this.db) await this.db.put('saves', snapshot, this.profile);
      })
      .catch(() => {
        this.failed = true;
      });
    return this.write;
  }
  async record(event: Decision) {
    const record: StoredDecision = {
      ...event,
      delivered: false,
      profile: this.queueScope,
      owner: this.profile,
    };
    this.memory.set(record.id, record);
    try {
      if (this.db) {
        const tx = this.db.transaction('decisions', 'readwrite');
        if (!(await tx.store.get(record.id))) await tx.store.put(record);
        await tx.done;
      }
    } catch {
      this.failed = true;
    }
  }
  async pending() {
    try {
      if (this.db) {
        const all = new Map(
          ((await this.db.getAll('decisions')) as StoredDecision[]).map((r) => [r.id, r]),
        );
        for (const [id, record] of this.memory) if (!all.has(id)) all.set(id, record);
        return [...all.values()].filter((r) => r.profile === this.queueScope && !r.delivered);
      }
    } catch {
      this.failed = true;
    }
    return [...this.memory.values()].filter((r) => !r.delivered);
  }
  async acknowledge(id: string) {
    const mem = this.memory.get(id);
    if (mem) mem.delivered = true;
    try {
      if (this.db) {
        const record = (await this.db.get('decisions', id)) as StoredDecision | undefined;
        if (record) {
          record.delivered = true;
          await this.db.put('decisions', record);
        }
      }
    } catch {
      this.failed = true;
    }
  }
  async journal() {
    try {
      if (this.db)
        return ((await this.db.getAll('decisions')) as StoredDecision[]).filter(
          (r) => r.owner === this.profile || (!r.owner && r.profile === this.profile),
        );
    } catch {
      this.failed = true;
    }
    return [...this.memory.values()];
  }
  async close() {
    await this.write;
    this.db?.close();
  }
}
