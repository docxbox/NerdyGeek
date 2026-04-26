import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { logger } from "./logger.js";
export class PersistentStore {
    filePath;
    byKey = new Map();
    byHandle = new Map();
    constructor(filePath = path.join(config.dataDir, "store.json")) {
        this.filePath = filePath;
        this.ensureLoaded();
    }
    getByKey(key) {
        const record = this.byKey.get(key);
        if (!record) {
            return null;
        }
        if (Date.now() >= record.expiresAt) {
            this.deleteRecord(record);
            this.flush();
            return null;
        }
        return record.value;
    }
    getByHandle(handle) {
        const record = this.byHandle.get(handle);
        if (!record) {
            return null;
        }
        if (Date.now() >= record.expiresAt) {
            this.deleteRecord(record);
            this.flush();
            return null;
        }
        return record.value;
    }
    set(key, handle, value, ttlMs) {
        const record = {
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
    snapshot() {
        this.cleanupExpired();
        return {
            records: [...this.byKey.values()]
        };
    }
    ensureLoaded() {
        const directory = path.dirname(this.filePath);
        fs.mkdirSync(directory, { recursive: true });
        if (!fs.existsSync(this.filePath)) {
            this.flush();
            return;
        }
        try {
            const raw = fs.readFileSync(this.filePath, "utf8");
            const state = JSON.parse(raw);
            for (const record of state.records ?? []) {
                if (Date.now() < record.expiresAt) {
                    this.byKey.set(record.key, record);
                    this.byHandle.set(record.handle, record);
                }
            }
        }
        catch (error) {
            logger.warn("Persistent store load failed, starting with empty store", {
                message: error instanceof Error ? error.message : "unknown"
            });
            this.byKey.clear();
            this.byHandle.clear();
            this.flush();
        }
    }
    cleanupExpired() {
        for (const record of [...this.byKey.values()]) {
            if (Date.now() >= record.expiresAt) {
                this.deleteRecord(record);
            }
        }
    }
    deleteRecord(record) {
        this.byKey.delete(record.key);
        this.byHandle.delete(record.handle);
    }
    flush() {
        this.cleanupExpired();
        const payload = JSON.stringify(this.snapshot(), null, 2);
        fs.writeFileSync(this.filePath, payload, "utf8");
    }
}
export const persistentStore = new PersistentStore();
