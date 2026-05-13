interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // ms
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private tokensPerInterval: number;
  private interval: number;

  constructor(opts: RateLimiterOptions) {
    this.tokensPerInterval = opts.tokensPerInterval;
    this.interval = opts.interval;
    this.tokens = opts.tokensPerInterval;
    this.lastRefill = Date.now();
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /** Block until a token is available (async-compatible). */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      await new Promise(r => setTimeout(r, this.msUntilNextToken()));
    }
  }

  msUntilNextToken(): number {
    this.refill();
    if (this.tokens > 0) return 0;
    return this.interval - (Date.now() - this.lastRefill);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.interval) {
      this.tokens = this.tokensPerInterval;
      this.lastRefill = now;
    }
  }
}