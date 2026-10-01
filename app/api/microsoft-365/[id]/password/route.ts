import { body, checkOrigin, failure, HttpError, rateLimit, requireUser, secretString, verifyPassword } from "@/lib/server/auth";
import { dealershipDb } from "@/lib/server/dealerships";
import { encrypt } from "@/lib/server/encryption";
import { requireMs365Manager } from "@/lib/server/ms365";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const db = await dealershipDb(request);
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    rateLimit("ms365-password-change:" + user.id);
    const input = await body(request);
    if (!verifyPassword(secretString(input.loginPassword, "Login password", 1024), user.passwordHash))
      throw new HttpError(401, "Incorrect login password.");
    const password = secretString(input.password, "New Microsoft 365 password");
    const { id } = await context.params;
    await db.$transaction(async (tx) => {
      const batch = await tx.ms365Batch.findUnique({ where: { id }, select: { id: true } });
      if (!batch) throw new HttpError(404, "Microsoft 365 batch not found.");
      await tx.ms365Batch.update({ where: { id }, data: { encryptedSecret: encrypt(password) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ms365.password.update", targetId: id } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
