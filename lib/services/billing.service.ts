import { updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall, cancelScheduledCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";

// ============================================
// Types
// ============================================

export interface ScheduleResult {
  next_call_scheduled: string;
  qstash_message_id: string;
}

export interface ActivationResult extends ScheduleResult {
  status: "active";
}

// ============================================
// Billing Service
// ============================================

export const billingService = {
  /**
   * Activates a subscription after successful payment.
   * Schedules the first paid call and updates customer status.
   */
  async activateSubscription(
    customerId: string,
    meta: Record<string, string>
  ): Promise<ActivationResult> {
    const nextTime = calculateNextCallTime(
      meta.preferred_time || "10:00",
      meta.preferred_days || "daily",
      meta.timezone || "Europe/Paris"
    );

    const messageId = await scheduleNextCall({
      phone: meta.phone,
      customerId,
      scheduledFor: nextTime,
    });

    const updates = {
      ...meta,
      status: "active",
      trial_calls_remaining: "0",
      next_call_scheduled: nextTime.toISOString(),
      qstash_message_id: messageId,
    };

    await updateCustomerMetadata(customerId, updates);

    console.log(
      `Subscription activated for ${meta.phone}, next call: ${nextTime.toISOString()}`
    );

    return {
      status: "active",
      next_call_scheduled: nextTime.toISOString(),
      qstash_message_id: messageId,
    };
  },

  /**
   * Pauses a subscription (payment failed).
   * Cancels scheduled calls and updates status.
   */
  async pauseSubscription(
    customerId: string,
    meta: Record<string, string>
  ): Promise<void> {
    // Cancel any scheduled call
    if (meta.qstash_message_id) {
      await cancelScheduledCall(meta.qstash_message_id);
    }

    await updateCustomerMetadata(customerId, {
      ...meta,
      status: "paused",
      next_call_scheduled: "",
      qstash_message_id: "",
    });

    console.log(`Subscription paused for ${meta.phone}`);
  },

  /**
   * Cancels a subscription (churned).
   * Cancels scheduled calls and marks customer as churned.
   */
  async cancelSubscription(
    customerId: string,
    meta: Record<string, string>
  ): Promise<void> {
    // Cancel any scheduled call
    if (meta.qstash_message_id) {
      await cancelScheduledCall(meta.qstash_message_id);
    }

    await updateCustomerMetadata(customerId, {
      ...meta,
      status: "churned",
      next_call_scheduled: "",
      qstash_message_id: "",
    });

    console.log(`Subscription cancelled for ${meta.phone}`);
  },
};
