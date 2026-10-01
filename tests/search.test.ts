import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, visibleInventory } from "../lib/search";

const records = [
  { id: "m1", kind: "members", data: { userId: "u1", email: "one@example.com" } },
  { id: "m2", kind: "members", data: { userId: "u2", email: "two@example.com" } },
  { id: "c1", kind: "computers", data: { memberId: "m1", printerId: "p1" } },
  { id: "c2", kind: "computers", data: { memberId: "m2" } },
  { id: "p1", kind: "printers", data: {} },
  { id: "p2", kind: "printers", data: {} },
  { id: "e1", kind: "emails", data: { memberIds: ["m1"] } },
];

test("search inventory visibility follows member ownership and connected printer access", () => {
  assert.deepEqual(visibleInventory(records, { id: "u1", email: "one@example.com", role: "MEMBER" }).map(row => row.id), ["m1", "c1", "p1", "e1"]);
  assert.equal(visibleInventory(records, { id: "u1", email: "one@example.com", role: "IT" }).length, records.length);
});

test("search matching ignores case and blank queries", () => {
  assert.equal(matchesSearch(" LAP ", ["Office Laptop", "ABC-123"]), true);
  assert.equal(matchesSearch("123", ["Office Laptop", "ABC-123"]), true);
  assert.equal(matchesSearch(" ", ["Office Laptop"]), false);
});
