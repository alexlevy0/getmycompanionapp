import { stripe } from "@/lib/stripe";
import { DiplerWebhookSchema } from "@/lib/schemas";
import { callHandlerService } from "@/lib/services/call-handler.service";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api-response";

// ============================================
// Dipler Webhook Handler
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Parse and validate payload
    const json = await request.json();
    const result = DiplerWebhookSchema.safeParse(json);

    if (!result.success) {
      console.error("Dipler webhook validation failed", result.error);
      return apiError("Invalid payload", 400);
    }

    const payload = result.data;
    const customerId = payload.metadata.customerId;

    // 2. Retrieve customer
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      console.error(`Dipler webhook: Customer ${customerId} was deleted`);
      return ApiErrors.notFound("Customer");
    }

    // 3. Handle call via service
    const result2 = await callHandlerService.handleWebhook(payload, customer);

    // 4. Return response
    return apiSuccess({
      success: true,
      status: result2.status,
      userStatus: result2.userStatus,
      nextCallScheduled: result2.nextCallScheduled,
      ...(result2.retryScheduled !== undefined && { retryScheduled: result2.retryScheduled }),
    });
  } catch (error) {
    console.error("Dipler webhook error:", error);
    return ApiErrors.internalError("Webhook processing failed");
  }
}
