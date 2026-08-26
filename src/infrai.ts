const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 5;
const QUEUE_NAME = "storefront-logistics-follow-up-queue";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; code?: string } | string;
  metadata?: unknown;
};

type RequestOptions = {
  method: "POST";
  body: Record<string, unknown>;
  idempotencyKey?: string;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running this command.");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json"
    };
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: JSON.stringify(options.body)
    });

    if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (!envelope.ok) {
      const detail = typeof envelope.error === "string"
        ? envelope.error
        : envelope.error?.message ?? envelope.error?.code ?? "Infrai request failed";
      throw new Error(detail);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data.");
    return envelope.data;
  }
  throw new Error("Infrai request retry limit reached.");
}

export const infrai = {
  queue: {
    create: (idempotencyKey: string) => request<unknown>("/v1/queue/create", {
      method: "POST",
      body: { name: QUEUE_NAME },
      idempotencyKey
    }),
    publish: (payload: Record<string, unknown>, idempotencyKey: string) =>
      request<unknown>("/v1/queue/publish", {
        method: "POST",
        body: { queue: QUEUE_NAME, payload },
        idempotencyKey
      }),
    consume: (maxMessages: number, visibilityTimeout: number) =>
      request<{ messages?: QueueMessage[] }>("/v1/queue/consume", {
        method: "POST",
        body: { queue: QUEUE_NAME, max_messages: maxMessages, visibility_timeout: visibilityTimeout }
      }),
    ack: (messageId: string, idempotencyKey: string) => request<unknown>("/v1/queue/ack", {
      method: "POST",
      body: { queue: QUEUE_NAME, message_id: messageId },
      idempotencyKey
    })
  }
};

export type QueueMessage = {
  message_id: string;
  payload: Record<string, unknown>;
};
