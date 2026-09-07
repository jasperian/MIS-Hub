import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { misDb?: PrismaClient };
export const db = globalDb.misDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.misDb = db;
