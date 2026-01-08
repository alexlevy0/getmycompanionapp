import { redis } from "@/lib/redis";
import { verifyQStashSignature } from "@/lib/qstash";
import { stripe } from "@/lib/stripe";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api-response";
import { createScopedLogger } from "@/lib/logger";

const log = createScopedLogger("trigger-call");

// ============================================
// Types
// ============================================

interface PendingCall {
  callId: string;
  customerId: string;
  phone: string;
  firstName?: string;
  timestamp: number;
  expiresAt: number;
}

// ============================================
// Trigger Call Handler (Called by QStash)
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Verify QStash signature (skip in development)
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      const isValid = await verifyQStashSignature(request);
      if (!isValid) {
        log.warn("Invalid QStash signature");
        return apiError("Invalid signature", 401);
      }
    } else {
      log.info("Development mode: skipping QStash signature verification");
    }

    // 2. Parse body
    const body = await request.json();
    const { customerId, phone } = body;

    if (!customerId || !phone) {
      return apiError("Missing customerId or phone", 400);
    }

    log.info("Trigger call received", { customerId, phone });

    // 3. Check Redis availability
    if (!redis) {
      log.error("Redis not configured");
      return ApiErrors.serviceUnavailable("Redis not configured");
    }

    // 4. Get customer info for display
    let firstName: string | undefined;
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) {
        firstName = customer.metadata.first_name;
      }
    } catch (err) {
      log.warn("Could not retrieve customer", { customerId, error: err });
    }

    // 5. Store pending call in Redis (expires in 5 minutes)
    const pendingCall: PendingCall = {
      callId: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      customerId,
      phone,
      firstName,
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute timeout
    };

    await redis.set(
      `pending_call:${customerId}`,
      JSON.stringify(pendingCall),
      { ex: 300 } // 5 minutes TTL
    );

    log.info("Pending call stored", { callId: pendingCall.callId, customerId });

    return apiSuccess({
      success: true,
      callId: pendingCall.callId,
      message: "Call notification queued",
    });
  } catch (error) {
    log.error("Trigger call error", { error });
    return ApiErrors.internalError("Failed to trigger call");
  }
}
