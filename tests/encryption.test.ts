import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "../lib/server/encryption";

test("vault encryption protects credentials and detects alteration", () => {
  const original = process.env.VAULT_ENCRYPTION_KEY;
  try {
    process.env.VAULT_ENCRYPTION_KEY = "ab".repeat(32);
    const plaintext = "Sensitive credential 🔐 with unicode";
    const first = encrypt(plaintext);
    assert.equal(decrypt(first), plaintext);
    assert.notEqual(
      first,
      encrypt(plaintext),
      "each encryption must use a fresh nonce",
    );
    assert.ok(!first.includes(plaintext));
    const [iv, tag, ciphertext] = first.split(":");
    const changed =
      (ciphertext.startsWith("00") ? "01" : "00") + ciphertext.slice(2);
    assert.throws(() => decrypt(`${iv}:${tag}:${changed}`));
    process.env.VAULT_ENCRYPTION_KEY = "cd".repeat(32);
    assert.throws(
      () => decrypt(first),
      "a different key must not decrypt existing secrets",
    );
    process.env.VAULT_ENCRYPTION_KEY = "invalid";
    assert.throws(() => encrypt(plaintext), /64 hexadecimal/);
    delete process.env.VAULT_ENCRYPTION_KEY;
    assert.throws(() => encrypt(plaintext), /64 hexadecimal/);
  } finally {
    if (original === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = original;
  }
});
