import { secretString } from "@/lib/server/auth";
import {
  body,
  checkOrigin,
  failure,
  HttpError,
  rateLimit,
  requireUser,
  string,
  verifyPassword,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { decrypt } from "@/lib/server/encryption";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    rateLimit("reveal:" + user.id);
    const input = await body(request);
    if (
      !verifyPassword(
        secretString(input.password, "Login password", 1024),
        user.passwordHash,
      )
    )
      throw new HttpError(401, "Incorrect login password.");
    const { id } = await context.params;
    const credential = await db.credential.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!credential) throw new HttpError(404, "Credential not found.");
    await db.auditLog.create({
      data: { actorId: user.id, action: "credential.reveal", targetId: id },
    });
    return Response.json(JSON.parse(decrypt(credential.encryptedSecret)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
