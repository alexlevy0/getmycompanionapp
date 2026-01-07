import { stripe } from "@/lib/stripe";
import { verifyQStashSignature } from "@/lib/qstash";
import { triggerDiplerCall } from "@/lib/dipler";

export async function POST(request: Request): Promise<Response> {
  try {
    // Vérifier signature QStash
    const isValid = await verifyQStashSignature(request);
    if (!isValid) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { phone, customerId } = await request.json();

    // Récupérer Customer
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return new Response("Customer deleted", { status: 404 });
    }

    const meta = customer.metadata;

    // Vérifier éligibilité
    const canCall =
      meta.status === "active" ||
      (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0);

    if (!canCall) {
      console.log(`Skipping call for ${phone}: not eligible`);
      return Response.json({ skipped: true, reason: "not_eligible" });
    }

    // Déclencher appel
    await triggerDiplerCall({
      phone: meta.phone,
      customerId: customer.id,
      isFirstCall: false,
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
