import { body, checkOrigin, failure, HttpError, rateLimit, requireUser, secretString, verifyPassword } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { decrypt } from "@/lib/server/encryption";
import { requireMs365Manager } from "@/lib/server/ms365";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    rateLimit("ms365-reveal:" + user.id);
    const input = await body(request);
    if (!verifyPassword(secretString(input.password, "Login password", 1024), user.passwordHash))
      throw new HttpError(401, "Incorrect login password.");
    const { id } = await context.params;
    const batch = await db.ms365Batch.findUnique({ where: { id } });
    if (!batch) throw new HttpError(404, "Microsoft 365 batch not found.");
    await db.auditLog.create({ data: { actorId: user.id, action: "ms365.password.reveal", targetId: id } });
    return Response.json({ password: decrypt(batch.encryptedSecret) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

