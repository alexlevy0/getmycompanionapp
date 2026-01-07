import { stripe } from "@/lib/stripe";
import { verifyQStashSignature } from "@/lib/qstash";
import { triggerDiplerCall, getPersonaAgentId } from "@/lib/dipler";
import { Persona } from "@/types";

export async function POST(request: Request): Promise<Response> {
  try {
    // Verify QStash signature
    const isValid = await verifyQStashSignature(request);
    if (!isValid) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { phone, customerId } = await request.json();

    // Get customer
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return new Response("Customer deleted", { status: 404 });
    }

    const meta = customer.metadata;

    // Skip if still onboarding (shouldn't happen, but safety check)
    if (meta.status === "onboarding") {
      console.log(`Skipping scheduled call for ${phone}: still onboarding`);
      return Response.json({ skipped: true, reason: "still_onboarding" });
    }

    // Check eligibility
    const canCall =
      meta.status === "active" ||
      (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0);

    if (!canCall) {
      console.log(`Skipping call for ${phone}: not eligible (status: ${meta.status})`);
      return Response.json({ skipped: true, reason: "not_eligible" });
    }

    // Build context from last call
    const context = meta.last_call_summary
      ? `Résumé du dernier appel: ${meta.last_call_summary}`
      : undefined;

    // Get persona-specific agent
    const persona = (meta.persona as Persona) || "friend";
    const agentId = getPersonaAgentId(persona);

    // Trigger call with assigned persona agent
    await triggerDiplerCall({
      phone: meta.phone,
      agentId,
      context,
      metadata: {
        customerId: customer.id,
        persona,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("trigger-call error:", error);
    return Response.json(
      { error: "Failed to trigger call" },
      { status: 500 }
    );
  }
}
