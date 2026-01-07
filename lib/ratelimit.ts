import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createScopedLogger } from "./logger";

const log = createScopedLogger("ratelimit");

// ============================================
// Redis Client
// ============================================

// Check if Redis is configured
const isRedisConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

if (!isRedisConfigured) {
  log.warn("Upstash Redis not configured - Rate limiting disabled");
}

const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null; // Fallback or mock if needed, but here we'll just bypass

// ============================================
// Limiters Config
// ============================================

export const LIMITERS = {
  /**
   * Start Trial: 3 requests per 1 hour
   * Expensive operation (creates Stripe customer, triggers call)
   */
  startTrial: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/start-trial",
      })
    : null,

  /**
   * User Status: 60 requests per 1 minute
   * Protects against token brute-forcing
   */
  userStatus: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/user-status",
      })
    : null,
};

// ============================================
// Helper
// ============================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks rate limit for a given identifier (usually IP).
 * If Redis is not configured, always returns success.
 */
export async function checkRateLimit(
  type: keyof typeof LIMITERS,
  identifier: string
): Promise<RateLimitResult> {
  if (!redis || !LIMITERS[type]) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await LIMITERS[type]!.limit(identifier);
    
    if (!result.success) {
      log.warn(`Rate limit exceeded for ${type}`, { identifier });
    }
    
    return result;
  } catch (error) {
    log.error(`Rate limit checking failed for ${type}`, { error });
    // Fail open (allow request) if Rate Limit service is down to avoid outage
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}
