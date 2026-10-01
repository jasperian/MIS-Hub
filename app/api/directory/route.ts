import { failure, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** Shared directory only. Inventory, history and secrets retain dealership access checks. */
export async function GET() {
  try {
    await requireUser();
    const records = await db.inventoryRecord.findMany({
      where: { kind: { in: ["members", "emails"] } },
      include: { dealership: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ records });
  } catch (error) {
    return failure(error);
  }
}
