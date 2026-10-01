import { body, checkOrigin, failure, HttpError, rateLimit, requireStaff, secretString, verifyPassword } from "@/lib/server/auth";
import { dealershipDb } from "@/lib/server/dealerships";
import { db } from "@/lib/server/db";
import { decrypt } from "@/lib/server/encryption";

type Context = { params: Promise<{ id: string }> };

async function emailRecord(request: Request, context: Context) {
  const scoped = await dealershipDb(request);
  const user = await requireStaff();
  const { id } = await context.params;
  const record = await scoped.inventoryRecord.findUnique({ where: { id } });
  if (!record || record.kind !== "emails") throw new HttpError(404, "Email account not found.");
  return { scoped, user, id };
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await emailRecord(request, context);
    const found = await db.emailAccountPassword.findUnique({ where: { recordId: id }, select: { recordId: true } });
    return Response.json({ hasPassword: !!found }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { scoped, user, id } = await emailRecord(request, context);
    rateLimit("email-password-reveal:" + user.id);
    const input = await body(request);
    if (!verifyPassword(secretString(input.loginPassword, "Login password", 1024), user.passwordHash))
      throw new HttpError(401, "Incorrect login password.");
    const secret = await db.emailAccountPassword.findUnique({ where: { recordId: id } });
    if (!secret) throw new HttpError(404, "No password is saved for this email account.");
    await scoped.auditLog.create({ data: { actorId: user.id, action: "email.password.reveal", targetId: id } });
    return Response.json({ password: decrypt(secret.encryptedSecret) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { scoped, user, id } = await emailRecord(request, context);
    await db.emailAccountPassword.deleteMany({ where: { recordId: id } });
    await scoped.auditLog.create({ data: { actorId: user.id, action: "email.password.delete", targetId: id } });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
