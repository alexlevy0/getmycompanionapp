import { stripe } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";

export async function POST(request: Request): Promise<Response> {
  try {
    const { phone } = await request.json();

    // Validation
    if (!phone || !validatePhone(phone)) {
      return Response.json(
        { error: "Numéro de téléphone invalide" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneE164(phone);

    // Check si Customer existe déjà
    const existingCustomers = await stripe.customers.search({
      query: `metadata['phone']:'${formattedPhone}'`,
    });

    if (existingCustomers.data.length > 0) {
      const existing = existingCustomers.data[0];
      const meta = existing.metadata;

      // Si déjà actif ou en trial avec appels restants
      if (
        meta.status === "active" ||
        (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0)
      ) {
        return Response.json(
          {
            error: "Ce numéro est déjà enregistré",
            status: meta.status,
          },
          { status: 409 }
        );
      }
    }

    // Créer Customer Stripe
    const customer = await stripe.customers.create({
      metadata: {
        phone: formattedPhone,
        status: "trial",
        trial_calls_remaining: "3",
        total_calls: "0",
        timezone: "Europe/Paris",
        preferred_time: "10:00",
        preferred_days: "daily",
      },
    });

    // Déclencher premier appel Dipler
    await triggerDiplerCall({
      phone: formattedPhone,
      customerId: customer.id,
      isFirstCall: true,
    });

    return Response.json({
      success: true,
      message: "Vous allez recevoir un appel dans quelques instants.",
      customerId: customer.id,
    });
  } catch (error) {
    console.error("start-trial error:", error);
    return Response.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
