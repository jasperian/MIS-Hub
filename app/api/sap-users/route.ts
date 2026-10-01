import { Prisma } from "@prisma/client";
import { body, checkOrigin, failure, requireStaff, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { sapAuditData, sapConflict, sapInput, serializeSapUser, validateSapLinks } from "@/lib/server/sap-users";

const include = { dealership: { select: { id: true, name: true } }, member: { select: { id: true, name: true, dealershipId: true } } } as const;

export async function GET() {
  try {
    await requireUser();
    const [users, dealerships] = await Promise.all([
      db.sapUser.findMany({ include, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { sapId: "asc" }] }),
      db.dealership.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return Response.json({ users: users.map(serializeSapUser), dealerships });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireStaff();
    const input = sapInput(await body(request));
    const user = await db.$transaction(async (tx) => {
      await validateSapLinks(tx, input.dealershipId, input.memberId);
      const created = await tx.sapUser.create({ data: input, include });
      await tx.auditLog.create({ data: { actorId: actor.id, dealershipId: input.dealershipId, action: "sap-user.create", targetId: created.id, details: { after: sapAuditData(input) } as Prisma.InputJsonValue } });
      return created;
    });
    return Response.json({ user: serializeSapUser(user) }, { status: 201 });
  } catch (error) { return failure(sapConflict(error)); }
}
