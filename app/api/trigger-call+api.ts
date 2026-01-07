import { stripe } from "@/lib/stripe";
import { verifyQStashSignature } from "@/lib/qstash";
import { triggerDiplerCall } from "@/lib/dipler";
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

    // Check eligibility - must have a persona assigned (not still onboarding)
    if (meta.status === "onboarding") {
      console.log(`Skipping scheduled call for ${phone}: still onboarding`);
      return Response.json({ skipped: true, reason: "still_onboarding" });
    }

    const canCall =
      meta.status === "active" ||
      (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0);

    if (!canCall) {
      console.log(`Skipping call for ${phone}: not eligible`);
      return Response.json({ skipped: true, reason: "not_eligible" });
    }

    // Build context from last call
    const context = meta.last_call_summary
      ? `Résumé du dernier appel: ${meta.last_call_summary}`
      : undefined;

    // Trigger call with assigned persona (isFirstCall = false)
    await triggerDiplerCall({
      phone: meta.phone,
      customerId: customer.id,
      persona: meta.persona as Persona,
      isFirstCall: false,
      context,
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
