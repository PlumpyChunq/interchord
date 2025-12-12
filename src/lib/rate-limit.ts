/**
 * Simple in-memory rate limiter using sliding window algorithm
 *
 * Suitable for single-container deployments. For distributed systems,
 * use Redis-based solutions like @upstash/ratelimit.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 100 });
 *   const { success, remaining, resetAt } = limiter.check(ip);
 */

interface RateLimitOptions {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 100) */
  maxRequests?: number;
  /** Key prefix for namespacing (default: 'default') */
  prefix?: string;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the window resets */
  resetAt: number;
  /** Total requests made in current window */
  current: number;
}

interface WindowData {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter with automatic cleanup
 */
export class RateLimiter {
  private windows = new Map<string, WindowData>();
  private windowMs: number;
  private maxRequests: number;
  private prefix: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60000; // 1 minute default
    this.maxRequests = options.maxRequests ?? 100; // 100 requests/minute default
    this.prefix = options.prefix ?? 'default';

    // Start cleanup interval (runs every window period)
    this.startCleanup();
  }

  /**
   * Check if a request from the given identifier is allowed
   */
  check(identifier: string): RateLimitResult {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();

    let data = this.windows.get(key);

    // Check if window has expired or doesn't exist
    if (!data || now >= data.resetAt) {
      data = {
        count: 0,
        resetAt: now + this.windowMs,
      };
    }

    // Increment count
    data.count++;
    this.windows.set(key, data);

    const success = data.count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - data.count);

    return {
      success,
      remaining,
      resetAt: data.resetAt,
      current: data.count,
    };
  }

  /**
   * Get current status without incrementing count
   */
  status(identifier: string): RateLimitResult {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const data = this.windows.get(key);

    if (!data || now >= data.resetAt) {
      return {
        success: true,
        remaining: this.maxRequests,
        resetAt: now + this.windowMs,
        current: 0,
      };
    }

    return {
      success: data.count < this.maxRequests,
      remaining: Math.max(0, this.maxRequests - data.count),
      resetAt: data.resetAt,
      current: data.count,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    const key = `${this.prefix}:${identifier}`;
    this.windows.delete(key);
  }

  /**
   * Start periodic cleanup of expired windows
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.windows.entries()) {
        if (now >= data.resetAt) {
          this.windows.delete(key);
        }
      }
    }, this.windowMs);

    // Don't prevent process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
  }
}

// Pre-configured limiters for different use cases
// These are singletons so rate limits are shared across all requests

/** General API rate limiter: 100 requests per minute per IP */
export const apiLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  prefix: 'api',
});

/** Search-specific rate limiter: 30 searches per minute per IP */
export const searchLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  prefix: 'search',
});

/** Strict limiter for expensive operations: 10 per minute per IP */
export const strictLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  prefix: 'strict',
});

/**
 * Get client IP from Next.js request
 * Handles X-Forwarded-For header for proxied requests
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For header (from reverse proxy like Cloudflare)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP in chain (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to unknown
  return 'unknown';
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.remaining + result.current),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
