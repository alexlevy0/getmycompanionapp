import { stripe } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";

interface DiplerWebhookPayload {
  call_id: string;
  phone: string;
  customer_id: string;
  duration_seconds: number;
  status: "completed" | "failed" | "no_answer";
  summary?: string;
  extracted_data?: {
    preferred_time?: string;
    preferred_days?: string;
    first_name?: string;
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // TODO: Vérifier signature Dipler si disponible
    const payload: DiplerWebhookPayload = await request.json();

    const { customer_id, status, summary, extracted_data } = payload;

    // Récupérer Customer
    const customer = await stripe.customers.retrieve(customer_id);
    if (customer.deleted) {
      return new Response("Customer not found", { status: 404 });
    }

    const meta = customer.metadata;
    const totalCalls = parseInt(meta.total_calls || "0") + 1;

    // Préparer updates
    const updates: Record<string, string> = {
      total_calls: totalCalls.toString(),
      last_call_date: new Date().toISOString(),
    };

    if (summary) {
      // Tronquer à 500 chars (limite Stripe metadata)
      updates.last_call_summary = summary.slice(0, 500);
    }

    // Mettre à jour préférences si extraites
    if (extracted_data) {
      if (extracted_data.preferred_time) {
        updates.preferred_time = extracted_data.preferred_time;
      }
      if (extracted_data.preferred_days) {
        updates.preferred_days = extracted_data.preferred_days;
      }
      if (extracted_data.first_name) {
        updates.first_name = extracted_data.first_name;
      }
    }

    // Gérer trial
    if (meta.status === "trial") {
      const remaining = parseInt(meta.trial_calls_remaining) - 1;
      updates.trial_calls_remaining = remaining.toString();

      // Si plus d'appels gratuits, envoyer payment link
      if (remaining <= 0) {
        // TODO: Implémenter sendPaymentLinkSMS via Twilio
        console.log(`Trial ended for ${meta.phone}, should send payment link`);
      }
    }

    // Update Customer
    await stripe.customers.update(customer_id, {
      metadata: { ...meta, ...updates },
    });

    // Schedule prochain appel si éligible
    const shouldSchedule =
      meta.status === "active" ||
      (meta.status === "trial" &&
        parseInt(updates.trial_calls_remaining || "0") > 0);

    if (shouldSchedule && status === "completed") {
      const nextCallTime = calculateNextCallTime(
        updates.preferred_time || meta.preferred_time || "10:00",
        updates.preferred_days || meta.preferred_days || "daily",
        meta.timezone || "Europe/Paris"
      );

      const messageId = await scheduleNextCall({
        phone: meta.phone,
        customerId: customer_id,
        scheduledFor: nextCallTime,
      });

      // Sauvegarder message_id pour pouvoir annuler si besoin
      await stripe.customers.update(customer_id, {
        metadata: {
          ...meta,
          ...updates,
          next_call_scheduled: nextCallTime.toISOString(),
          qstash_message_id: messageId,
        },
      });
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
