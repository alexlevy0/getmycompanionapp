// ============================================
// Centralized Configuration
// ============================================

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// ============================================
// App Config
// ============================================

export const config = {
  // Environment
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  
  // API
  apiBaseUrl: () => requireEnv("API_BASE_URL"),
  
  // Stripe
  stripe: {
    secretKey: () => requireEnv("STRIPE_SECRET_KEY"),
    webhookSecret: () => requireEnv("STRIPE_WEBHOOK_SECRET"),
    paymentLinkStandard: () => optionalEnv("STRIPE_PAYMENT_LINK_STANDARD", ""),
    paymentLinkFamily: () => optionalEnv("STRIPE_PAYMENT_LINK_FAMILY", ""),
  },
  
  // Dipler
  dipler: {
    apiKey: () => requireEnv("DIPLER_API_KEY"),
    agentReceptionist: () => requireEnv("DIPLER_AGENT_RECEPTIONIST"),
    agentCompanion: () => optionalEnv("DIPLER_AGENT_COMPANION", ""),
    agentCoach: () => optionalEnv("DIPLER_AGENT_COACH", ""),
    agentMentor: () => optionalEnv("DIPLER_AGENT_MENTOR", ""),
    agentFriend: () => optionalEnv("DIPLER_AGENT_FRIEND", ""),
  },
  
  // QStash
  qstash: {
    token: () => requireEnv("QSTASH_TOKEN"),
    currentSigningKey: () => requireEnv("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: () => requireEnv("QSTASH_NEXT_SIGNING_KEY"),
  },
  
  // Twilio
  twilio: {
    accountSid: () => optionalEnv("TWILIO_ACCOUNT_SID", ""),
    authToken: () => optionalEnv("TWILIO_AUTH_TOKEN", ""),
    phoneNumber: () => optionalEnv("TWILIO_PHONE_NUMBER", ""),
    isConfigured: () => !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    ),
  },
  
  // Defaults
  defaults: {
    timezone: "Europe/Paris",
    preferredTime: "10:00",
    preferredDays: "daily",
    trialCalls: 3,
    maxNoAnswerRetries: 3,
  },
};
