import { infrai, type QueueMessage } from "./infrai.ts";

export type LogisticsFollowUp = {
  order_id: string;
  tracking_number: string;
  customer_email: string;
};

export function hoursToSeconds(hours: number): number {
  if (!Number.isInteger(hours) || hours < 1) {
    throw new Error("FOLLOW_UP_HOURS must be a positive whole number.");
  }
  return hours * 60 * 60;
}

async function enqueueFollowUp(payload: LogisticsFollowUp): Promise<void> {
  await infrai.queue.create("storefront-logistics-follow-up-queue");
  await infrai.queue.publish(payload, `logistics-follow-up:${payload.order_id}`);
  console.log(`Queued logistics follow-up for order ${payload.order_id}.`);
}

async function sendStorefrontFollowUp(message: QueueMessage): Promise<void> {
  const orderId = String(message.payload.order_id);
  const trackingNumber = String(message.payload.tracking_number);

  // Replace this storefront action with the notification call already used at checkout.
  console.log(`Follow-up sent for order ${orderId}, tracking ${trackingNumber}.`);
  await infrai.queue.ack(message.message_id, `ack-logistics-follow-up:${message.message_id}`);
}

async function delayNextFollowUp(hours: number): Promise<void> {
  const batch = await infrai.queue.consume(1, hoursToSeconds(hours));
  console.log(`Delayed ${batch.messages?.length ?? 0} logistics follow-up for ${hours} hours.`);
}

async function runWorker(): Promise<void> {
  const batch = await infrai.queue.consume(10, 60);
  for (const message of batch.messages ?? []) await sendStorefrontFollowUp(message);
  console.log(`Processed ${batch.messages?.length ?? 0} logistics follow-ups.`);
}

function samplePayload(): LogisticsFollowUp {
  return {
    order_id: process.env.ORDER_ID ?? "order_1042",
    tracking_number: process.env.TRACKING_NUMBER ?? "TRACK-1042",
    customer_email: process.env.CUSTOMER_EMAIL ?? "shopper@example.com"
  };
}

if (process.argv[1]?.endsWith("logistics_follow_up.ts")) {
  const command = process.argv[2];
  if (command === "enqueue") {
    await enqueueFollowUp(samplePayload());
  } else if (command === "delay") {
    await delayNextFollowUp(Number(process.env.FOLLOW_UP_HOURS ?? "6"));
  } else if (command === "work") {
    await runWorker();
  } else {
    console.error("Run with enqueue, delay, or work.");
    process.exitCode = 1;
  }
}
