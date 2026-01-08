import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { redis } from "@/lib/redis";
import { hashToken } from "@/lib/crypto";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import type { UserStatus } from "@/types";
import { cacheUserProfile } from "@/lib/auth";

const log = createScopedLogger("auth-verify-magic-link");

function generateAuthToken(): string {
  return crypto.randomUUID();
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // 1. Validate token param
    if (!token || token.length !== 64) {
      return Response.json(
        { error: "Lien invalide ou expiré." },
        { status: 400 }
      );
    }

    // 2. Check Redis
    if (!redis) {
      return Response.json(
        { error: "Service indisponible." },
        { status: 503 }
      );
    }

    const storedData = await redis.get<string>(`magic-link:${token}`);
    
    if (!storedData) {
      return Response.json(
        { error: "Lien expiré ou déjà utilisé." },
        { status: 400 }
      );
    }

    // 3. Parse stored data
    let data: { email: string; customerId: string };
    try {
      data = typeof storedData === "string" ? JSON.parse(storedData) : storedData;
    } catch {
      return Response.json(
        { error: "Lien invalide." },
        { status: 400 }
      );
    }

    // 4. Get customer from Stripe
    const customer = await stripe.customers.retrieve(data.customerId);
    
    if (customer.deleted) {
      return Response.json(
        { error: "Compte introuvable." },
        { status: 404 }
      );
    }

    // 5. Generate new auth token
    const newAuthToken = generateAuthToken();
    const newTokenHash = hashToken(newAuthToken);

    // 6. Update Stripe with new token hash
    const updatedCustomer = await updateCustomerMetadata(customer.id, {
      ...customer.metadata,
      auth_token_hash: newTokenHash,
    });

    // 7. Cache the profile for fast access
    await cacheUserProfile(newAuthToken, updatedCustomer);

    // 8. Delete magic link token (one-time use)
    await redis.del(`magic-link:${token}`);

    // 8. Build user data response
    const meta = customer.metadata;
    const userData: Record<string, unknown> = {
      status: meta.status as UserStatus,
      firstName: meta.first_name,
      phone: meta.phone,
      email: customer.email,
      nextCallScheduled: meta.next_call_scheduled,
      totalCalls: Number.parseInt(meta.total_calls || "0", 10),
      trialCallsRemaining: Number.parseInt(meta.trial_calls_remaining || "0", 10),
      preferredTime: meta.preferred_time || config.defaults.preferredTime,
      preferredDays: meta.preferred_days || config.defaults.preferredDays,
      timezone: meta.timezone || config.defaults.timezone,
    };

    if (meta.status === "awaiting_payment") {
      const paymentLink = config.stripe.paymentLinkStandard();
      if (paymentLink) {
        userData.paymentLink = `${paymentLink}?client_reference_id=${customer.id}`;
      }
    }

    log.info(`User ${data.email} logged in via magic link`);
    
    return Response.json({
      success: true,
      token: newAuthToken,
      user: userData,
    });
  } catch (error) {
    log.error("Verify magic link error", { error });
    return Response.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}
