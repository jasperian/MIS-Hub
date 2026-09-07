import test from "node:test";
import assert from "node:assert/strict";
import { validateRecord } from "../lib/server/validation";

test("IP inventory accepts host boundaries and rejects reserved, invalid and other-subnet addresses", () => {
  for (const ip of ["172.16.11.1", "172.16.11.254"]) {
    assert.doesNotThrow(() => validateRecord("ip", ip, {}));
  }
  for (const ip of [
    "172.16.11.0",
    "172.16.11.255",
    "172.16.11.256",
    "172.16.12.1",
    "172.16.11.01",
  ]) {
    assert.throws(() => validateRecord("ip", ip, {}));
    assert.throws(() => validateRecord("computers", "Workstation", { ip }));
  }
  assert.doesNotThrow(() =>
    validateRecord("computers", "Unassigned laptop", {}),
  );
});

test("inventory cannot become plaintext password storage through nested fields", () => {
  for (const data of [
    { password: "example" },
    { settings: { secret: "example" } },
    { accounts: [{ credential: "example" }] },
  ]) {
    assert.throws(
      () => validateRecord("members", "Test member", data),
      /private vault/,
    );
  }
});

test("toner stock must be a nonnegative whole number", () => {
  for (const quantity of [-1, 1.5, "invalid"]) {
    assert.throws(() => validateRecord("toners", "Cartridge", { quantity }));
  }
  for (const quantity of [0, 10]) {
    assert.doesNotThrow(() =>
      validateRecord("toners", "Cartridge", { quantity }),
    );
  }
});

test("invalid email and unknown inventory categories are rejected", () => {
  assert.throws(() =>
    validateRecord("emails", "Account", { email: "invalid" }),
  );
  assert.throws(() => validateRecord("unknown", "Account", {}));
  assert.throws(() => validateRecord("members", " ", {}));
});
