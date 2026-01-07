import { findCustomerByPhone, createCustomer } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/constants/messages";
import { hashToken } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/ratelimit";

const log = createScopedLogger("start-trial");

/**
 * Generates a secure auth token (UUID v4).
 */
function generateAuthToken(): string {
  return crypto.randomUUID();
}

/**
 * Extracts IP from request headers.
 * Cloudflare/Vercel/Expo usually put client IP in x-forwarded-for.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }
  
  return "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  try {
    // ========================================
    // 1. Rate Limiting
    // ========================================
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await checkRateLimit("startTrial", ip);
    
    if (!success) {
      log.warn("Rate limit exceeded for start-trial", { ip });
      return Response.json(
        { error: "Too many requests. Please try again later." },
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

    const { phone } = await request.json();

    // ========================================
    // 2. Validation
    // ========================================
    if (!phone || !validatePhone(phone)) {
      return Response.json(
        { error: ERROR_MESSAGES.invalidPhone },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneE164(phone);

    // ========================================
    // 3. Check existing customer
    // ========================================
    const existing = await findCustomerByPhone(formattedPhone);
    if (existing) {
      const meta = existing.metadata;
      if (
        meta.status === "active" ||
        meta.status === "onboarding" ||
        (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0)
      ) {
        return Response.json(
          { error: ERROR_MESSAGES.alreadyRegistered },
          { status: 409 }
        );
      }
    }

    // ========================================
    // 4. Create new customer
    // ========================================
    const authToken = generateAuthToken();
    const authTokenHash = hashToken(authToken);

    const metadata: Record<string, string> = {
      phone: formattedPhone,
      status: "onboarding",
      trial_calls_remaining: config.defaults.trialCalls.toString(),
      total_calls: "0",
      consecutive_no_answer: "0",
      timezone: config.defaults.timezone,
      preferred_time: config.defaults.preferredTime,
      preferred_days: config.defaults.preferredDays,
      auth_token_hash: authTokenHash, // Store HASH, not token
    };

    const customer = await createCustomer(metadata);

    log.info("Customer created", { 
      customerId: customer.id, 
      phone: formattedPhone,
      ip 
    });

    // ========================================
    // 5. Trigger first call
    // ========================================
    await triggerDiplerCall({
      phone: formattedPhone,
      isFirstCall: true,
      metadata: {
        customerId: customer.id,
      },
    });

    log.info("First call triggered", { customerId: customer.id });

    return Response.json({
      success: true,
      message: SUCCESS_MESSAGES.callTriggered,
      token: authToken,
    });
  } catch (error) {
    log.error("Start trial failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Response.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
