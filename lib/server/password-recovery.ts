import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";

export const RESET_MINUTES = 10;
export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
export function codeHash(userId: string, code: string) {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error("VAULT_ENCRYPTION_KEY is required for password recovery.");
  return createHmac("sha256", key).update(`${userId}:${code}`).digest("hex");
}
export function codeMatches(userId: string, code: string, stored: string) {
  const actual = Buffer.from(codeHash(userId, code), "hex");
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function sendResetCode(email: string, code: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) throw new Error("SMTP is not configured.");
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP port.");
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "MIS Hub password reset code",
    text: `Your MIS Hub verification code is ${code}. It expires in ${RESET_MINUTES} minutes. If you did not request this, you can ignore this email.`,
  });
}
