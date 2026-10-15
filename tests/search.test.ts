import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, matchingSearchValue, sortSearchResults, visibleInventory, type SearchResult } from "../lib/search";

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

test("search exposes the field that produced an indirect match", () => {
  assert.equal(matchingSearchValue("jas", ["Laptop 4", "Jason Santos", "External device"]), "Jason Santos");
  assert.equal(matchingSearchValue(" ", ["Jason Santos"]), "");
});

test("search ranks title matches ahead of indirect assignment matches", () => {
  const result = (id: string, title: string, subtitle: string): SearchResult => ({ id, kind: "members", title, subtitle, dealershipId: "d1", dealershipName: "Dealer" });
  const sorted = sortSearchResults("jas", [
    result("batch", "Batch 1", "Assigned to Jason Santos"),
    result("member", "Jason Santos", "IT"),
  ]);
  assert.deepEqual(sorted.map(item => item.id), ["member", "batch"]);
});
