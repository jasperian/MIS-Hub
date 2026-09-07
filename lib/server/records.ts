import { Prisma, type User } from "@prisma/client";
import { HttpError } from "./auth";
import { validateRecord } from "./validation";
export async function checkEmail(
  tx: Prisma.TransactionClient,
  kind: string,
  data: Record<string, unknown>,
  id?: string,
) {
  if (kind !== "emails") return;
  if (data.parentMailboxId === id && id)
    throw new HttpError(400, "An alias cannot be its own parent.");
  if (data.parentMailboxId) {
    const parent = await tx.inventoryRecord.findUnique({
      where: { id: String(data.parentMailboxId) },
    });
    if (parent && (parent.data as Record<string, unknown>).type === "Alias")
      throw new HttpError(400, "Select a mailbox, not another alias.");
  }
  const records = await tx.inventoryRecord.findMany({
    where: { kind: "emails", id: id ? { not: id } : undefined },
  });
  for (const r of records) {
    const other = r.data as Record<string, unknown>;
    const address = String(data.address || data.email || "").toLowerCase();
    if (
      address &&
      address === String(other.address || other.email || "").toLowerCase()
    )
      throw new HttpError(409, "Email address already exists.");
    if (
      data.memberId &&
      data.memberId === other.memberId &&
      (data.primary === true || data.primary === "Yes") &&
      (other.primary === true || other.primary === "Yes")
    )
      throw new HttpError(409, "This member already has a primary email.");
  }
}
export async function checkLinks(
  tx: Prisma.TransactionClient,
  data: Record<string, unknown>,
) {
  const links: Record<string, string[]> = {
    memberId: ["members"],
    assignedTo: ["members"],
    printerId: ["printers"],
    tonerId: ["toners"],
    computerId: ["computers"],
    parentMailboxId: ["emails"],
    deviceId: ["computers", "printers", "access-points"],
  };
  for (const [field, kinds] of Object.entries(links)) {
    if (!data[field]) continue;
    const record = await tx.inventoryRecord.findUnique({
      where: { id: String(data[field]) },
    });
    if (!record || !kinds.includes(record.kind))
      throw new HttpError(400, `Select a valid ${field}.`);
  }
  for (const field of ["memberIds", "printerIds"]) {
    if (data[field] === undefined) continue;
    if (!Array.isArray(data[field]))
      throw new HttpError(400, `Invalid ${field}.`);
    for (const id of data[field] as unknown[]) {
      const record = await tx.inventoryRecord.findUnique({
        where: { id: String(id) },
      });
      if (
        !record ||
        record.kind !== (field === "memberIds" ? "members" : "printers")
      )
        throw new HttpError(400, `Select valid ${field}.`);
    }
  }
  if (data.userId) {
    const user = await tx.user.findUnique({
      where: { id: String(data.userId) },
    });
    if (!user) throw new HttpError(400, "Linked login does not exist.");
  }
}
export async function preventLinkedDelete(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const records = await tx.inventoryRecord.findMany({
    where: { id: { not: id } },
  });
  const fields = [
    "memberId",
    "assignedTo",
    "printerId",
    "tonerId",
    "computerId",
    "parentMailboxId",
    "deviceId",
    "memberIds",
    "printerIds",
  ];
  for (const record of records) {
    const data = record.data as Record<string, unknown>;
    if (
      fields.some(
        (field) =>
          data[field] === id ||
          (Array.isArray(data[field]) &&
            (data[field] as unknown[]).includes(id)),
      )
    )
      throw new HttpError(
        409,
        "This record is linked to other inventory or maintenance history. Remove assignments or mark it retired instead.",
      );
  }
}
export function validate(
  kind: string,
  name: string,
  data: Record<string, unknown>,
) {
  try {
    validateRecord(kind, name, data);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
}
export function ownRecord(
  record: { id: string; kind: string; data: unknown },
  user: User,
  memberIds: string[],
) {
  const data = record.data as Record<string, unknown>;
  return (
    data.userId === user.id ||
    (record.kind === "members" && data.email === user.email) ||
    data.assignedTo === user.id ||
    memberIds.includes(String(data.memberId || data.assignedTo || "")) ||
    (Array.isArray(data.memberIds) &&
      data.memberIds.some((id) => memberIds.includes(String(id))))
  );
}
export async function checkIp(
  tx: Prisma.TransactionClient,
  kind: string,
  name: string,
  data: Record<string, unknown>,
  exclude?: string,
) {
  const ip = data.ip || data.ipAddress || (kind === "ip" ? name : "");
  if (!ip) return;
  const others = await tx.inventoryRecord.findMany({
    where: { id: exclude ? { not: exclude } : undefined },
  });
  for (const other of others) {
    const d = other.data as Record<string, unknown>;
    const used = d.ip || d.ipAddress || (other.kind === "ip" ? other.name : "");
    if (used === ip)
      throw new HttpError(
        409,
        "This IP address is already recorded. Edit its existing assignment first.",
      );
  }
}
