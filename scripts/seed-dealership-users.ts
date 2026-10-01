import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

loadEnvConfig(process.cwd());
const db = new PrismaClient();

const accounts = [
  { name: "TNE", email: "tne@mis.local", dealershipId: "dealer-1" },
  { name: "TNESC", email: "tnesc@mis.local", dealershipId: "dealer-2" },
] as const;

async function main() {
  for (const account of accounts) {
    const dealership = await db.dealership.findUnique({ where: { id: account.dealershipId } });
    if (!dealership) throw new Error(`Missing dealership ${account.dealershipId}.`);
    if (await db.user.findUnique({ where: { email: account.email } })) {
      console.log(`${account.email}: already exists; unchanged`);
      continue;
    }
    const password = randomBytes(24).toString("base64url");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    await db.user.create({
      data: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: "ADMIN",
        dealerships: { create: { dealershipId: account.dealershipId } },
      },
    });
    console.log(`${account.email}: created; initial password: ${password}`);
  }

  const admin = await db.user.findUnique({
    where: { email: "admin@mis.local" },
    include: { dealerships: true },
  });
  if (!admin) throw new Error("admin@mis.local is missing; run db:bootstrap first.");
  if (admin.role !== "ADMIN") throw new Error("admin@mis.local must have the ADMIN role.");
  for (const dealershipId of accounts.map((account) => account.dealershipId)) {
    if (!admin.dealerships.some((membership) => membership.dealershipId === dealershipId)) {
      await db.userDealership.create({ data: { userId: admin.id, dealershipId } });
    }
  }
  console.log("admin@mis.local: administrator with access to both dealerships; password unchanged");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
