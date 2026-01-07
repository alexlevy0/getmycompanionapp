import { Redis } from "@upstash/redis";
import { createScopedLogger } from "./logger";

const log = createScopedLogger("redis");

// ============================================
// Redis Client Configuration
// ============================================

const isRedisConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

if (!isRedisConfigured) {
  log.warn("Upstash Redis not configured - Some features will be disabled");
}

export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;
