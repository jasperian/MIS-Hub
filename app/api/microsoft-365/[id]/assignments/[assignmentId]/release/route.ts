import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, HttpError, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { dateValue, requireMs365Manager } from "@/lib/server/ms365";

type Context = { params: Promise<{ id: string; assignmentId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    const { id: batchId, assignmentId } = await context.params;
    const input = await body(request);
    const releasedAt = dateValue(input.releasedAt, "release date", new Date());
    const assignment = await db.$transaction(async (tx) => {
      const old = await tx.ms365Assignment.findFirst({ where: { id: assignmentId, batchId } });
      if (!old) throw new HttpError(404, "Microsoft 365 assignment not found.");
      if (old.status !== "ACTIVE") throw new HttpError(409, "This assignment has already been released.");
      if (releasedAt < old.installedAt) throw new HttpError(400, "Release date cannot be before installation date.");
      const updated = await tx.ms365Assignment.update({
        where: { id: assignmentId },
        data: { status: "RELEASED", releasedAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ms365.assignment.release",
          targetId: assignmentId,
          details: { batchId, slotNumber: old.slotNumber, releasedAt: releasedAt.toISOString() } as Prisma.InputJsonValue,
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ assignment });
  } catch (error) {
    return failure(error);
  }
}

