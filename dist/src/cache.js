import { config } from "./config.js";
export class SemanticCache {
    store = new Map();
    getCache(key) {
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
    setCache(key, value, ttlMs = config.cacheTtlMs) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }
}
export const semanticCache = new SemanticCache();
