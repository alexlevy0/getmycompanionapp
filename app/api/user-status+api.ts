import { stripe } from "@/lib/stripe";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { ERROR_MESSAGES } from "@/constants/messages";
import type { Persona, UserStatus } from "@/types";

const log = createScopedLogger("user-status");

// ============================================
// Response Types
// ============================================

interface UserStatusResponse {
  status: UserStatus;
  persona?: Persona;
  firstName?: string;
  phone: string;
  
  // Call info
  nextCallScheduled?: string;
  totalCalls: number;
  trialCallsRemaining: number;
  
  // Preferences
  preferredTime: string;
  preferredDays: string;
  timezone: string;
  
  // Payment
  paymentLink?: string;
}

// ============================================
// Extract Bearer Token
// ============================================

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

// ============================================
// Find Customer by Auth Token
// ============================================

async function findCustomerByToken(token: string) {
  try {
    const result = await stripe.customers.search({
      query: `metadata['auth_token']:'${token}'`,
    });
    return result.data[0] || null;
  } catch (error) {
    log.error("Failed to search customer by token", { error });
    return null;
  }
}

// ============================================
// User Status Endpoint
// ============================================

export async function GET(request: Request): Promise<Response> {
  try {
    // 1. Extract token from Authorization header
    const token = extractBearerToken(request);
    
    if (!token) {
      log.warn("Missing or invalid Authorization header");
      return Response.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    // 2. Find customer by token
    const customer = await findCustomerByToken(token);
    
    if (!customer) {
      log.warn("No customer found for token");
      return Response.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    const meta = customer.metadata;

    // 3. Build response
    const response: UserStatusResponse = {
      status: meta.status as UserStatus,
      persona: meta.persona as Persona | undefined,
      firstName: meta.first_name,
      phone: meta.phone,
      
      nextCallScheduled: meta.next_call_scheduled || undefined,
      totalCalls: parseInt(meta.total_calls || "0"),
      trialCallsRemaining: parseInt(meta.trial_calls_remaining || "0"),
      
      preferredTime: meta.preferred_time || config.defaults.preferredTime,
      preferredDays: meta.preferred_days || config.defaults.preferredDays,
      timezone: meta.timezone || config.defaults.timezone,
    };

    // 4. Add payment link if awaiting payment
    if (meta.status === "awaiting_payment") {
      const paymentLink = config.stripe.paymentLinkStandard();
      if (paymentLink) {
        response.paymentLink = `${paymentLink}?client_reference_id=${customer.id}`;
      }
    }

    log.info("User status retrieved", { 
      customerId: customer.id, 
      status: meta.status 
    });

    return Response.json(response);
  } catch (error) {
    log.error("User status failed", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Response.json(
      { error: ERROR_MESSAGES.internalError },
      { status: 500 }
    );
  }
}
