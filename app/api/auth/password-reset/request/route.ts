import { db } from "@/lib/server/db";
import { body, checkOrigin, failure, string, HttpError } from "@/lib/server/auth";
import { codeHash, newCode, sendResetCode } from "@/lib/server/password-recovery";

const message = "If an active MIS login uses that email, a verification code will be sent.";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = await body(request);
    const email = string(input.email, "Email").toLowerCase();
    const user = await db.user.findUnique({ where: { email }, select: { id: true, active: true, email: true } });
    if (!user?.active) return Response.json({ message });
    const now = new Date();
    const existing = await db.passwordReset.findUnique({ where: { userId: user.id } });
    const windowStart = existing && now.getTime() - existing.windowStart.getTime() < 60 * 60 * 1000 ? existing.windowStart : now;
    const requests = windowStart === existing?.windowStart ? existing.requests : 0;
    if (requests >= 5 || (existing?.lastRequestedAt && now.getTime() - existing.lastRequestedAt.getTime() < 60_000))
      return Response.json({ message });
    const reserved = existing
      ? await db.passwordReset.updateMany({ where: { userId: user.id, requests: existing.requests, windowStart: existing.windowStart }, data: { requests: requests + 1, windowStart, lastRequestedAt: now, codeHash: null, expiresAt: null, attempts: 0 } })
      : null;
    if (existing && !reserved?.count) return Response.json({ message });
    if (!existing) {
      try { await db.passwordReset.create({ data: { userId: user.id, requests: 1, windowStart: now, lastRequestedAt: now } }); }
      catch { return Response.json({ message }); }
    }
    const code = newCode();
    try {
      await sendResetCode(user.email, code);
    } catch (error) {
      console.error("Password reset email delivery failed:", error instanceof Error ? error.name : "UnknownError");
      throw new HttpError(503, "Email delivery is unavailable. Please try again later.");
    }
    await db.passwordReset.updateMany({ where: { userId: user.id, lastRequestedAt: now }, data: { codeHash: codeHash(user.id, code), expiresAt: new Date(now.getTime() + 10 * 60_000) } });
    return Response.json({ message });
  } catch (error) { return failure(error); }
}
