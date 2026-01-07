import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";
import { DiplerWebhookPayload, Persona } from "@/types";
import { MAX_NO_ANSWER_RETRIES, PERSONAS } from "@/constants/personas";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload: DiplerWebhookPayload = await request.json();
    const { customer_id, status, summary, extracted_data } = payload;

    // Get customer
    const customer = await stripe.customers.retrieve(customer_id);
    if (customer.deleted) {
      return new Response("Customer not found", { status: 404 });
    }

    const meta = customer.metadata;
    const updates: Record<string, string> = {};
    const isOnboarding = meta.status === "onboarding";

    // Handle no-answer
    if (status === "no_answer") {
      const noAnswerCount = parseInt(meta.consecutive_no_answer || "0") + 1;
      updates.consecutive_no_answer = noAnswerCount.toString();

      if (noAnswerCount < MAX_NO_ANSWER_RETRIES) {
        // Retry in 1 hour
        const retryTime = new Date(Date.now() + 60 * 60 * 1000);
        const messageId = await scheduleNextCall({
          phone: meta.phone,
          customerId: customer_id,
          scheduledFor: retryTime,
        });
        updates.qstash_message_id = messageId;
        updates.next_call_scheduled = retryTime.toISOString();
      } else {
        updates.status = "paused";
      }

      await updateCustomerMetadata(customer_id, { ...meta, ...updates });
      return Response.json({ handled: "no_answer" });
    }

    // Handle completed call
    if (status === "completed") {
      const totalCalls = parseInt(meta.total_calls || "0") + 1;

      updates.total_calls = totalCalls.toString();
      updates.last_call_date = new Date().toISOString();
      updates.consecutive_no_answer = "0";

      if (summary) {
        updates.last_call_summary = summary.slice(0, 500);
      }

      // ============================================
      // VOICE-FIRST ONBOARDING: Handle Receptionist response
      // ============================================
      if (isOnboarding && extracted_data) {
        // Receptionist agent detected the best persona for this user
        if (extracted_data.detected_persona) {
          const detectedPersona = extracted_data.detected_persona as Persona;
          
          // Validate the detected persona
          if (PERSONAS[detectedPersona]) {
            updates.persona = detectedPersona;
            updates.status = "trial"; // Move from onboarding to trial
            
            // Apply persona-specific defaults if not already extracted
            if (!extracted_data.preferred_time) {
              updates.preferred_time = PERSONAS[detectedPersona].defaultTime;
            }
            if (!extracted_data.preferred_days) {
              updates.preferred_days = PERSONAS[detectedPersona].defaultDays;
            }
            
            console.log(`Onboarding complete: ${meta.phone} → ${detectedPersona}`);
          } else {
            // Fallback to "friend" if invalid persona detected
            updates.persona = "friend";
            updates.status = "trial";
            console.log(`Invalid persona detected, defaulting to friend: ${meta.phone}`);
          }
        } else {
          // No persona detected - default to "friend"
          updates.persona = "friend";
          updates.status = "trial";
          console.log(`No persona detected, defaulting to friend: ${meta.phone}`);
        }
      }

      // Update extracted preferences (for all calls)
      if (extracted_data) {
        if (extracted_data.preferred_time)
          updates.preferred_time = extracted_data.preferred_time;
        if (extracted_data.preferred_days)
          updates.preferred_days = extracted_data.preferred_days;
        if (extracted_data.first_name)
          updates.first_name = extracted_data.first_name;
        if (extracted_data.goals) 
          updates.goals = extracted_data.goals;
      }

      // Handle trial countdown (only for trial status, not onboarding)
      const currentStatus = updates.status || meta.status;
      if (currentStatus === "trial" && !isOnboarding) {
        // Only decrement trial calls for non-onboarding calls
        const remaining = parseInt(meta.trial_calls_remaining) - 1;
        updates.trial_calls_remaining = remaining.toString();

        if (remaining <= 0) {
          // TODO: Send payment SMS via Twilio
          console.log(
            `Trial ended for ${meta.phone}, should send payment link`
          );
        }
      }

      // Schedule next call if eligible
      const finalStatus = updates.status || meta.status;
      const shouldSchedule =
        finalStatus === "active" ||
        (finalStatus === "trial" &&
          parseInt(updates.trial_calls_remaining || meta.trial_calls_remaining) > 0);

      if (shouldSchedule) {
        const nextTime = calculateNextCallTime(
          updates.preferred_time || meta.preferred_time,
          updates.preferred_days || meta.preferred_days,
          meta.timezone
        );

        const messageId = await scheduleNextCall({
          phone: meta.phone,
          customerId: customer_id,
          scheduledFor: nextTime,
        });
        updates.next_call_scheduled = nextTime.toISOString();
        updates.qstash_message_id = messageId;
      }

      await updateCustomerMetadata(customer_id, { ...meta, ...updates });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("dipler webhook error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
