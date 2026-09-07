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
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    if (actor.role !== "ADMIN")
      throw new HttpError(403, "Administrator access required.");
    const { id } = await context.params;
    const input = await body(request);
    if (id === actor.id)
      throw new HttpError(
        400,
        "Use another administrator to change your account permissions.",
      );
    const data: { active?: boolean; role?: Role; passwordHash?: string } = {};
    if (input.active !== undefined) {
      if (typeof input.active !== "boolean")
        throw new HttpError(400, "Active must be true or false.");
      data.active = input.active;
    }
    if (input.role !== undefined) {
      if (!Object.values(Role).includes(input.role as Role))
        throw new HttpError(400, "Invalid role.");
      data.role = input.role as Role;
    }
    if (input.password !== undefined) {
      const password = secretString(input.password, "Password", 1024);
      if (password.length < 12)
        throw new HttpError(400, "Use at least 12 characters.");
      data.passwordHash = hashPassword(password);
    }
    const user = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, active: true },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "user.update", targetId: id },
      });
      return user;
    });
    return Response.json({ user });
  } catch (error) {
    return failure(error);
  }
}
