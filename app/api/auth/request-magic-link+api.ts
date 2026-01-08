import { redis } from "@/lib/redis";
import { sendMagicLinkEmail } from "@/lib/resend";
import { stripe } from "@/lib/stripe";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { hashToken } from "@/lib/crypto";

const log = createScopedLogger("auth-magic-link");

// Magic Link Token TTL: 15 minutes
const TOKEN_TTL_SECONDS = 900;

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateAuthToken(): string {
  return crypto.randomUUID();
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { email } = await request.json();
    const ip = getClientIp(request);

    // 1. Validate email
    if (!email || !isValidEmail(email)) {
      return Response.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Rate limiting (5 requests per 10 mins per IP)
    if (redis) {
      const rateLimitKey = `ratelimit:magic-link:${ip}`;
      const requestCount = await redis.incr(rateLimitKey);
      if (requestCount === 1) {
        await redis.expire(rateLimitKey, 600);
      }
      if (requestCount > 5) {
        return Response.json(
          { error: "Trop de demandes. Réessayez dans 10 minutes." },
          { status: 429 }
        );
      }
    } else {
      log.error("Redis not available");
      return Response.json(
        { error: "Service indisponible." },
        { status: 503 }
      );
    }

    // 3. Find or create customer by email
    const searchResult = await stripe.customers.search({
      query: `email:'${normalizedEmail}'`,
    });
    
    let customer = searchResult.data[0];
    let firstName: string | undefined;
    let isNewUser = false;

    if (customer) {
      // Existing customer
      firstName = customer.metadata.first_name;
    } else {
      // New user - create customer with email
      isNewUser = true;
      const authToken = generateAuthToken();
      const authTokenHash = hashToken(authToken);

      customer = await stripe.customers.create({
        email: normalizedEmail,
        metadata: {
          status: "trial",
          trial_calls_remaining: config.defaults.trialCalls.toString(),
          total_calls: "0",
          timezone: config.defaults.timezone,
          preferred_time: config.defaults.preferredTime,
          preferred_days: config.defaults.preferredDays,
          auth_token_hash: authTokenHash,
        },
      });

      log.info(`New customer created for ${normalizedEmail}`);
    }

    // 4. Generate token and store in Redis
    const token = generateToken();
    await redis.setex(
      `magic-link:${token}`,
      TOKEN_TTL_SECONDS,
      JSON.stringify({ 
        email: normalizedEmail, 
        customerId: customer.id,
        isNewUser 
      })
    );

    // 5. Send magic link email
    const result = await sendMagicLinkEmail({
      email: normalizedEmail,
      token,
      firstName,
    });

    if (!result.success) {
      log.error("Failed to send magic link", { error: result.error });
      return Response.json(
        { error: "Erreur lors de l'envoi de l'email." },
        { status: 500 }
      );
    }

    log.info(`Magic link sent to ${normalizedEmail} (new: ${isNewUser})`);
    
    return Response.json({
      success: true,
      message: isNewUser 
        ? "Compte créé ! Vérifiez votre email pour vous connecter."
        : "Lien de connexion envoyé par email.",
      isNewUser,
    });
  } catch (error) {
    log.error("Request magic link error", { error });
    return Response.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}
