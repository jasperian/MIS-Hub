import test from "node:test";
import assert from "node:assert/strict";
import { codeHash, codeMatches, newCode } from "../lib/server/password-recovery";

test("verification codes are six digits, user-bound, and not stored as plaintext", () => {
  const previous = process.env.VAULT_ENCRYPTION_KEY;
  process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64);
  try {
    const code = newCode();
    assert.match(code, /^\d{6}$/);
    const hashed = codeHash("user-a", code);
    assert.notEqual(hashed, code);
    assert.ok(codeMatches("user-a", code, hashed));
    assert.ok(!codeMatches("user-b", code, hashed));
    assert.ok(!codeMatches("user-a", code === "000000" ? "000001" : "000000", hashed));
  } finally {
    if (previous === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = previous;
  }
});
