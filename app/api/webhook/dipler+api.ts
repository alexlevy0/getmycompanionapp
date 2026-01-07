import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { sendPaymentSMS } from "@/lib/twilio";
import { calculateNextCallTime } from "@/lib/utils";
import {
  DiplerWebhookPayload,
  Persona,
  determineCallStatus,
} from "@/types";
import { MAX_NO_ANSWER_RETRIES, PERSONAS } from "@/constants/personas";

// ============================================
// Constants
// ============================================

const DEFAULT_PERSONA: Persona = "friend";
const DEFAULT_TIME = "10:00";
const MAX_SUMMARY_LENGTH = 500;

// ============================================
// Helper Functions
// ============================================

function extractPersona(payload: DiplerWebhookPayload): Persona {
  const extraction = payload.conversation?.postConversationAnalysis?.extraction;
  const detected = extraction?.detected_persona;

  if (detected && PERSONAS[detected]) {
    return detected;
  }

  const summary = payload.conversation?.postConversationAnalysis?.summary?.toLowerCase() || "";

  if (summary.includes("coach") || summary.includes("motivation") || summary.includes("sport")) {
    return "coach";
  }
  if (summary.includes("mentor") || summary.includes("carrière") || summary.includes("études")) {
    return "mentor";
  }
  if (summary.includes("compagnon") || summary.includes("senior") || summary.includes("famille")) {
    return "companion";
  }

  return DEFAULT_PERSONA;
}

function truncate(str: string | undefined, maxLength: number = MAX_SUMMARY_LENGTH): string {
  if (!str) return "";
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

// ============================================
// Webhook Handler
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    const payload: DiplerWebhookPayload = await request.json();

    // ========================================
    // 1. Parse customerId from metadata
    // ========================================
    const customerId = payload.metadata?.customerId;
    if (!customerId) {
      console.error("Dipler webhook: Missing customerId in metadata");
      return Response.json({ error: "Missing customerId" }, { status: 400 });
    }

    // ========================================
    // 2. Retrieve Stripe Customer
    // ========================================
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      console.error(`Dipler webhook: Customer ${customerId} was deleted`);
      return new Response("Customer not found", { status: 404 });
    }

    const meta = customer.metadata;
    const updates: Record<string, string> = {};

    // ========================================
    // 3. Determine Call Status
    // ========================================
    const callStatus = determineCallStatus(payload);
    console.log(`Dipler webhook: ${meta.phone} - status: ${callStatus}`);

    // ========================================
    // 4. Handle NO-ANSWER / FAILED
    // ========================================
    if (callStatus === "no_answer" || callStatus === "failed") {
      const noAnswerCount = parseInt(meta.consecutive_no_answer || "0") + 1;
      updates.consecutive_no_answer = noAnswerCount.toString();

      if (noAnswerCount < MAX_NO_ANSWER_RETRIES) {
        const retryTime = new Date(Date.now() + 60 * 60 * 1000);
        const messageId = await scheduleNextCall({
          phone: meta.phone,
          customerId,
          scheduledFor: retryTime,
        });
        updates.qstash_message_id = messageId;
        updates.next_call_scheduled = retryTime.toISOString();
        console.log(`Scheduling retry ${noAnswerCount}/${MAX_NO_ANSWER_RETRIES} for ${meta.phone}`);
      } else {
        updates.status = "paused";
        console.log(`Max retries reached for ${meta.phone}, pausing`);
      }

      await updateCustomerMetadata(customerId, { ...meta, ...updates });
      return Response.json({ handled: callStatus, retryScheduled: noAnswerCount < MAX_NO_ANSWER_RETRIES });
    }

    // ========================================
    // 5. Handle COMPLETED Call
    // ========================================
    const analysis = payload.conversation?.postConversationAnalysis;
    const extraction = analysis?.extraction;
    const isOnboarding = meta.status === "onboarding";

    updates.consecutive_no_answer = "0";
    updates.total_calls = (parseInt(meta.total_calls || "0") + 1).toString();
    updates.last_call_date = new Date().toISOString();

    if (analysis?.summary) {
      updates.last_call_summary = truncate(analysis.summary);
    }

    // ========================================
    // 6. ONBOARDING: Receptionist Logic
    // ========================================
    if (isOnboarding) {
      const persona = extractPersona(payload);
      updates.persona = persona;
      updates.status = "trial";

      if (extraction?.user_name) {
        updates.first_name = extraction.user_name;
      }

      updates.preferred_time = extraction?.preferred_time || PERSONAS[persona].defaultTime;
      updates.preferred_days = extraction?.preferred_days || PERSONAS[persona].defaultDays;

      if (extraction?.goals) {
        updates.goals = truncate(extraction.goals);
      }

      console.log(`Onboarding complete: ${meta.phone} → ${persona} (${updates.first_name || "unnamed"})`);
    } else {
      // ========================================
      // 7. REGULAR CALL: Update preferences
      // ========================================
      if (extraction?.preferred_time) {
        updates.preferred_time = extraction.preferred_time;
      }
      if (extraction?.preferred_days) {
        updates.preferred_days = extraction.preferred_days;
      }
      if (extraction?.goals) {
        updates.goals = truncate(extraction.goals);
      }

      // ========================================
      // 8. TRIAL COUNTDOWN & PAYMENT TRIGGER
      // ========================================
      if (meta.status === "trial") {
        const remaining = parseInt(meta.trial_calls_remaining || "0") - 1;
        updates.trial_calls_remaining = Math.max(0, remaining).toString();

        if (remaining <= 0) {
          // Trial is over - send payment SMS and block future calls
          console.log(`Trial ended for ${meta.phone}, sending payment link...`);

          // Send SMS with payment link
          await sendPaymentSMS({
            phone: meta.phone,
            customerId,
            firstName: meta.first_name,
          });

          // Change status to awaiting_payment to block future calls
          updates.status = "awaiting_payment";

          // Clear scheduling - no more calls until payment
          updates.next_call_scheduled = "";
          updates.qstash_message_id = "";
        }
      }
    }

    // ========================================
    // 9. Schedule Next Call (only if eligible)
    // ========================================
    const finalStatus = updates.status || meta.status;
    const remainingCalls = parseInt(updates.trial_calls_remaining || meta.trial_calls_remaining || "0");

    // Only schedule if active OR trial with remaining calls
    // Do NOT schedule if awaiting_payment, paused, or churned
    const shouldSchedule =
      finalStatus === "active" ||
      (finalStatus === "trial" && remainingCalls > 0);

    if (shouldSchedule) {
      const nextTime = calculateNextCallTime(
        updates.preferred_time || meta.preferred_time || DEFAULT_TIME,
        updates.preferred_days || meta.preferred_days || "daily",
        meta.timezone || "Europe/Paris"
      );

      const messageId = await scheduleNextCall({
        phone: meta.phone,
        customerId,
        scheduledFor: nextTime,
      });

      updates.next_call_scheduled = nextTime.toISOString();
      updates.qstash_message_id = messageId;

      console.log(`Scheduled next call for ${meta.phone} at ${nextTime.toISOString()}`);
    }

    // ========================================
    // 10. Persist Updates to Stripe
    // ========================================
    await updateCustomerMetadata(customerId, { ...meta, ...updates });

    return Response.json({
      success: true,
      status: callStatus,
      persona: updates.persona || meta.persona,
      userStatus: updates.status || meta.status,
      nextCallScheduled: updates.next_call_scheduled || null,
    });
  } catch (error) {
    console.error("Dipler webhook error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
