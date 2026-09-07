import { Prisma } from "@prisma/client";
import {
  body,
  checkOrigin,
  failure,
  HttpError,
  requireStaff,
  requireUser,
  string,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import {
  checkIp,
  checkLinks,
  checkEmail,
  ownRecord,
  validate,
} from "@/lib/server/records";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const kind = new URL(request.url).searchParams.get("kind");
    let records = await db.inventoryRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
    if (user.role === "MEMBER") {
      const ids = records
        .filter((r) => r.kind === "members" && ownRecord(r, user, []))
        .map((r) => r.id);
      const owned = records.filter((r) => ownRecord(r, user, ids));
      const printerIds = owned
        .filter((r) => r.kind === "computers")
        .flatMap((r) => {
          const d = r.data as Record<string, unknown>;
          return [
            d.printerId,
            ...(Array.isArray(d.printerIds) ? d.printerIds : []),
          ];
        })
        .filter(Boolean);
      records = records.filter(
        (r) =>
          owned.some((o) => o.id === r.id) ||
          (r.kind === "printers" && printerIds.includes(r.id)),
      );
    }
    if (kind) records = records.filter((r) => r.kind === kind);
    return Response.json({ records });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireStaff();
    const input = await body(request);
    const kind = string(input.kind, "Category");
    const name = string(input.name, "Name");
    const data = (input.data || {}) as Record<string, unknown>;
    if (typeof data !== "object" || Array.isArray(data))
      throw new HttpError(400, "Invalid record data.");
    validate(kind, name, data);
    const record = await db.$transaction(
      async (tx) => {
        await checkIp(tx, kind, name, data);
        await checkLinks(tx, data);
        await checkEmail(tx, kind, data);
        if (kind === "replacements") {
          const tonerId = string(data.tonerId, "Toner");
          const printerId = string(data.printerId, "Printer");
          const quantity = Number(data.quantity ?? 1);
          if (!Number.isInteger(quantity) || quantity < 1)
            throw new HttpError(
              400,
              "Replacement quantity must be a positive integer.",
            );
          const toner = await tx.inventoryRecord.findUnique({
            where: { id: tonerId },
          });
          const printer = await tx.inventoryRecord.findUnique({
            where: { id: printerId },
          });
          if (
            !toner ||
            toner.kind !== "toners" ||
            !printer ||
            printer.kind !== "printers"
          )
            throw new HttpError(400, "Select an existing toner and printer.");
          const pd = printer.data as Record<string, unknown>;
          if (pd.tonerId && pd.tonerId !== tonerId)
            throw new HttpError(
              400,
              "This toner is not compatible with the selected printer.",
            );
          const td = toner.data as Record<string, unknown>;
          if (Number(td.quantity || 0) < quantity)
            throw new HttpError(409, "Insufficient toner stock.");
          await tx.inventoryRecord.update({
            where: { id: tonerId },
            data: {
              data: {
                ...td,
                quantity: Number(td.quantity) - quantity,
              } as Prisma.InputJsonValue,
            },
          });
          data.quantity = quantity;
          data.createdBy = user.id;
          data.recordedAt = new Date().toISOString();
        }
        const record = await tx.inventoryRecord.create({
          data: { kind, name, data: data as Prisma.InputJsonValue },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "inventory.create",
            targetId: record.id,
            details: { after: { name, data } } as Prisma.InputJsonValue,
          },
        });
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
