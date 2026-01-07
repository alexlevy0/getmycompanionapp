import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";
import { DiplerWebhookPayload } from "@/types";
import { MAX_NO_ANSWER_RETRIES } from "@/constants/personas";

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

      // Update extracted preferences
      if (extracted_data) {
        if (extracted_data.preferred_time)
          updates.preferred_time = extracted_data.preferred_time;
        if (extracted_data.preferred_days)
          updates.preferred_days = extracted_data.preferred_days;
        if (extracted_data.first_name)
          updates.first_name = extracted_data.first_name;
        if (extracted_data.goals) updates.goals = extracted_data.goals;
      }

      // Handle trial countdown
      if (meta.status === "trial") {
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
      const shouldSchedule =
        meta.status === "active" ||
        (meta.status === "trial" &&
          parseInt(updates.trial_calls_remaining || meta.trial_calls_remaining) >
            0);

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
