import { Prisma } from "@prisma/client";
import {
  body,
  checkOrigin,
  failure,
  HttpError,
  requireStaff,
  secretString,
  string,
} from "@/lib/server/auth";
import { dealershipDb } from "@/lib/server/dealerships";
import { encrypt } from "@/lib/server/encryption";
import {
  checkIp,
  checkLinks,
  checkEmail,
  preventLinkedDelete,
  validate,
} from "@/lib/server/records";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const db = await dealershipDb(request);
    checkOrigin(request);
    const user = await requireStaff();
    const { id } = await context.params;
    const input = await body(request);
    const record = await db.$transaction(
      async (tx) => {
        const old = await tx.inventoryRecord.findUnique({ where: { id } });
        if (!old) throw new HttpError(404, "Record not found.");
        if (old.kind === "replacements")
          throw new HttpError(400, "Replacement history is immutable.");
        if (input.password !== undefined && old.kind !== "emails") throw new HttpError(400, "Passwords can only be saved for email accounts.");
        const emailPassword = input.password === undefined ? null : secretString(input.password, "Email password");
        const name =
          input.name === undefined ? old.name : string(input.name, "Name");
        const patch = input.data;
        if (
          patch !== undefined &&
          (!patch || typeof patch !== "object" || Array.isArray(patch))
        )
          throw new HttpError(400, "Invalid record data.");
        const data = {
          ...(old.data as Record<string, unknown>),
          ...((patch as Record<string, unknown>) || {}),
        };
        validate(old.kind, name, data);
        await checkIp(tx, old.kind, name, data, id);
        await checkLinks(tx, data, request.headers.get("x-dealership-id")!);
        await checkEmail(tx, old.kind, data, id);
        const updated = await tx.inventoryRecord.update({
          where: { id },
          data: { name, data: data as Prisma.InputJsonValue },
        });
        if (emailPassword) await tx.emailAccountPassword.upsert({ where: { recordId: id }, create: { recordId: id, encryptedSecret: encrypt(emailPassword) }, update: { encryptedSecret: encrypt(emailPassword) } });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "inventory.update",
            targetId: id,
            details: {
              before: { name: old.name, data: old.data },
              after: { name, data },
            } as Prisma.InputJsonValue,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json({ record });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const db = await dealershipDb(request);
    checkOrigin(request);
    const user = await requireStaff();
    const { id } = await context.params;
    const record = await db.inventoryRecord.findUnique({ where: { id } });
    if (!record) throw new HttpError(404, "Record not found.");
    if (record.kind === "replacements")
      throw new HttpError(400, "Replacement history cannot be deleted.");
    await db.$transaction(
      async (tx) => {
        await preventLinkedDelete(tx, id);
        await tx.inventoryRecord.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "inventory.delete",
            targetId: id,
            details: {
              before: { name: record.name, data: record.data },
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
