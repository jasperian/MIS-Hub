import {
  body,
  checkOrigin,
  failure,
  HttpError,
  requireUser,
  string,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";

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
    const dealership = await db.$transaction(async (tx) => {
      const dealership = await tx.dealership.update({
        where: { id },
        data: { name: string(input.name, "Dealership name") },
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "dealership.rename", targetId: id },
      });
      return dealership;
    });
    return Response.json({ dealership });
  } catch (error) {
    return failure(error);
  }
}
