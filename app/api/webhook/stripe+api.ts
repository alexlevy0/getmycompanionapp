import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
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
      console.error("Webhook signature verification failed");
      return new Response("Invalid signature", { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        // Activer le customer
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) {
          await stripe.customers.update(customerId, {
            metadata: {
              ...customer.metadata,
              status: "active",
            },
          });

          // Programmer le premier appel payant
          const nextCallTime = calculateNextCallTime(
            customer.metadata.preferred_time || "10:00",
            customer.metadata.preferred_days || "daily",
            customer.metadata.timezone || "Europe/Paris"
          );

          await scheduleNextCall({
            phone: customer.metadata.phone,
            customerId,
            scheduledFor: nextCallTime,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Désactiver le customer
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) {
          // TODO: Annuler le prochain appel schedulé via QStash

          await stripe.customers.update(customerId, {
            metadata: {
              ...customer.metadata,
              status: "churned",
              next_call_scheduled: "",
              qstash_message_id: "",
            },
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
