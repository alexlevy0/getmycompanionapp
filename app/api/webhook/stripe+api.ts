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
      console.error("Stripe webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      // ========================================
      // CHECKOUT COMPLETED: Activate subscription
      // ========================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Get customer ID from session or client_reference_id
        // client_reference_id is set in the Payment Link URL
        const customerId =
          (session.customer as string) || session.client_reference_id;

        if (!customerId) {
          console.error("Stripe webhook: No customer ID in checkout session");
          return Response.json({ error: "No customer ID" }, { status: 400 });
        }

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          console.error(`Stripe webhook: Customer ${customerId} was deleted`);
          return new Response("Customer not found", { status: 404 });
        }

        const meta = customer.metadata;

        console.log(`Payment received for ${meta.phone} (${customerId})`);

        // Schedule first paid call based on preferences
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

        // Activate subscription
        await updateCustomerMetadata(customerId, {
          ...meta,
          status: "active",
          trial_calls_remaining: "0", // Clear trial count
          next_call_scheduled: nextTime.toISOString(),
          qstash_message_id: messageId,
        });

        console.log(
          `Subscription activated for ${meta.phone}, next call: ${nextTime.toISOString()}`
        );
        break;
      }

      // ========================================
      // SUBSCRIPTION DELETED: Stop calls
      // ========================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          return new Response("Customer not found", { status: 404 });
        }

        const meta = customer.metadata;

        console.log(`Subscription cancelled for ${meta.phone}`);

        // Cancel any scheduled call
        if (meta.qstash_message_id) {
          await cancelScheduledCall(meta.qstash_message_id);
        }

        // Mark as churned
        await updateCustomerMetadata(customerId, {
          ...meta,
          status: "churned",
          next_call_scheduled: "",
          qstash_message_id: "",
        });

        break;
      }

      // ========================================
      // PAYMENT FAILED: Pause subscription
      // ========================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (!customerId) break;

        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) break;

        const meta = customer.metadata;

        console.log(`Payment failed for ${meta.phone}`);

        // Cancel scheduled call
        if (meta.qstash_message_id) {
          await cancelScheduledCall(meta.qstash_message_id);
        }

        // Pause until payment is resolved
        await updateCustomerMetadata(customerId, {
          ...meta,
          status: "paused",
          next_call_scheduled: "",
          qstash_message_id: "",
        });

        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
