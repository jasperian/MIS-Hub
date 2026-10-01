import test from "node:test";
import assert from "node:assert/strict";
import { validateRecord } from "../lib/server/validation";
import { isMainSubnetHost, mainSubnetAssignedCount } from "../lib/ip-addresses";

test("IP inventory accepts main subnet and manual VLAN addresses", () => {
  for (const ip of ["172.16.11.1", "172.16.11.254", "172.16.10.50", "10.20.30.40"]) {
    assert.doesNotThrow(() => validateRecord("ip", ip, {}));
    assert.doesNotThrow(() => validateRecord("access-points", "AP", { ip }));
  }
  for (const ip of [
    "172.16.11.0",
    "172.16.11.255",
    "172.16.11.256",
    "172.16.11.01",
    "172.16.10.050",
    "192.168.1",
    "not-an-ip",
  ]) {
    assert.throws(() => validateRecord("ip", ip, {}));
    assert.throws(() => validateRecord("computers", "Workstation", { ip }));
  }
  assert.doesNotThrow(() =>
    validateRecord("computers", "Unassigned laptop", {}),
  );
});

test("main subnet counts ignore manual VLAN addresses and duplicate entries", () => {
  const addresses = ["172.16.11.1", "172.16.11.1", "172.16.11.254", "172.16.10.50"];
  assert.equal(mainSubnetAssignedCount(addresses), 2);
  assert.equal(254 - mainSubnetAssignedCount(addresses), 252);
  assert.equal(isMainSubnetHost("172.16.10.50"), false);
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
