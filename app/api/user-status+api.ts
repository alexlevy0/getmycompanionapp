import { stripe } from "@/lib/stripe";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES } from "@/constants/messages";
import { checkRateLimit } from "@/lib/ratelimit";
import { hashToken } from "@/lib/crypto";
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

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

async function findCustomerByToken(token: string) {
  try {
    const tokenHash = hashToken(token);
    const result = await stripe.customers.search({
      query: `metadata['auth_token_hash']:'${tokenHash}'`,
    });
    return result.data[0] || null;
  } catch (error) {
    log.error("Failed to search customer by token", { error });
    return null;
  }
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

    const customer = await findCustomerByToken(token);
    
    if (!customer) {
      log.warn("No customer found for token", { ip }); // Intentionally vague
      return Response.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    const meta = customer.metadata;

    // ========================================
    // 3. Status Response
    // ========================================
    const response: UserStatusResponse = {
      status: meta.status as UserStatus,
      persona: meta.persona as Persona | undefined,
      firstName: meta.first_name,
      phone: meta.phone,
      
      nextCallScheduled: meta.next_call_scheduled || undefined,
      totalCalls: parseInt(meta.total_calls || "0"),
      trialCallsRemaining: parseInt(meta.trial_calls_remaining || "0"),
      
      preferredTime: meta.preferred_time || config.defaults.preferredTime,
      preferredDays: meta.preferred_days || config.defaults.preferredDays,
      timezone: meta.timezone || config.defaults.timezone,
    };

    if (meta.status === "awaiting_payment") {
      const paymentLink = config.stripe.paymentLinkStandard();
      if (paymentLink) {
        response.paymentLink = `${paymentLink}?client_reference_id=${customer.id}`;
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
