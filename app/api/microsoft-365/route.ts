import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, HttpError, requireUser, secretString } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { encrypt } from "@/lib/server/encryption";
import { batchStatus, email, optionalText, ownedMemberIds, requireMs365Manager, serializeBatches } from "@/lib/server/ms365";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const searchParams = new URL(request.url).searchParams;
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const requestedMemberId = searchParams.get("memberId")?.trim() || "";
    let memberIds: string[] | undefined;
    if (user.role === "MEMBER") {
      memberIds = await ownedMemberIds(db, user);
    } else if (requestedMemberId) {
      const member = await db.inventoryRecord.findUnique({
        where: { id: requestedMemberId },
        select: { kind: true },
      });
      if (!member || member.kind !== "members")
        throw new HttpError(400, "Select a valid team member.");
      memberIds = [requestedMemberId];
    }
    const batches = await db.ms365Batch.findMany({
      where: memberIds ? { assignments: { some: { memberId: { in: memberIds } } } } : undefined,
      include: {
        assignments: {
          where: memberIds ? { memberId: { in: memberIds } } : undefined,
          orderBy: [{ status: "asc" }, { slotNumber: "asc" }, { installedAt: "desc" }],
        },
      },
      orderBy: { batchNumber: "asc" },
    });
    let result = await serializeBatches(db, batches);
    if (q)
      result = result.filter((batch) =>
        [batch.name, batch.email, batch.notes, ...batch.assignments.flatMap((a) => [a.member?.name, a.member?.email, a.computer?.name, a.externalDeviceName])]
          .some((value) => String(value || "").toLowerCase().includes(q)),
      );
    return Response.json({ batches: result });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    requireMs365Manager(user);
    const input = await body(request);
    const accountEmail = email(input.accountEmail ?? input.email);
    const password = secretString(input.password, "Microsoft 365 password");
    const status = batchStatus(input.status);
    const notes = optionalText(input.notes, "Notes");
    const batch = await db.$transaction(async (tx) => {
      const latest = await tx.ms365Batch.aggregate({ _max: { batchNumber: true } });
      const created = await tx.ms365Batch.create({
        data: {
          batchNumber: (latest._max.batchNumber || 0) + 1,
          accountEmail,
          encryptedSecret: encrypt(password),
          status,
          notes,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ms365.batch.create",
          targetId: created.id,
          details: { batchNumber: created.batchNumber, accountEmail, status } as Prisma.InputJsonValue,
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const [result] = await serializeBatches(db, [{ ...batch, assignments: [] }]);
    return Response.json({ batch: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return failure(new HttpError(409, "That Microsoft 365 account email or batch number already exists. Try again."));
    return failure(error);
  }
}
