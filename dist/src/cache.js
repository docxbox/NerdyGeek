import { config } from "./config.js";
import { metrics } from "./metrics.js";
import { persistentStore } from "./store.js";
export class SemanticCache {
    store = new Map();
    getCache(key) {
        const entry = this.store.get(key);
        if (entry) {
            if (Date.now() < entry.expiresAt) {
                metrics.increment("cache.hit.memory");
                return entry.value;
            }
            this.store.delete(key);
        }
        const persisted = persistentStore.getByKey(key);
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
    getByHandle(handle) {
        const persisted = persistentStore.getByHandle(handle);
        if (persisted) {
            metrics.increment("cache.hit.handle");
        }
        else {
            metrics.increment("cache.miss.handle");
        }
        return persisted;
    }
    setCache(key, value, ttlMs = config.cacheTtlMs) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
        persistentStore.set(key, value.docHandle, value, ttlMs);
    }
}
export const semanticCache = new SemanticCache();
