import { db } from "@/lib/server/db";
import { body, checkOrigin, failure, hashPassword, HttpError, secretString, string } from "@/lib/server/auth";
import { codeMatches } from "@/lib/server/password-recovery";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = await body(request);
    const email = string(input.email, "Email").toLowerCase();
    const code = string(input.code, "Code", 6);
    const password = secretString(input.newPassword, "New password", 1024);
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, "Enter a six-digit code.");
    if (password.length < 12) throw new HttpError(400, "Use at least 12 characters.");
    const user = await db.user.findUnique({ where: { email }, select: { id: true, active: true } });
    if (!user?.active) throw new HttpError(400, "Invalid or expired verification code.");
    const reset = await db.passwordReset.findUnique({ where: { userId: user.id } });
    if (!reset?.codeHash || !reset.expiresAt || reset.expiresAt <= new Date() || reset.attempts >= 5)
      throw new HttpError(400, "Invalid or expired verification code.");
    if (!codeMatches(user.id, code, reset.codeHash)) {
      await db.passwordReset.updateMany({ where: { userId: user.id, codeHash: reset.codeHash, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
      throw new HttpError(400, "Invalid or expired verification code.");
    }
    await db.$transaction(async (tx) => {
      const consumed = await tx.passwordReset.updateMany({ where: { userId: user.id, codeHash: reset.codeHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { codeHash: null, expiresAt: null } });
      if (!consumed.count) throw new HttpError(400, "Invalid or expired verification code.");
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password), mustChangePassword: false } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "user.password_recovery", targetId: user.id } });
    });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
