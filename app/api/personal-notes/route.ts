import { body, checkOrigin, failure, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { noteInput } from "@/lib/server/personal-organizer";

export async function GET() {
  try {
    const user = await requireUser();
    const notes = await db.personalNote.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" } });
    return Response.json({ notes });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const note = await db.personalNote.create({ data: { ownerId: user.id, ...noteInput(await body(request)) } });
    return Response.json({ note }, { status: 201 });
  } catch (error) { return failure(error); }
}
