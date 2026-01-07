import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2024-06-20",
  appInfo: {
    name: "mycompanion",
  },
});

export async function findCustomerByPhone(phone: string) {
  const result = await stripe.customers.search({
    query: `metadata['phone']:'${phone}'`,
  });
  return result.data[0] || null;
}

export async function createCustomer(metadata: Record<string, string>) {
  return stripe.customers.create({ metadata });
}

export async function updateCustomerMetadata(
  customerId: string,
  metadata: Record<string, string>
) {
  return stripe.customers.update(customerId, { metadata });
}
