import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
  appInfo: {
    name: "mycompanion",
  },
});
