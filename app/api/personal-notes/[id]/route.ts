import { body, checkOrigin, failure, HttpError, requireUser, string } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { optionalText } from "@/lib/server/personal-organizer";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const input = await body(request);
    const data: { title?: string; content?: string } = {};
    if (input.title !== undefined) data.title = string(input.title, "Title");
    if (input.content !== undefined) data.content = optionalText(input.content, "Content");
    if (!Object.keys(data).length) throw new HttpError(400, "No changes provided.");
    const result = await db.personalNote.updateMany({ where: { id, ownerId: user.id }, data });
    if (!result.count) throw new HttpError(404, "Note not found.");
    const note = await db.personalNote.findUniqueOrThrow({ where: { id } });
    return Response.json({ note });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const result = await db.personalNote.deleteMany({ where: { id, ownerId: user.id } });
    if (!result.count) throw new HttpError(404, "Note not found.");
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
