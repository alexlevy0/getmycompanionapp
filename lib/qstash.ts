import { Client, Receiver } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

interface ScheduleParams {
  phone: string;
  customerId: string;
  scheduledFor: Date;
}

export async function scheduleNextCall(
  params: ScheduleParams
): Promise<string> {
  const { phone, customerId, scheduledFor } = params;

  const result = await qstash.publishJSON({
    url: `${process.env.API_BASE_URL}/api/trigger-call`,
    body: { phone, customerId },
    notBefore: Math.floor(scheduledFor.getTime() / 1000),
  });

  return result.messageId;
}

export async function cancelScheduledCall(messageId: string): Promise<void> {
  await qstash.messages.delete(messageId);
}

export async function verifyQStashSignature(request: Request): Promise<boolean> {
  try {
    const body = await request.clone().text();
    const signature = request.headers.get("upstash-signature");

    if (!signature) return false;

    return await receiver.verify({
      body,
      signature,
      url: `${process.env.API_BASE_URL}/api/trigger-call`,
    });
  } catch {
    return false;
  }
}
