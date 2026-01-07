import { updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall, cancelScheduledCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import type Stripe from "stripe";

const log = createScopedLogger("payment");

// ============================================
// Payment Handler (Stripe Checkout Completed)
// ============================================

interface ActivateSubscriptionParams {
  customerId: string;
  meta: Record<string, string>;
}

/**
 * Activates a subscription after successful payment.
 * Schedules the first paid call.
 */
export async function activateSubscription(
  params: ActivateSubscriptionParams
): Promise<void> {
  const { customerId, meta } = params;

  // Schedule first paid call
  const nextTime = calculateNextCallTime(
    meta.preferred_time || config.defaults.preferredTime,
    meta.preferred_days || config.defaults.preferredDays,
    meta.timezone || config.defaults.timezone
  );

  const messageId = await scheduleNextCall({
    phone: meta.phone,
    customerId,
    scheduledFor: nextTime,
  });

  // Update metadata
  await updateCustomerMetadata(customerId, {
    ...meta,
    status: "active",
    trial_calls_remaining: "0",
    next_call_scheduled: nextTime.toISOString(),
    qstash_message_id: messageId,
  });

  log.info("Subscription activated", {
    customerId,
    phone: meta.phone,
    nextCall: nextTime.toISOString(),
  });
}

/**
 * Handles subscription cancellation.
 * Cancels scheduled calls and marks user as churned.
 */
export async function cancelSubscription(
  customerId: string,
  meta: Record<string, string>
): Promise<void> {
  // Cancel scheduled call if exists
  if (meta.qstash_message_id) {
    await cancelScheduledCall(meta.qstash_message_id);
  }

  // Update metadata
  await updateCustomerMetadata(customerId, {
    ...meta,
    status: "churned",
    next_call_scheduled: "",
    qstash_message_id: "",
  });

  log.info("Subscription cancelled", { customerId, phone: meta.phone });
}

/**
 * Handles payment failure.
 * Pauses calls until payment is resolved.
 */
export async function handlePaymentFailure(
  customerId: string,
  meta: Record<string, string>
): Promise<void> {
  // Cancel scheduled call if exists
  if (meta.qstash_message_id) {
    await cancelScheduledCall(meta.qstash_message_id);
  }

  // Pause subscription
  await updateCustomerMetadata(customerId, {
    ...meta,
    status: "paused",
    next_call_scheduled: "",
    qstash_message_id: "",
  });

  log.warn("Payment failed, subscription paused", { customerId, phone: meta.phone });
}
