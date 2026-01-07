import { findCustomerByPhone, createCustomer } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { TRIAL_CALLS } from "@/constants/personas";

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

    // Check existing customer
    const existing = await findCustomerByPhone(formattedPhone);
    if (existing) {
      const meta = existing.metadata;
      if (
        meta.status === "active" ||
        meta.status === "onboarding" ||
        (meta.status === "trial" && parseInt(meta.trial_calls_remaining) > 0)
      ) {
        return Response.json(
          { error: "Ce numéro est déjà enregistré" },
          { status: 409 }
        );
      }
    }

    // Create customer with "onboarding" status - no persona yet
    // Persona will be determined by Receptionist agent during first call
    const metadata: Record<string, string> = {
      phone: formattedPhone,
      // No persona yet - will be set by Receptionist webhook
      status: "onboarding",
      trial_calls_remaining: TRIAL_CALLS.toString(),
      total_calls: "0",
      consecutive_no_answer: "0",
      timezone: "Europe/Paris",
      preferred_time: "10:00", // Default, will be updated by Receptionist
      preferred_days: "daily",
    };

    const customer = await createCustomer(metadata);

    // Trigger first call with Receptionist agent (isFirstCall = true)
    await triggerDiplerCall({
      phone: formattedPhone,
      customerId: customer.id,
      isFirstCall: true, // This triggers the Receptionist agent
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
