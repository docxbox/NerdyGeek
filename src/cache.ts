import { config } from "./config.js";
import type { DocsResponse } from "./types.js";

type CacheEntry = {
  expiresAt: number;
  value: DocsResponse;
};

export class SemanticCache {
  private readonly store = new Map<string, CacheEntry>();

  getCache(key: string): DocsResponse | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  setCache(key: string, value: DocsResponse, ttlMs = config.cacheTtlMs): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
}

export const semanticCache = new SemanticCache();
