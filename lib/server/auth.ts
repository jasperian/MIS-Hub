import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "./db";
export const COOKIE = "mis_session";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  try {
    const [salt, key] = hash.split(":");
    const stored = Buffer.from(key, "hex");
    const actual = scryptSync(password, salt, 64);
    return stored.length === actual.length && timingSafeEqual(stored, actual);
  } catch {
    return false;
  }
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { dealerships: { include: { dealership: true } } } } },
  });
  return session && session.expiresAt > new Date() && session.user.active
    ? session.user
    : null;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  if (user.mustChangePassword)
    throw new HttpError(403, "Change your temporary password to continue.");
  return user;
}
export async function requirePasswordChangeUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}
export async function requireStaff() {
  const user = await requireUser();
  if (!["ADMIN", "IT"].includes(user.role))
    throw new HttpError(
      403,
      "Inventory changes require IT or administrator access.",
    );
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(process.env.APP_URL || request.url).origin)
    throw new HttpError(403, "Request origin is not permitted.");
}
export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
  dealerships?: { dealership: { id: string; name: string } }[];
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: !!user.mustChangePassword, dealerships: user.dealerships?.map((m) => m.dealership) || [] };
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > 65536)
    throw new HttpError(413, "Request is too large.");
  const text = await request.text();
  if (text.length > 65536) throw new HttpError(413, "Request is too large.");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Expected an object.");
  return value;
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("MIS Prisma request failed:", {
      code: error.code,
      clientVersion: error.clientVersion,
      meta: error.meta,
    });
  } else {
    console.error(
      "MIS request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  return Response.json(
    {
      error:
        "The request could not be completed. Check database configuration and try again.",
    },
    { status: 500 },
  );
}
export function string(value: unknown, field: string, max = 255) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(
      400,
      `${field} is required (maximum ${max} characters).`,
    );
  return value.trim();
}
export function secretString(value: unknown, field = "Password", max = 4096) {
  if (typeof value !== "string" || !value.length || value.length > max)
    throw new HttpError(
      400,
      `${field} is required (maximum ${max} characters).`,
    );
  return value;
}
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now) {
    if (entry.count >= 10)
      throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
    entry.count++;
  } else {
    if (attempts.size > 10000) attempts.clear();
    attempts.set(key, { count: 1, until: now + 900000 });
  }
}
