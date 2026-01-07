import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { cancelScheduledCall } from "@/lib/qstash";
import { scheduleNextCallForUser } from "@/lib/handlers/call-completed";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES } from "@/constants/messages";
import { isValidTimeFormat } from "@/lib/utils";
import type { Persona, UserStatus } from "@/types";
import { PERSONAS } from "@/constants/personas";

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
    const result = await stripe.customers.search({
      query: `metadata['auth_token']:'${token}'`,
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
    const { preferredTime, persona } = body;

    log.info("Update preferences request", { 
      customerId: customer.id, 
      changes: { preferredTime, persona } 
    });

    // 3. Validate inputs
    if (preferredTime && !isValidTimeFormat(preferredTime)) {
      return Response.json({ error: "Format d'heure invalide (HH:mm)" }, { status: 400 });
    }

    if (persona && !PERSONAS[persona as Persona]) {
      return Response.json({ error: "Persona invalide" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    let shouldReschedule = false;

    // 4. Checking for changes
    if (preferredTime && preferredTime !== meta.preferred_time) {
      updates.preferred_time = preferredTime;
      shouldReschedule = true;
    }

    if (persona && persona !== meta.persona) {
      updates.persona = persona;
      // Changing persona doesn't strictly require rescheduling unless we want to change the prompt immediately
      // But keeping the same schedule is fine. Next call will pick up the new persona agent.
    }

    // 5. Dynamic Rescheduling
    // Only if:
    // - User is active or trial eligible
    // - preferred_time changed
    // - Call is currently scheduled
    const canCall =
      meta.status === "active" ||
      (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0);

    if (shouldReschedule && canCall && meta.qstash_message_id) {
      log.info("Rescheduling call due to preference change", { customerId: customer.id });

      // Cancel old job
      try {
        await cancelScheduledCall(meta.qstash_message_id);
      } catch (err) {
        // Log but continue (job might already be gone)
        log.warn("Failed to cancel old job (continuing)", { error: err });
      }

      // Schedule new job
      // We merge current meta with updates to calculate correct time
      const mergedMeta = { ...meta, ...updates };
      
      const scheduleResult = await scheduleNextCallForUser(
        customer.id,
        mergedMeta,
        updates // Pass updates object to accumulate changes
      );

      // scheduleNextCallForUser returns merged updates
      Object.assign(updates, scheduleResult);
    }

    // 6. Persist updates
    if (Object.keys(updates).length > 0) {
      await updateCustomerMetadata(customer.id, { ...meta, ...updates });
    }

    return Response.json({
      success: true,
      updated: {
        preferredTime: updates.preferred_time || meta.preferred_time,
        persona: updates.persona || meta.persona,
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
