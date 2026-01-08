import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { callSchedulerService } from "@/lib/services/call-scheduler.service";
import { createScopedLogger } from "@/lib/logger";
import { isValidTimeFormat } from "@/lib/utils";
import { ERROR_MESSAGES } from "@/constants/messages";
import { hashToken } from "@/lib/crypto";

const log = createScopedLogger("update-preferences");

// ============================================
// Auth Helpers
// ============================================

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
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
// Update Handler
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Authenticate user
    const token = extractBearerToken(request);
    if (!token) {
      log.warn("Missing Authorization header");
      return Response.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const customer = await findCustomerByToken(token);
    if (!customer) {
      log.warn("Invalid token");
      return Response.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const meta = customer.metadata;

    // 2. Parse request
    const body = await request.json();
    const { preferredTime, preferredDays, persona } = body;

    log.info("Update preferences request", { 
      customerId: customer.id, 
      changes: { preferredTime, preferredDays, persona } 
    });

    // 3. Validate inputs
    if (preferredTime && !isValidTimeFormat(preferredTime)) {
      return Response.json({ error: "Format d'heure invalide (HH:mm)" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    let shouldReschedule = false;

    // 4. Checking for changes requiring rescheduling
    // Time change?
    if (preferredTime && preferredTime !== meta.preferred_time) {
      updates.preferred_time = preferredTime;
      shouldReschedule = true;
    }

    // Days change?
    if (preferredDays && preferredDays !== meta.preferred_days) {
      updates.preferred_days = preferredDays;
      shouldReschedule = true;
    }

    // 5. User Eligibility Check
    const isEligibleForCalls =
      meta.status === "active" ||
      (meta.status === "trial" && Number.parseInt(meta.trial_calls_remaining || "0", 10) > 0);

    // 6. Dynamic Rescheduling Logic
    if (shouldReschedule && isEligibleForCalls && meta.qstash_message_id) {
      log.info("Rescheduling call due to preference change", { customerId: customer.id });

      // A. Cancel old job (swallows errors)
      await callSchedulerService.cancelScheduledCall(meta.qstash_message_id);

      // B. Schedule new job
      // Merge current meta with updates to calculate correct next time
      const mergedMeta = { phone: meta.phone || "", ...meta, ...updates };
      
      const scheduleResult = await callSchedulerService.scheduleNextCall(
        customer.id,
        mergedMeta
      );

      // Merge schedule results into updates
      Object.assign(updates, scheduleResult);
    }

    // 7. Persist updates to Stripe
    if (Object.keys(updates).length > 0) {
      await updateCustomerMetadata(customer.id, { ...meta, ...updates });
    }

    return Response.json({
      success: true,
      updated: {
        preferredTime: updates.preferred_time || meta.preferred_time,
        preferredDays: updates.preferred_days || meta.preferred_days,
        nextCallScheduled: updates.next_call_scheduled || meta.next_call_scheduled,
      }
    });

  } catch (error) {
    log.error("Update preferences failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Response.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
