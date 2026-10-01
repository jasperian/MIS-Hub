import { validateDealershipIds } from "@/lib/server/dealerships";
import { secretString } from "@/lib/server/auth";
import {
  body,
  checkOrigin,
  failure,
  hashPassword,
  HttpError,
  requireUser,
  string,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Role } from "@prisma/client";
export async function GET() {
  try {
    const actor = await requireUser();
    if (actor.role !== "ADMIN")
      throw new HttpError(403, "Administrator access required.");
    return Response.json({
      dealerships: await db.dealership.findMany({ orderBy: { name: "asc" } }),
      users: await db.user.findMany({
        select: { id: true, name: true, email: true, role: true, active: true, dealerships: { include: { dealership: true } } },
        orderBy: { name: "asc" },
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    if (actor.role !== "ADMIN")
      throw new HttpError(403, "Administrator access required.");
    const input = await body(request);
    const dealershipIds = await validateDealershipIds(input.dealershipIds);
    const name = string(input.name, "Name");
    const email = string(input.email, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new HttpError(400, "Invalid email.");
    const password = secretString(input.password, "Password", 1024);
    if (password.length < 12)
      throw new HttpError(
        400,
        "Use at least 12 characters for the login password.",
      );
    const role = String(input.role || "MEMBER") as Role;
    if (!Object.values(Role).includes(role))
      throw new HttpError(400, "Invalid role.");
    const user = await db.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { email } }))
        throw new HttpError(409, "An account already uses this email.");
      const user = await tx.user.create({
        data: { name, email, role, passwordHash: hashPassword(password), dealerships: { create: dealershipIds.map(dealershipId => ({ dealershipId })) } },
        select: { id: true, name: true, email: true, role: true, active: true },
      });
      if (input.memberId) {
        const record = await tx.inventoryRecord.findUnique({
          where: { id: String(input.memberId) },
        });
        if (!record || record.kind !== "members" || !dealershipIds.includes(record.dealershipId) || record.dealershipId !== request.headers.get("x-dealership-id") || !actor.dealerships.some(m => m.dealershipId === record.dealershipId))
          throw new HttpError(400, "Member record not found.");
        const data = record.data as Record<string, string>;
        if (data.userId)
          throw new HttpError(409, "Member already has a linked login.");
        await tx.inventoryRecord.update({
          where: { id: record.id },
          data: { data: { ...data, userId: user.id } },
        });
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "user.create", targetId: user.id },
      });
      return user;
    });
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
