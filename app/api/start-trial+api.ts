import { findCustomerByPhone, createCustomer } from "@/lib/stripe";
import { triggerDiplerCall } from "@/lib/dipler";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/constants/messages";

const log = createScopedLogger("start-trial");

/**
 * Generates a secure auth token (UUID v4).
 */
function generateAuthToken(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { phone } = await request.json();

    // Validation
    if (!phone || !validatePhone(phone)) {
      return Response.json(
        { error: ERROR_MESSAGES.invalidPhone },
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
          { error: ERROR_MESSAGES.alreadyRegistered },
          { status: 409 }
        );
      }
    }

    // Generate unique auth token for this user
    const authToken = generateAuthToken();

    // Create customer with "onboarding" status
    const metadata: Record<string, string> = {
      phone: formattedPhone,
      status: "onboarding",
      trial_calls_remaining: config.defaults.trialCalls.toString(),
      total_calls: "0",
      consecutive_no_answer: "0",
      timezone: config.defaults.timezone,
      preferred_time: config.defaults.preferredTime,
      preferred_days: config.defaults.preferredDays,
      // Secure auth token for API authentication
      auth_token: authToken,
    };

    const customer = await createCustomer(metadata);

    log.info("Customer created", { 
      customerId: customer.id, 
      phone: formattedPhone 
    });

    // Trigger first call with Receptionist agent
    await triggerDiplerCall({
      phone: formattedPhone,
      isFirstCall: true,
      metadata: {
        customerId: customer.id,
      },
    });

    log.info("First call triggered", { customerId: customer.id });

    // Return token to the client (store securely!)
    return Response.json({
      success: true,
      message: SUCCESS_MESSAGES.callTriggered,
      token: authToken,
    });
  } catch (error) {
    log.error("Start trial failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Response.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
