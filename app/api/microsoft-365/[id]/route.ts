import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, HttpError, requireUser } from "@/lib/server/auth";
import { dealershipDb } from "@/lib/server/dealerships";
import { batchStatus, email, optionalText, ownedMemberIds, requireMs365Manager, serializeBatches } from "@/lib/server/ms365";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const db = await dealershipDb(request);
    const user = await requireUser();
    const { id } = await context.params;
    const memberIds = user.role === "MEMBER" ? await ownedMemberIds(db, user) : undefined;
    const batch = await db.ms365Batch.findFirst({
      where: { id, ...(memberIds ? { assignments: { some: { memberId: { in: memberIds } } } } : {}) },
      include: {
        assignments: {
          where: memberIds ? { memberId: { in: memberIds } } : undefined,
          orderBy: [{ status: "asc" }, { slotNumber: "asc" }, { installedAt: "desc" }],
        },
      },
    });
    if (!batch) throw new HttpError(404, "Microsoft 365 batch not found.");
    const [result] = await serializeBatches(db, [batch]);
    return Response.json({ batch: result });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const db = await dealershipDb(request);
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    const { id } = await context.params;
    const input = await body(request);
    const old = await db.ms365Batch.findUnique({ where: { id } });
    if (!old) throw new HttpError(404, "Microsoft 365 batch not found.");
    const accountEmail = input.accountEmail === undefined && input.email === undefined
      ? old.accountEmail
      : email(input.accountEmail ?? input.email);
    const status = input.status === undefined ? old.status : batchStatus(input.status);
    const notes = input.notes === undefined ? old.notes : optionalText(input.notes, "Notes");
    const batch = await db.$transaction(async (tx) => {
      const updated = await tx.ms365Batch.update({ where: { id }, data: { accountEmail, status, notes } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ms365.batch.update",
          targetId: id,
          details: {
            before: { accountEmail: old.accountEmail, status: old.status, notes: old.notes },
            after: { accountEmail, status, notes },
          } as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    const assignments = await db.ms365Assignment.findMany({ where: { batchId: id } });
    const [result] = await serializeBatches(db, [{ ...batch, assignments }]);
    return Response.json({ batch: result });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return failure(new HttpError(409, "That Microsoft 365 account email already exists."));
    return failure(error);
  }
}

