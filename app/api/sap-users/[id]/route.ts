import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, HttpError, requireStaff } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { sapAuditData, sapConflict, sapInput, serializeSapUser, validateSapLinks } from "@/lib/server/sap-users";

type Context = { params: Promise<{ id: string }> };
const include = { dealership: { select: { id: true, name: true } }, member: { select: { id: true, name: true, dealershipId: true } } } as const;

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireStaff();
    const { id } = await context.params;
    const patch = await body(request);
    const user = await db.$transaction(async (tx) => {
      const old = await tx.sapUser.findUnique({ where: { id } });
      if (!old) throw new HttpError(404, "SAP user not found.");
      const input = sapInput({ ...old, validFrom: old.validFrom?.toISOString().slice(0, 10), validTo: old.validTo?.toISOString().slice(0, 10), ...patch });
      await validateSapLinks(tx, input.dealershipId, input.memberId);
      const updated = await tx.sapUser.update({ where: { id }, data: input, include });
      await tx.auditLog.create({ data: { actorId: actor.id, dealershipId: input.dealershipId, action: "sap-user.update", targetId: id, details: { before: { ...old, validFrom: old.validFrom?.toISOString().slice(0, 10), validTo: old.validTo?.toISOString().slice(0, 10) }, after: sapAuditData(input) } as Prisma.InputJsonValue } });
      return updated;
    });
    return Response.json({ user: serializeSapUser(user) });
  } catch (error) { return failure(sapConflict(error)); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const actor = await requireStaff();
    const { id } = await context.params;
    await db.$transaction(async (tx) => {
      const old = await tx.sapUser.findUnique({ where: { id } });
      if (!old) throw new HttpError(404, "SAP user not found.");
      await tx.sapUser.delete({ where: { id } });
      await tx.auditLog.create({ data: { actorId: actor.id, dealershipId: old.dealershipId, action: "sap-user.delete", targetId: id, details: { before: { sapId: old.sapId, memberId: old.memberId } } } });
    });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
