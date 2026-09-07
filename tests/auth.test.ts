import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, checkOrigin } from "../lib/server/auth";

test("login hashes are salted and reject incorrect or malformed passwords", () => {
  const password = "A unique long test password";
  const hash = hashPassword(password);
  assert.ok(verifyPassword(password, hash));
  assert.ok(!verifyPassword("incorrect", hash));
  assert.ok(!verifyPassword(password, "malformed"));
  assert.notEqual(hash, hashPassword(password));
  assert.ok(!hash.includes(password));
});

test("mutations reject cross-origin and missing-origin requests", () => {
  const original = process.env.APP_URL;
  try {
    process.env.APP_URL = "https://mis.example.com";
    assert.doesNotThrow(() =>
      checkOrigin(
        new Request("https://mis.example.com/api/records", {
          headers: { origin: "https://mis.example.com" },
        }),
      ),
    );
    assert.throws(() =>
      checkOrigin(
        new Request("https://mis.example.com/api/records", {
          headers: { origin: "https://other.example.com" },
        }),
      ),
    );
    assert.throws(() =>
      checkOrigin(new Request("https://mis.example.com/api/records")),
    );
  } finally {
    if (original === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original;
  }
});
