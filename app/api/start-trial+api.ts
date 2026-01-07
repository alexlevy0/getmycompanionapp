import { findCustomerByPhone, createCustomer } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { PERSONAS, TRIAL_CALLS } from "@/constants/personas";
import { Persona } from "@/types";

export async function POST(request: Request): Promise<Response> {
  try {
    const { phone, persona } = await request.json();

    // Validation
    if (!phone || !validatePhone(phone)) {
      return Response.json(
        { error: "Numéro de téléphone invalide" },
        { status: 400 }
      );
    }

    if (!persona || !PERSONAS[persona as Persona]) {
      return Response.json({ error: "Persona invalide" }, { status: 400 });
    }

    const formattedPhone = formatPhoneE164(phone);
    const personaConfig = PERSONAS[persona as Persona];

    // Check existing customer
    const existing = await findCustomerByPhone(formattedPhone);
    if (existing) {
      const meta = existing.metadata;
      if (
        meta.status === "active" ||
        parseInt(meta.trial_calls_remaining) > 0
      ) {
        return Response.json(
          { error: "Ce numéro est déjà enregistré" },
          { status: 409 }
        );
      }
    }

    // Create customer
    const metadata: Record<string, string> = {
      phone: formattedPhone,
      persona: persona,
      status: "trial",
      trial_calls_remaining: TRIAL_CALLS.toString(),
      total_calls: "0",
      consecutive_no_answer: "0",
      timezone: "Europe/Paris",
      preferred_time: personaConfig.defaultTime,
      preferred_days: personaConfig.defaultDays,
    };

    const customer = await createCustomer(metadata);

    // Trigger first call
    await triggerDiplerCall({
      phone: formattedPhone,
      customerId: customer.id,
      persona: persona as Persona,
      isFirstCall: true,
    });

    return Response.json({
      success: true,
      message: "Vous allez recevoir un appel dans quelques instants.",
    });
  } catch (error) {
    console.error("start-trial error:", error);
    return Response.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
