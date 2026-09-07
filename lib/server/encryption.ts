import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const value = process.env.VAULT_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value))
    throw new Error(
      "VAULT_ENCRYPTION_KEY must contain 64 hexadecimal characters.",
    );
  return Buffer.from(value, "hex");
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    data.toString("hex"),
  ].join(":");
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(":");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "hex")),
    cipher.final(),
  ]).toString("utf8");
}
