import { failure, requireUser, HttpError } from "@/lib/server/auth";
import { dealershipDb } from "@/lib/server/dealerships";
export async function GET(request: Request) {
  try {
    const db = await dealershipDb(request);
    const user = await requireUser();
    if (user.role === "MEMBER")
      throw new HttpError(403, "Staff access required.");
    const targetId = new URL(request.url).searchParams.get("targetId");
    const events = await db.auditLog.findMany({
      where: {
        ...(targetId ? { targetId } : {}),
        action: { not: { startsWith: "credential." } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ events });
  } catch (error) {
    return failure(error);
  }
}
