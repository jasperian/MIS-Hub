import { scopedClient } from "@/lib/server/dealership-scope";
import { dealershipDb } from "@/lib/server/dealerships";
import { Prisma } from "@prisma/client";
import {
  body,
  checkOrigin,
  failure,
  HttpError,
  publicUser,
  requireUser,
  secretString,
  string,
  hashPassword,
  verifyPassword,
  rateLimit,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
export async function GET() {
  try {
    return Response.json({ user: publicUser(await requireUser()) });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await body(request);
    const dealershipId = request.headers.get("x-dealership-id");
    if (dealershipId) await dealershipDb(request);
    if (input.phone !== undefined && !dealershipId) throw new HttpError(400, "Select a dealership to edit your team profile.");
    const name =
      input.name === undefined ? user.name : string(input.name, "Name");
    let passwordHash: string | undefined;
    if (input.newPassword !== undefined) {
      rateLimit("password-change:" + user.id);
      if (
        !verifyPassword(secretString(input.currentPassword), user.passwordHash)
      )
        throw new HttpError(401, "Incorrect current password.");
      const password = secretString(input.newPassword);
      if (password.length < 12)
        throw new HttpError(400, "Use at least 12 characters.");
      passwordHash = hashPassword(password);
    }
    const updated = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { name, passwordHash },
        include: { dealerships: { include: { dealership: true } } },
      });
      const scopedTx = dealershipId ? scopedClient(tx, dealershipId) : null;
      const members = scopedTx ? await scopedTx.inventoryRecord.findMany({
        where: { kind: "members" },
      }) : [];
      for (const member of members) {
        const data = member.data as Record<string, unknown>;
        if (data.userId !== user.id) continue;
        const after = {
          ...data,
          ...(input.phone === undefined
            ? {}
            : { phone: String(input.phone).slice(0, 50) }),
        };
        await scopedTx!.inventoryRecord.update({
          where: { id: member.id },
          data: { name, data: after as Prisma.InputJsonValue },
        });
        await scopedTx!.auditLog.create({
          data: {
            actorId: user.id,
            action: "profile.update",
            targetId: member.id,
            details: {
              before: { name: member.name, data },
              after: { name, data: after },
            } as Prisma.InputJsonValue,
          },
        });
      }
      if (passwordHash)
        await tx.session.deleteMany({ where: { userId: user.id } });
      return updated;
    });
    return Response.json({
      user: publicUser(updated),
      requiresLogin: !!passwordHash,
    });
  } catch (error) {
    return failure(error);
  }
}
