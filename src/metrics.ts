type MetricsSnapshot = {
  counters: Record<string, number>;
  timings: Record<string, { count: number; totalMs: number; avgMs: number }>;
};

class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly timings = new Map<string, { count: number; totalMs: number }>();

  increment(name: string, delta = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + delta);
  }

  observe(name: string, durationMs: number): void {
    const current = this.timings.get(name) ?? { count: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    this.timings.set(name, current);
  }

  snapshot(): MetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters.entries()),
      timings: Object.fromEntries(
        [...this.timings.entries()].map(([name, value]) => [
          name,
          {
            count: value.count,
            totalMs: Number(value.totalMs.toFixed(2)),
            avgMs: Number((value.totalMs / Math.max(1, value.count)).toFixed(2))
          }
        ])
      )
    };
  }
}

export const metrics = new MetricsRegistry();
