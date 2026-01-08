import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { billingService } from "@/lib/services/billing.service";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api-response";

// ============================================
// Stripe Webhook Handler
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Verify signature
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return apiError("Missing signature", 400);
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return apiError("Invalid signature", 400);
    }

    console.log(`Stripe webhook received: ${event.type}`);

    // 2. Route to appropriate handler
    switch (event.type) {
      case "checkout.session.completed":
        return handleCheckoutCompleted(event);

      case "customer.subscription.deleted":
        return handleSubscriptionDeleted(event);

      case "invoice.payment_failed":
        return handlePaymentFailed(event);

      default:
        return apiSuccess({ received: true });
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return ApiErrors.internalError("Webhook processing failed");
  }
}

// ============================================
// Event Handlers
// ============================================

async function handleCheckoutCompleted(event: Stripe.Event): Promise<Response> {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId = (session.customer as string) || session.client_reference_id;

  if (!customerId) {
    console.error("Stripe webhook: No customer ID in checkout session");
    return apiError("No customer ID", 400);
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return ApiErrors.notFound("Customer");
  }

  await billingService.activateSubscription(customerId, customer.metadata);

  return apiSuccess({ received: true, activated: true });
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<Response> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return ApiErrors.notFound("Customer");
  }

  await billingService.cancelSubscription(customerId, customer.metadata);

  return apiSuccess({ received: true, cancelled: true });
}

async function handlePaymentFailed(event: Stripe.Event): Promise<Response> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  if (!customerId) {
    return apiSuccess({ received: true });
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return apiSuccess({ received: true });
  }

  await billingService.pauseSubscription(customerId, customer.metadata);

  return apiSuccess({ received: true, paused: true });
}
