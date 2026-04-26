class MetricsRegistry {
    counters = new Map();
    timings = new Map();
    increment(name, delta = 1) {
        this.counters.set(name, (this.counters.get(name) ?? 0) + delta);
    }
    observe(name, durationMs) {
        const current = this.timings.get(name) ?? { count: 0, totalMs: 0 };
        current.count += 1;
        current.totalMs += durationMs;
        this.timings.set(name, current);
    }
    snapshot() {
        return {
            counters: Object.fromEntries(this.counters.entries()),
            timings: Object.fromEntries([...this.timings.entries()].map(([name, value]) => [
                name,
                {
                    count: value.count,
                    totalMs: Number(value.totalMs.toFixed(2)),
                    avgMs: Number((value.totalMs / Math.max(1, value.count)).toFixed(2))
                }
            ]))
        };
    }
}
export const metrics = new MetricsRegistry();
