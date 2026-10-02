import { body, checkOrigin, failure, HttpError, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { taskChanges } from "@/lib/server/personal-organizer";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const data = taskChanges(await body(request));
    const result = await db.personalTask.updateMany({ where: { id, ownerId: user.id }, data });
    if (!result.count) throw new HttpError(404, "Task not found.");
    const task = await db.personalTask.findUniqueOrThrow({ where: { id } });
    return Response.json({ task });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const result = await db.personalTask.deleteMany({ where: { id, ownerId: user.id } });
    if (!result.count) throw new HttpError(404, "Task not found.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
