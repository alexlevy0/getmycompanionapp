import Stripe from "stripe";
import { updateCustomerMetadata } from "@/lib/stripe";
import { sendPaymentEmail, sendNotificationEmail } from "@/lib/resend";
import { callSchedulerService } from "./call-scheduler.service";
import { DiplerWebhookPayload, determineCallStatus } from "@/types";

// ============================================
// Types
// ============================================

export interface CallResult {
  status: "completed" | "no_answer" | "failed";
  userStatus: string;
  nextCallScheduled: string | null;
  retryScheduled?: boolean;
}

interface MetadataUpdates {
  [key: string]: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_TIME = "10:00";
const DEFAULT_DAYS = "daily";
const MAX_SUMMARY_LENGTH = 500;
const MAX_NO_ANSWER_RETRIES = 3;

// ============================================
// Helpers
// ============================================

function truncate(str: string | undefined, maxLength = MAX_SUMMARY_LENGTH): string {
  if (!str) return "";
  return Array.from(str).slice(0, maxLength).join("");
}

// ============================================
// Call Handler Service
// ============================================

export const callHandlerService = {
  /**
   * Main entry point for handling Dipler webhook.
   * Routes to appropriate handler based on call status.
   */
  async handleWebhook(
    payload: DiplerWebhookPayload,
    customer: Stripe.Customer
  ): Promise<CallResult> {
    const callStatus = determineCallStatus(payload);
    const meta = customer.metadata;

    console.log(`Dipler webhook: ${meta.phone} - status: ${callStatus}`);

    if (callStatus === "no_answer" || callStatus === "failed") {
      return this.handleNoAnswer(payload, customer, callStatus);
    }

    return this.handleCompletedCall(payload, customer);
  },

  /**
   * Handles no-answer/failed calls.
   * Implements smart retry logic with max attempts.
   */
  async handleNoAnswer(
    payload: DiplerWebhookPayload,
    customer: Stripe.Customer,
    callStatus: "no_answer" | "failed"
  ): Promise<CallResult> {
    const meta = customer.metadata;
    const customerId = customer.id;
    const updates: MetadataUpdates = {};

    const noAnswerCount = Number.parseInt(meta.consecutive_no_answer || "0", 10) + 1;
    updates.consecutive_no_answer = noAnswerCount.toString();

    if (noAnswerCount < MAX_NO_ANSWER_RETRIES) {
      // Schedule retry
      const scheduleResult = await callSchedulerService.scheduleRetry(
        customerId,
        { phone: meta.phone || "", ...meta },
        noAnswerCount
      );
      Object.assign(updates, scheduleResult);

      console.log(
        `Scheduling retry ${noAnswerCount}/${MAX_NO_ANSWER_RETRIES} for ${meta.phone}`
      );

      await updateCustomerMetadata(customerId, { ...meta, ...updates });

      return {
        status: callStatus,
        userStatus: meta.status,
        nextCallScheduled: updates.next_call_scheduled,
        retryScheduled: true,
      };
    }

    // Max retries reached - pause and alert
    updates.status = "paused";
    Object.assign(updates, callSchedulerService.clearSchedule());

    console.log(`Max retries reached for ${customerId}, pausing and alerting`);

    // Send alert email
    if (customer.email) {
      await this.sendMissedCallsAlert(customer.email, meta.first_name, noAnswerCount);
    }

    await updateCustomerMetadata(customerId, { ...meta, ...updates });

    return {
      status: callStatus,
      userStatus: "paused",
      nextCallScheduled: null,
      retryScheduled: false,
    };
  },

  /**
   * Handles completed calls.
   * Processes extraction, updates preferences, manages trial/billing.
   */
  async handleCompletedCall(
    payload: DiplerWebhookPayload,
    customer: Stripe.Customer
  ): Promise<CallResult> {
    const meta = customer.metadata;
    const customerId = customer.id;
    const updates: MetadataUpdates = {};

    const analysis = payload.conversation?.postConversationAnalysis;
    const extraction = analysis?.extraction;
    const isOnboarding = meta.status === "onboarding";

    // Reset no-answer counter and update call stats
    updates.consecutive_no_answer = "0";
    updates.total_calls = (Number.parseInt(meta.total_calls || "0", 10) + 1).toString();
    updates.last_call_date = new Date().toISOString();

    if (analysis?.summary) {
      updates.last_call_summary = truncate(analysis.summary);
    }

    // Handle onboarding or regular call
    if (isOnboarding) {
      this.applyOnboardingUpdates(updates, extraction);
    } else {
      this.applyRegularCallUpdates(updates, extraction);
      await this.handleTrialCountdown(customer, updates);
    }

    // Schedule next call if eligible
    const finalStatus = updates.status || meta.status;
    const remainingCalls = Number.parseInt(
      updates.trial_calls_remaining || meta.trial_calls_remaining || "0",
      10
    );

    if (callSchedulerService.isEligibleForCalls(finalStatus, remainingCalls.toString())) {
      const mergedMeta = { phone: meta.phone || "", ...meta, ...updates };
      const scheduleResult = await callSchedulerService.scheduleNextCall(
        customerId,
        mergedMeta
      );
      Object.assign(updates, scheduleResult);
    }

    await updateCustomerMetadata(customerId, { ...meta, ...updates });

    return {
      status: "completed",
      userStatus: updates.status || meta.status,
      nextCallScheduled: updates.next_call_scheduled || null,
    };
  },

  /**
   * Applies onboarding-specific updates.
   */
  applyOnboardingUpdates(
    updates: MetadataUpdates,
    extraction?: { user_name?: string; preferred_time?: string; preferred_days?: string; goals?: string }
  ): void {
    updates.status = "trial";

    if (extraction?.user_name) {
      updates.first_name = extraction.user_name;
    }

    updates.preferred_time = extraction?.preferred_time || DEFAULT_TIME;
    updates.preferred_days = extraction?.preferred_days || DEFAULT_DAYS;

    if (extraction?.goals) {
      updates.goals = truncate(extraction.goals);
    }

    console.log(`Onboarding complete: ${updates.first_name || "unnamed"}`);
  },

  /**
   * Applies regular call updates (preference changes from conversation).
   */
  applyRegularCallUpdates(
    updates: MetadataUpdates,
    extraction?: { preferred_time?: string; preferred_days?: string; goals?: string }
  ): void {
    if (extraction?.preferred_time) {
      updates.preferred_time = extraction.preferred_time;
    }
    if (extraction?.preferred_days) {
      updates.preferred_days = extraction.preferred_days;
    }
    if (extraction?.goals) {
      updates.goals = truncate(extraction.goals);
    }
  },

  /**
   * Handles trial countdown and payment trigger.
   */
  async handleTrialCountdown(
    customer: Stripe.Customer,
    updates: MetadataUpdates
  ): Promise<void> {
    const meta = customer.metadata;

    if (meta.status !== "trial") return;

    const remaining = Number.parseInt(meta.trial_calls_remaining || "0", 10) - 1;
    updates.trial_calls_remaining = Math.max(0, remaining).toString();

    if (remaining <= 0) {
      console.log(`Trial ended for ${customer.id}, sending payment link`);

      updates.status = "awaiting_payment";
      Object.assign(updates, callSchedulerService.clearSchedule());

      if (customer.email) {
        try {
          await sendPaymentEmail({
            email: customer.email,
            customerId: customer.id,
            firstName: meta.first_name,
          });
        } catch (err) {
          console.error("Failed to send payment email", err);
        }
      }
    }
  },

  /**
   * Sends missed calls alert email.
   */
  async sendMissedCallsAlert(
    email: string,
    firstName: string | undefined,
    attempts: number
  ): Promise<void> {
    try {
      const greeting = firstName ? `Bonjour ${firstName}` : "Bonjour";
      await sendNotificationEmail({
        email,
        subject: "📞 Nous n'avons pas pu vous joindre",
        message: `${greeting},\n\nNous avons essayé de vous appeler ${attempts} fois sans succès. Vos appels sont maintenant en pause.\n\nConnectez-vous à MyCompanion pour reprendre vos appels.`,
      });
    } catch (err) {
      console.error("Failed to send missed calls alert email", err);
    }
  },
};
