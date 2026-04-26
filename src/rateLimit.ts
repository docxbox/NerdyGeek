type WindowEntry = {
  startedAt: number;
  count: number;
};

export class FixedWindowRateLimiter {
  private readonly store = new Map<string, WindowEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  allow(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const current = this.store.get(key);

    if (!current || now - current.startedAt >= this.windowMs) {
      this.store.set(key, { startedAt: now, count: 1 });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: Math.max(0, this.windowMs - (now - current.startedAt))
      };
    }

    current.count += 1;
    this.store.set(key, current);
    return { allowed: true, retryAfterMs: 0 };
  }
}
