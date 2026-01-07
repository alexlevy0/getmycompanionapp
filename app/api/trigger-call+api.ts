import { stripe } from "@/lib/stripe";
import { verifyQStashSignature } from "@/lib/qstash";
import { triggerDiplerCall, getPersonaAgentId } from "@/lib/dipler";
import { Persona } from "@/types";

// ============================================
// Statuses that block calls (require payment)
// ============================================
const BLOCKED_STATUSES = ["paused", "awaiting_payment", "churned", "onboarding"];

export async function POST(request: Request): Promise<Response> {
  try {
    // ========================================
    // 1. Verify QStash Signature
    // ========================================
    const isValid = await verifyQStashSignature(request);
    if (!isValid) {
      console.error("trigger-call: Invalid QStash signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const { phone, customerId } = await request.json();

    // ========================================
    // 2. Retrieve Stripe Customer
    // ========================================
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      console.error(`trigger-call: Customer ${customerId} was deleted`);
      return new Response("Customer deleted", { status: 404 });
    }

    const meta = customer.metadata;

    // ========================================
    // 3. Check for Blocked Status
    // ========================================
    if (BLOCKED_STATUSES.includes(meta.status)) {
      console.log(
        `trigger-call: Skipping ${phone} - status: ${meta.status}`
      );

      // Return 200 to prevent QStash retries
      // Different reasons for different statuses
      if (meta.status === "awaiting_payment") {
        return Response.json({ skipped: true, reason: "payment_required" });
      }
      if (meta.status === "onboarding") {
        return Response.json({ skipped: true, reason: "still_onboarding" });
      }
      if (meta.status === "churned") {
        return Response.json({ skipped: true, reason: "subscription_cancelled" });
      }
      return Response.json({ skipped: true, reason: "paused" });
    }

    // ========================================
    // 4. Check Trial Eligibility
    // ========================================
    if (meta.status === "trial") {
      const remaining = parseInt(meta.trial_calls_remaining || "0");
      if (remaining <= 0) {
        console.log(`trigger-call: Skipping ${phone} - no trial calls remaining`);
        return Response.json({ skipped: true, reason: "no_trial_calls" });
      }
    }

    // ========================================
    // 5. Check Active Status
    // ========================================
    const canCall = meta.status === "active" || meta.status === "trial";

    if (!canCall) {
      console.log(`trigger-call: Skipping ${phone} - not eligible (status: ${meta.status})`);
      return Response.json({ skipped: true, reason: "not_eligible" });
    }

    // ========================================
    // 6. Build Context & Trigger Call
    // ========================================
    const context = meta.last_call_summary
      ? `Résumé du dernier appel: ${meta.last_call_summary}`
      : undefined;

    const persona = (meta.persona as Persona) || "friend";
    const agentId = getPersonaAgentId(persona);

    await triggerDiplerCall({
      phone: meta.phone,
      agentId,
      context,
      metadata: {
        customerId: customer.id,
        persona,
      },
    });

    console.log(`trigger-call: Call triggered for ${phone} with persona ${persona}`);

    return Response.json({ success: true, persona });
  } catch (error) {
    console.error("trigger-call error:", error);
    return Response.json(
      { error: "Failed to trigger call" },
      { status: 500 }
    );
  }
}
