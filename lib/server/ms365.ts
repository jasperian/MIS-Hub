import { Ms365AssignmentStatus, Prisma, Role, User } from "@prisma/client";
import { HttpError, string } from "@/lib/server/auth";

export const MS365_CAPACITY = 5;

type Db = Prisma.TransactionClient;

export function canManageMs365(role: Role) {
  return role === "ADMIN" || role === "IT";
}

export function requireMs365Manager(user: Pick<User, "role">) {
  if (!canManageMs365(user.role))
    throw new HttpError(403, "Microsoft 365 changes require IT or administrator access.");
}

export function email(value: unknown) {
  const result = string(value, "Microsoft 365 account email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new HttpError(400, "Enter a valid Microsoft 365 account email.");
  return result;
}

export function optionalText(value: unknown, field: string, max = 10000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max)
    throw new HttpError(400, `${field} must not exceed ${max} characters.`);
  return value.trim() || null;
}

export function dateValue(value: unknown, field: string, fallback?: Date) {
  if (value === undefined || value === null || value === "") {
    if (fallback) return fallback;
    throw new HttpError(400, `${field} is required.`);
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `Invalid ${field}.`);
  return date;
}

export function batchStatus(value: unknown) {
  const status = String(value || "ACTIVE").toUpperCase();
  if (status !== "ACTIVE" && status !== "INACTIVE")
    throw new HttpError(400, "Status must be active or inactive.");
  return status as "ACTIVE" | "INACTIVE";
}

export async function ownedMemberIds(tx: Db, user: Pick<User, "id" | "email">) {
  const records = await tx.inventoryRecord.findMany({ where: { kind: "members" } });
  return records
    .filter((record) => {
      const data = record.data as Record<string, unknown>;
      return (
        data.userId === user.id ||
        String(data.email || "").toLowerCase() === user.email.toLowerCase()
      );
    })
    .map((record) => record.id);
}

export async function validateAssignmentLinks(
  tx: Db,
  memberId: string,
  computerId: string | null,
  externalDeviceName: string | null,
) {
  const member = await tx.inventoryRecord.findUnique({ where: { id: memberId } });
  if (!member || member.kind !== "members")
    throw new HttpError(400, "Select a valid team member.");
  let computer = null;
  if (computerId) {
    computer = await tx.inventoryRecord.findUnique({ where: { id: computerId } });
    if (!computer || computer.kind !== "computers")
      throw new HttpError(400, "Select a valid computer or laptop.");
  }
  if (computerId && externalDeviceName)
    throw new HttpError(
      400,
      "Choose either a registered computer or an external device, not both.",
    );
  if (!computerId && !externalDeviceName)
    throw new HttpError(400, "Select a registered computer or enter an external device name.");
  return { member, computer };
}

function inventorySummary(record: { id: string; name: string; data: unknown } | null) {
  if (!record) return null;
  const data = record.data as Record<string, unknown>;
  return {
    id: record.id,
    name: record.name,
    email: typeof data.email === "string" ? data.email : null,
  };
}

export async function serializeBatches(
  tx: Db,
  batches: Array<{
    id: string;
    batchNumber: number;
    accountEmail: string;
    status: "ACTIVE" | "INACTIVE";
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignments: Array<{
      id: string;
      slotNumber: number;
      memberId: string;
      computerId: string | null;
      externalDeviceName: string | null;
      installedAt: Date;
      releasedAt: Date | null;
      status: "ACTIVE" | "RELEASED";
      notes: string | null;
    }>;
  }>,
) {
  const recordIds = [...new Set(batches.flatMap((batch) => batch.assignments.flatMap((a) => [a.memberId, a.computerId]).filter(Boolean) as string[]))];
  const records = recordIds.length
    ? await tx.inventoryRecord.findMany({ where: { id: { in: recordIds } } })
    : [];
  const byId = new Map(records.map((record) => [record.id, record]));
  return batches.map((batch) => {
    const assignments = batch.assignments.map((assignment) => ({
      ...assignment,
      member: inventorySummary(byId.get(assignment.memberId) || null),
      computer: inventorySummary(
        assignment.computerId ? byId.get(assignment.computerId) || null : null,
      ),
    }));
    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      name: `Batch ${batch.batchNumber}`,
      email: batch.accountEmail,
      accountEmail: batch.accountEmail,
      status: batch.status,
      notes: batch.notes,
      capacity: MS365_CAPACITY,
      activeCount: assignments.filter((a) => a.status === "ACTIVE").length,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      assignments,
    };
  });
}

export async function assertSlotAvailable(tx: Db, batchId: string, computerId: string | null) {
  const batch = await tx.ms365Batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new HttpError(404, "Microsoft 365 batch not found.");
  if (batch.status !== "ACTIVE")
    throw new HttpError(409, "Assignments cannot be added to an inactive batch.");
  const active = await tx.ms365Assignment.findMany({
    where: { batchId, status: Ms365AssignmentStatus.ACTIVE },
    select: { slotNumber: true },
  });
  if (active.length >= MS365_CAPACITY)
    throw new HttpError(409, "This Microsoft 365 batch already has five active assignments.");
  if (
    computerId &&
    (await tx.ms365Assignment.findFirst({
      where: { computerId, status: Ms365AssignmentStatus.ACTIVE },
      select: { id: true },
    }))
  )
    throw new HttpError(409, "This computer already has an active Microsoft 365 assignment.");
  const used = new Set(active.map((assignment) => assignment.slotNumber));
  for (let slot = 1; slot <= MS365_CAPACITY; slot++) if (!used.has(slot)) return slot;
  throw new HttpError(409, "No Microsoft 365 slots are available.");
}
