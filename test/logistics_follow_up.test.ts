import test from "node:test";
import assert from "node:assert/strict";
import { hoursToSeconds } from "../src/logistics_follow_up.ts";

test("turns a storefront follow-up delay into queue visibility seconds", () => {
  assert.equal(hoursToSeconds(6), 21_600);
});

test("rejects partial or non-positive hours", () => {
  assert.throws(() => hoursToSeconds(0));
  assert.throws(() => hoursToSeconds(1.5));
});
