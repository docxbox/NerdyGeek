import { config } from "./config.js";
import { metrics } from "./metrics.js";
import { persistentStore } from "./store.js";
import type { NerdyGeekResponse } from "./types.js";

type CacheEntry<T extends NerdyGeekResponse> = {
  expiresAt: number;
  value: T;
};

export class SemanticCache<T extends NerdyGeekResponse = NerdyGeekResponse> {
  private readonly store = new Map<string, CacheEntry<T>>();

  getCache(key: string): T | null {
    const entry = this.store.get(key);

    if (entry) {
      if (Date.now() < entry.expiresAt) {
        metrics.increment("cache.hit.memory");
        return entry.value;
      }

      this.store.delete(key);
    }

    const persisted = persistentStore.getByKey<T>(key);
    if (persisted) {
      metrics.increment("cache.hit.persistent");
      this.store.set(key, {
        value: persisted,
        expiresAt: Date.now() + config.cacheTtlMs
      });
      return persisted;
    }

    metrics.increment("cache.miss");
    return null;
  }

  getByHandle(handle: string): T | null {
    const persisted = persistentStore.getByHandle<T>(handle);
    if (persisted) {
      metrics.increment("cache.hit.handle");
    } else {
      metrics.increment("cache.miss.handle");
    }
    return persisted;
  }

  setCache(key: string, value: T, ttlMs = config.cacheTtlMs): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
    persistentStore.set(key, value.docHandle, value, ttlMs);
  }
}

export const semanticCache = new SemanticCache();
