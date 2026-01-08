import { extractBearerToken, getUserProfile } from "@/lib/auth";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES } from "@/constants/messages";
import { checkRateLimit } from "@/lib/ratelimit";
import type { Persona, UserStatus } from "@/types";

const log = createScopedLogger("user-status");

// ============================================
// Response Types
// ============================================

interface UserStatusResponse {
  status: UserStatus;
  persona?: Persona;
  firstName?: string;
  phone: string;
  nextCallScheduled?: string;
  totalCalls: number;
  trialCallsRemaining: number;
  preferredTime: string;
  preferredDays: string;
  timezone: string;
  paymentLink?: string;
}

// ============================================
// Helpers
// ============================================

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

// ============================================
// Endpoint
// ============================================

export async function GET(request: Request): Promise<Response> {
  try {
    // ========================================
    // 1. Rate Limiting (Brute-force protection)
    // ========================================
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await checkRateLimit("userStatus", ip);

    if (!success) {
      log.warn("Rate limit exceeded for user-status", { ip });
      return Response.json(
        { error: "Too many requests" },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          }
        }
      );
    }

    // ========================================
    // 2. Authentication
    // ========================================
    const token = extractBearerToken(request);
    
    if (!token) {
      log.warn("Missing or invalid Authorization header", { ip });
      return Response.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    const userProfile = await getUserProfile(token);
    
    if (!userProfile) {
      log.warn("No customer found for token", { ip }); // Intentionally vague
      return Response.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    const meta = userProfile.metadata;

    // ========================================
    // 3. Status Response
    // ========================================
    const response: UserStatusResponse = {
      status: meta.status as UserStatus,
      persona: meta.persona as Persona | undefined,
      firstName: meta.first_name,
      phone: meta.phone,
      
      nextCallScheduled: meta.next_call_scheduled || undefined,
      totalCalls: Number.parseInt(meta.total_calls || "0", 10),
      trialCallsRemaining: Number.parseInt(meta.trial_calls_remaining || "0", 10),
      
      preferredTime: meta.preferred_time || config.defaults.preferredTime,
      preferredDays: meta.preferred_days || config.defaults.preferredDays,
      timezone: meta.timezone || config.defaults.timezone,
    };

    if (meta.status === "awaiting_payment") {
      const paymentLink = config.stripe.paymentLinkStandard();
      if (paymentLink) {
        response.paymentLink = `${paymentLink}?client_reference_id=${userProfile.id}`;
      }
    }

    return Response.json(response);

  } catch (error) {
    log.error("User status failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Response.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
