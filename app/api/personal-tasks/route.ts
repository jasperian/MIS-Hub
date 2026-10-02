import { body, checkOrigin, failure, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { taskInput } from "@/lib/server/personal-organizer";

export async function GET() {
  try {
    const user = await requireUser();
    const tasks = await db.personalTask.findMany({
      where: { ownerId: user.id },
      orderBy: [{ completed: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    });
    return Response.json({ tasks });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const task = await db.personalTask.create({ data: { ownerId: user.id, ...taskInput(await body(request)) } });
    return Response.json({ task }, { status: 201 });
  } catch (error) { return failure(error); }
}
