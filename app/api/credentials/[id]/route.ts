import { secretString } from "@/lib/server/auth";
import {
  body,
  checkOrigin,
  failure,
  HttpError,
  requireUser,
  string,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/encryption";
import { metadata } from "@/lib/server/credentials";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const input = await body(request);
    const old = await db.credential.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!old) throw new HttpError(404, "Credential not found.");
    const secret = JSON.parse(decrypt(old.encryptedSecret));
    if (input.password !== undefined)
      secret.password = secretString(input.password, "Password", 4096);
    if (input.notes !== undefined)
      secret.notes = String(input.notes).slice(0, 10000);
    const credential = await db.credential.update({
      where: { id },
      data: {
        title:
          input.title === undefined ? old.title : string(input.title, "Title"),
        username:
          input.username === undefined
            ? old.username
            : string(input.username, "Username"),
        url:
          input.url === undefined ? old.url : String(input.url).slice(0, 2048),
        encryptedSecret: encrypt(JSON.stringify(secret)),
      },
      select: metadata,
    });
    await db.auditLog.create({
      data: { actorId: user.id, action: "credential.update", targetId: id },
    });
    return Response.json({ credential });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const removed = await db.credential.deleteMany({
      where: { id, ownerId: user.id },
    });
    if (!removed.count) throw new HttpError(404, "Credential not found.");
    await db.auditLog.create({
      data: { actorId: user.id, action: "credential.delete", targetId: id },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
