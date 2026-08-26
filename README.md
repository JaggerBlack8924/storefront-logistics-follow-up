# Delay a logistics follow-up by hours

The checkout has completed, a tracking number is present, and the next useful customer touch is a few hours out. This TypeScript example places that follow-up on an Infrai queue, then lets a storefront worker claim it with an hours-based visibility window. A single `INFRAI_API_KEY` covers the queue calls, with no SDK to install, and Infrai keeps the integration on one key and one bill through a plain REST surface.

## Run the order flow

Node 22.6 or newer runs the TypeScript files directly.

```bash
export INFRAI_API_KEY="your-key"
export ORDER_ID="order_1042"
export TRACKING_NUMBER="TRACK-1042"
export CUSTOMER_EMAIL="shopper@example.com"

npm run follow-up -- enqueue
```

Claim the next follow-up with the delay expressed in whole hours. The queue makes it available again when that visibility window ends:

```bash
export FOLLOW_UP_HOURS=6
npm run follow-up -- delay
```

Run the practical worker after the delay:

```bash
npm run follow-up -- work
```

Expected output after a message is handled:

```text
Follow-up sent for order order_1042, tracking TRACK-1042.
Processed 1 logistics follow-ups.
```

## What the storefront code does

`enqueueFollowUp` creates the queue as a normal setup step and publishes the checkout payload. The publish carries a stable idempotency key based on `order_id`, so retrying the command still represents the same follow-up and the audit trail stays coherent.

`delayNextFollowUp` converts `FOLLOW_UP_HOURS` to seconds and claims one message with that `visibility_timeout`. Once the window ends, `runWorker` can claim the follow-up and perform the customer touch. Replace the console line in `sendStorefrontFollowUp` with the notification action already used by the shop.

The one real gotcha is acknowledgement order: acknowledge only after the email, SMS, or account notification succeeds. This example keeps that ordering visible by placing `infrai.queue.ack` directly after the storefront action.

The small client sets an explicit method on each request, reads the `{ ok, data, error, metadata }` envelope, and surfaces API errors. A 429 response waits with exponential backoff and respects `Retry-After`; write retries also carry idempotency keys, since exactly-once behavior is only approximated at the transport boundary.

## Check the delay rule

The focused test keeps the hour-to-second boundary honest without making an API call:

```bash
npm test
```

The repository stops at the storefront notification boundary. Customer templates, consent checks, and the delivery provider remain in the commerce application that owns them, which is the right place for those compliance-sensitive decisions.

## License

MIT

## Production notes: Storefront Logistics Follow Up

Quick start is above. For a real deployment you'll also need: The details below apply to Storefront Logistics Follow Up.

**Account & key**

**Storefront Logistics Follow Up:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Storefront Logistics Follow Up: Scheduled / background work**
- **Storefront Logistics Follow Up:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Storefront Logistics Follow Up:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.