import { scheduleNextCall, cancelScheduledCall } from "@/lib/qstash";
import { calculateNextCallTime, calculateRetryTime } from "@/lib/utils";

// ============================================
// Types
// ============================================

export interface ScheduleResult {
  next_call_scheduled: string;
  qstash_message_id: string;
}

export interface UserMeta {
  phone: string;
  preferred_time?: string;
  preferred_days?: string;
  timezone?: string;
  qstash_message_id?: string;
  [key: string]: string | undefined;
}

// ============================================
// Constants
// ============================================

const DEFAULT_TIME = "10:00";
const DEFAULT_DAYS = "daily";
const DEFAULT_TIMEZONE = "Europe/Paris";

// ============================================
// Call Scheduler Service
// ============================================

export const callSchedulerService = {
  /**
   * Schedules the next call based on user preferences.
   * Returns schedule info to be merged into metadata updates.
   */
  async scheduleNextCall(
    customerId: string,
    meta: UserMeta
  ): Promise<ScheduleResult> {
    const nextTime = calculateNextCallTime(
      meta.preferred_time || DEFAULT_TIME,
      meta.preferred_days || DEFAULT_DAYS,
      meta.timezone || DEFAULT_TIMEZONE
    );

    const messageId = await scheduleNextCall({
      phone: meta.phone,
      customerId,
      scheduledFor: nextTime,
    });

    console.log(`Scheduled next call for ${meta.phone} at ${nextTime.toISOString()}`);

    return {
      next_call_scheduled: nextTime.toISOString(),
      qstash_message_id: messageId,
    };
  },

  /**
   * Schedules a retry call for no-answer scenarios.
   * Uses smart retry logic (within business hours).
   */
  async scheduleRetry(
    customerId: string,
    meta: UserMeta,
    attemptNumber: number
  ): Promise<ScheduleResult> {
    const retryTime = calculateRetryTime(meta.timezone || DEFAULT_TIMEZONE);

    const messageId = await scheduleNextCall({
      phone: meta.phone,
      customerId,
      scheduledFor: retryTime,
    });

    console.log(
      `Scheduled retry #${attemptNumber} for ${meta.phone} at ${retryTime.toISOString()}`
    );

    return {
      next_call_scheduled: retryTime.toISOString(),
      qstash_message_id: messageId,
    };
  },

  /**
   * Cancels a scheduled call.
   * Swallows errors to prevent blocking the main flow.
   */
  async cancelScheduledCall(messageId: string): Promise<void> {
    if (!messageId) return;

    try {
      await cancelScheduledCall(messageId);
      console.log(`Cancelled scheduled call: ${messageId}`);
    } catch (error) {
      console.error(`Failed to cancel scheduled call ${messageId}:`, error);
      // Swallow error - call may have already been executed
    }
  },

  /**
   * Clears schedule data (for paused/churned users).
   * Returns empty schedule fields for metadata update.
   */
  clearSchedule(): Partial<ScheduleResult> {
    return {
      next_call_scheduled: "",
      qstash_message_id: "",
    };
  },

  /**
   * Checks if a user is eligible for calls.
   */
  isEligibleForCalls(status: string, trialCallsRemaining: string): boolean {
    return (
      status === "active" ||
      (status === "trial" && Number.parseInt(trialCallsRemaining || "0", 10) > 0)
    );
  },
};
