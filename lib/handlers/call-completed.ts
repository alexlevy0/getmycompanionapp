import { updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { sendPaymentSMS } from "@/lib/twilio";
import { calculateNextCallTime } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import type { DiplerWebhookPayload } from "@/types";

const log = createScopedLogger("call-completed");

// ============================================
// Call Completed Handler
// ============================================

interface CallCompletedParams {
  customerId: string;
  meta: Record<string, string>;
  payload: DiplerWebhookPayload;
}

interface CallCompletedResult {
  updates: Record<string, string>;
  shouldScheduleNext: boolean;
  trialEnded: boolean;
}

/**
 * Processes a completed call for a trial/active user.
 * Handles preference updates, trial countdown, and payment triggering.
 */
export function processCallCompleted(params: CallCompletedParams): CallCompletedResult {
  const { customerId, meta, payload } = params;
  const updates: Record<string, string> = {};
  
  const analysis = payload.conversation?.postConversationAnalysis;
  const extraction = analysis?.extraction;

  // Update call stats
  updates.consecutive_no_answer = "0";
  updates.total_calls = (parseInt(meta.total_calls || "0") + 1).toString();
  updates.last_call_date = new Date().toISOString();

  // Save summary
  if (analysis?.summary) {
    updates.last_call_summary = analysis.summary.slice(0, 500);
  }

  // Update preferences if changed
  if (extraction?.preferred_time) {
    updates.preferred_time = extraction.preferred_time;
  }
  if (extraction?.preferred_days) {
    updates.preferred_days = extraction.preferred_days;
  }
  if (extraction?.goals) {
    updates.goals = extraction.goals.slice(0, 500);
  }

  // Trial countdown
  let trialEnded = false;
  if (meta.status === "trial") {
    const remaining = parseInt(meta.trial_calls_remaining || "0") - 1;
    updates.trial_calls_remaining = Math.max(0, remaining).toString();

    if (remaining <= 0) {
      trialEnded = true;
      updates.status = "awaiting_payment";
      updates.next_call_scheduled = "";
      updates.qstash_message_id = "";
      
      log.info("Trial ended", { customerId, phone: meta.phone });
    }
  }

  // Determine if we should schedule next call
  const finalStatus = updates.status || meta.status;
  const remainingCalls = parseInt(updates.trial_calls_remaining || meta.trial_calls_remaining || "0");
  
  const shouldScheduleNext =
    finalStatus === "active" ||
    (finalStatus === "trial" && remainingCalls > 0);

  return { updates, shouldScheduleNext, trialEnded };
}

/**
 * Schedules the next call and updates metadata.
 */
export async function scheduleNextCallForUser(
  customerId: string,
  meta: Record<string, string>,
  updates: Record<string, string>
): Promise<Record<string, string>> {
  const nextTime = calculateNextCallTime(
    updates.preferred_time || meta.preferred_time || config.defaults.preferredTime,
    updates.preferred_days || meta.preferred_days || config.defaults.preferredDays,
    meta.timezone || config.defaults.timezone
  );

  const messageId = await scheduleNextCall({
    phone: meta.phone,
    customerId,
    scheduledFor: nextTime,
  });

  log.info("Scheduled next call", {
    customerId,
    phone: meta.phone,
    nextCall: nextTime.toISOString(),
  });

  return {
    ...updates,
    next_call_scheduled: nextTime.toISOString(),
    qstash_message_id: messageId,
  };
}

/**
 * Handles trial end: sends payment SMS.
 */
export async function handleTrialEnd(
  customerId: string,
  phone: string,
  firstName?: string
): Promise<void> {
  await sendPaymentSMS({
    phone,
    customerId,
    firstName,
  });

  log.info("Payment SMS sent", { customerId, phone });
}
