import { stripe } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";

// ============================================
// Request Immediate Call API
// ============================================

const BLOCKED_STATUSES = new Set(["paused", "awaiting_payment", "churned", "onboarding"]);

export async function POST(request: Request): Promise<Response> {
  try {
    // ========================================
    // 1. Verify Authorization
    // ========================================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const customerId = authHeader.replace("Bearer ", "");

    // ========================================
    // 2. Retrieve Stripe Customer
    // ========================================
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return new Response("Customer not found", { status: 404 });
    }

    const meta = customer.metadata;

    // ========================================
    // 3. Check for Blocked Status
    // ========================================
    if (BLOCKED_STATUSES.has(meta.status)) {
      return Response.json(
        { error: "Appel non disponible dans votre état actuel" },
        { status: 403 }
      );
    }

    // ========================================
    // 4. Check Trial Eligibility
    // ========================================
    if (meta.status === "trial") {
      const remaining = Number.parseInt(meta.trial_calls_remaining || "0", 10);
      if (remaining <= 0) {
        return Response.json(
          { error: "Vous avez épuisé vos appels d'essai" },
          { status: 403 }
        );
      }
    }

    // ========================================
    // 5. Trigger Dipler Call
    // ========================================
    const result = await triggerDiplerCall(meta.phone);

    if (!result.success) {
      console.error("[REQUEST-CALL] Dipler error:", result.error);
      return Response.json(
        { error: result.error || "Erreur lors de l'appel" },
        { status: 500 }
      );
    }

    console.log(`[REQUEST-CALL] Call triggered for ${meta.phone}`);

    return Response.json({
      success: true,
      message: "Appel en cours...",
      futureConversationId: result.futureConversationId,
    });
  } catch (error) {
    console.error("[REQUEST-CALL] Error:", error);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
