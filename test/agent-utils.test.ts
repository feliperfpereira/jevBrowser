import assert from "node:assert/strict";
import test from "node:test";
import {
  buildValueCandidates,
  decodeOptionKey,
  isHighRiskElement,
  optionKey,
} from "../src/agent/utils.js";

test("buildValueCandidates keeps variable values local while exposing only descriptions", () => {
  const candidates = buildValueCandidates('Search for "mechanical keyboard"', {
    password: "super-secret",
  });
  const secret = candidates.find((candidate) => candidate.id === "var_password");
  assert.equal(secret?.value, "super-secret");
  assert.equal(secret?.secret, true);
  assert.equal(secret?.description.includes("super-secret"), false);
  assert.ok(candidates.some((candidate) => candidate.value === "mechanical keyboard"));
});

test("option keys round-trip arbitrary values", () => {
  const encoded = optionKey("e12", "São Paulo / BR");
  assert.deepEqual(decodeOptionKey(encoded), {
    elementId: "e12",
    value: "São Paulo / BR",
  });
});

test("policy recognizes high impact controls", () => {
  assert.equal(
    isHighRiskElement({
      id: "e1",
      tag: "button",
      role: "button",
      name: "Place order",
      disabled: false,
    }),
    true,
  );
  assert.equal(
    isHighRiskElement({
      id: "e2",
      tag: "button",
      role: "button",
      name: "Search",
      disabled: false,
    }),
    false,
  );
});
