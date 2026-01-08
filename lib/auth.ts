import { redis } from "./redis";
import { stripe } from "./stripe";
import { hashToken } from "./crypto";
import { createScopedLogger } from "./logger";
import Stripe from "stripe";

const log = createScopedLogger("auth");
const SESSION_TTL = 3600; // 1 hour

export interface CachedProfile {
  id: string;
  metadata: Stripe.Metadata;
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

/**
 * Caches the user profile in Redis for fast access.
 */
export async function cacheUserProfile(token: string, customer: Stripe.Customer) {
  if (!redis) return;

  try {
    const tokenHash = hashToken(token);
    const profile: CachedProfile = {
      id: customer.id,
      metadata: customer.metadata,
    };

    await redis.set(`session:${tokenHash}`, profile, { ex: SESSION_TTL });
  } catch (error) {
    log.error("Failed to cache user profile", { error });
  }
}

/**
 * Retrieves user profile from Cache (Redis) or Source (Stripe).
 * Automatically populates cache on miss.
 */
export async function getUserProfile(token: string): Promise<CachedProfile | null> {
  const tokenHash = hashToken(token);

  // 1. Try Redis Cache
  if (redis) {
    try {
      const cached = await redis.get<CachedProfile>(`session:${tokenHash}`);
      if (cached) {
        return cached; 
      }
    } catch (error) {
      log.warn("Redis cache read failed", { error });
    }
  }

  // 2. Fallback to Stripe
  try {
    const result = await stripe.customers.search({
      query: `metadata['auth_token_hash']:'${tokenHash}'`,
    });
    
    const customer = result.data[0];
    if (!customer) return null;

    // 3. Populate Cache
    await cacheUserProfile(token, customer);

    return {
      id: customer.id,
      metadata: customer.metadata,
    };

  } catch (error) {
    log.error("Stripe customer lookup failed", { error });
    return null;
  }
}

/**
 * Invalidates the user session in cache (e.g. on logout or update).
 */
export async function invalidateSession(token: string) {
  if (!redis) return;
  try {
    const tokenHash = hashToken(token);
    await redis.del(`session:${tokenHash}`);
  } catch (error) {
    log.error("Failed to invalidate session", { error });
  }
}
