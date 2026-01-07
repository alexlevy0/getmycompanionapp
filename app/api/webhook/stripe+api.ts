import Stripe from "stripe";
import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall, cancelScheduledCall } from "@/lib/qstash";
import { calculateNextCallTime } from "@/lib/utils";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      return new Response("Invalid signature", { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) {
          const meta = customer.metadata;

          // Schedule first paid call
          const nextTime = calculateNextCallTime(
            meta.preferred_time,
            meta.preferred_days,
            meta.timezone
          );

          const messageId = await scheduleNextCall({
            phone: meta.phone,
            customerId,
            scheduledFor: nextTime,
          });

          // Activate subscription
          await updateCustomerMetadata(customerId, {
            ...meta,
            status: "active",
            next_call_scheduled: nextTime.toISOString(),
            qstash_message_id: messageId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) {
          const meta = customer.metadata;

          // Cancel scheduled call
          if (meta.qstash_message_id) {
            await cancelScheduledCall(meta.qstash_message_id);
          }

          await updateCustomerMetadata(customerId, {
            ...meta,
            status: "churned",
            next_call_scheduled: "",
            qstash_message_id: "",
          });
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripe webhook error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
