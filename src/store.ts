import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { NerdyGeekResponse } from "./types.js";

type PersistedRecord = {
  key: string;
  handle: string;
  expiresAt: number;
  value: NerdyGeekResponse;
  updatedAt: string;
};

type PersistedState = {
  records: PersistedRecord[];
};

export class PersistentStore {
  private readonly filePath: string;
  private readonly byKey = new Map<string, PersistedRecord>();
  private readonly byHandle = new Map<string, PersistedRecord>();

  constructor(filePath = path.join(config.dataDir, "store.json")) {
    this.filePath = filePath;
    this.ensureLoaded();
  }

  getByKey<T extends NerdyGeekResponse>(key: string): T | null {
    const record = this.byKey.get(key);
    if (!record) {
      return null;
    }

    if (Date.now() >= record.expiresAt) {
      this.deleteRecord(record);
      this.flush();
      return null;
    }

    return record.value as T;
  }

  getByHandle<T extends NerdyGeekResponse>(handle: string): T | null {
    const record = this.byHandle.get(handle);
    if (!record) {
      return null;
    }

    if (Date.now() >= record.expiresAt) {
      this.deleteRecord(record);
      this.flush();
      return null;
    }

    return record.value as T;
  }

  set(key: string, handle: string, value: NerdyGeekResponse, ttlMs: number): void {
    const record: PersistedRecord = {
      key,
      handle,
      expiresAt: Date.now() + ttlMs,
      value,
      updatedAt: new Date().toISOString()
    };

    this.byKey.set(key, record);
    this.byHandle.set(handle, record);
    this.flush();
  }

  snapshot(): PersistedState {
    this.cleanupExpired();
    return {
      records: [...this.byKey.values()]
    };
  }

  private ensureLoaded(): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.flush();
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const state = JSON.parse(raw) as PersistedState;
      for (const record of state.records ?? []) {
        if (Date.now() < record.expiresAt) {
          this.byKey.set(record.key, record);
          this.byHandle.set(record.handle, record);
        }
      }
    } catch (error) {
      logger.warn("Persistent store load failed, starting with empty store", {
        message: error instanceof Error ? error.message : "unknown"
      });
      this.byKey.clear();
      this.byHandle.clear();
      this.flush();
    }
  }

  private cleanupExpired(): void {
    for (const record of [...this.byKey.values()]) {
      if (Date.now() >= record.expiresAt) {
        this.deleteRecord(record);
      }
    }
  }

  private deleteRecord(record: PersistedRecord): void {
    this.byKey.delete(record.key);
    this.byHandle.delete(record.handle);
  }

  private flush(): void {
    this.cleanupExpired();
    const payload = JSON.stringify(this.snapshot(), null, 2);
    fs.writeFileSync(this.filePath, payload, "utf8");
  }
}

export const persistentStore = new PersistentStore();
