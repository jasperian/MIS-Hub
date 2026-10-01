import { Prisma, SapUserStatus, type SapUser } from "@prisma/client";
import { HttpError, string } from "./auth";

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function sapDate(value: unknown, field: string): Date | null {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string" || !datePattern.test(value))
    throw new HttpError(400, `Enter a valid ${field} date.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new HttpError(400, `Enter a valid ${field} date.`);
  return date;
}

export function sapInput(input: Record<string, unknown>) {
  const firstName = string(input.firstName, "First name", 100);
  const lastName = string(input.lastName, "Last name", 100);
  const sapId = string(input.sapId, "SAP Username/ID", 100);
  const department = string(input.department, "Department", 100);
  const dealershipId = string(input.dealershipId, "Dealer");
  if (input.status !== SapUserStatus.ACTIVE && input.status !== SapUserStatus.INACTIVE)
    throw new HttpError(400, "Select a valid status.");
  const status = input.status as SapUserStatus;
  const memberId = input.memberId === null || input.memberId === "" || input.memberId === undefined
    ? null : string(input.memberId, "Team member");
  const validFrom = sapDate(input.validFrom, "Valid From");
  const validTo = sapDate(input.validTo, "Valid To");
  if (validFrom && validTo && validTo < validFrom)
    throw new HttpError(400, "Valid To must be on or after Valid From.");
  return { firstName, lastName, sapId, department, dealershipId, status, memberId, validFrom, validTo };
}

export async function validateSapLinks(tx: Prisma.TransactionClient, dealershipId: string, memberId: string | null) {
  const dealer = await tx.dealership.findUnique({ where: { id: dealershipId } });
  if (!dealer) throw new HttpError(400, "Select a valid dealer.");
  if (memberId) {
    const member = await tx.inventoryRecord.findUnique({ where: { id: memberId } });
    if (!member || member.kind !== "members")
      throw new HttpError(400, "Select a valid team member.");
  }
}

export function serializeSapUser(row: SapUser & { dealership?: { id: string; name: string }; member?: { id: string; name: string; dealershipId: string } | null }) {
  return {
    ...row,
    validFrom: row.validFrom?.toISOString().slice(0, 10) || null,
    validTo: row.validTo?.toISOString().slice(0, 10) || null,
  };
}

export function sapAuditData(input: ReturnType<typeof sapInput>) {
  return { ...input, validFrom: input.validFrom?.toISOString().slice(0, 10) || null, validTo: input.validTo?.toISOString().slice(0, 10) || null };
}

export function sapConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return new HttpError(409, "That SAP ID or team member is already linked to another SAP account.");
  return error;
}
