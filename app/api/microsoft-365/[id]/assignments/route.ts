import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, requireUser, string } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSlotAvailable, dateValue, optionalText, requireMs365Manager, serializeBatches, validateAssignmentLinks } from "@/lib/server/ms365";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    const { id: batchId } = await context.params;
    const input = await body(request);
    const memberId = string(input.memberId, "Team member");
    const computerId = input.computerId ? string(input.computerId, "Computer") : null;
    const externalDeviceName = optionalText(input.externalDeviceName, "External device name", 255);
    const installedAt = dateValue(input.installedAt, "installation date", new Date());
    const notes = optionalText(input.notes, "Notes");
    const assignment = await db.$transaction(async (tx) => {
      await validateAssignmentLinks(tx, memberId, computerId, externalDeviceName);
      const slotNumber = await assertSlotAvailable(tx, batchId, computerId);
      const created = await tx.ms365Assignment.create({
        data: { batchId, slotNumber, memberId, computerId, externalDeviceName, installedAt, notes },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ms365.assignment.create",
          targetId: created.id,
          details: { batchId, slotNumber, memberId, computerId, externalDeviceName } as Prisma.InputJsonValue,
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const batch = await db.ms365Batch.findUniqueOrThrow({ where: { id: batchId } });
    const [result] = await serializeBatches(db, [{ ...batch, assignments: [assignment] }]);
    return Response.json({ assignment: result.assignments[0] }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

