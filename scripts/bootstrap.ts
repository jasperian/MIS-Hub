import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
loadEnvConfig(process.cwd());
const db = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "MIS Administrator";
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters).",
    );
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Account already exists; no password or role changed.");
    return;
  }
  const salt = randomBytes(16).toString("hex");
  const passwordHash =
    salt + ":" + scryptSync(password, salt, 64).toString("hex");
  await db.user.create({ data: { name, email, passwordHash, role: "ADMIN", dealerships: { create: (await db.dealership.findMany()).map(d => ({ dealershipId: d.id })) } } });
  console.log("Administrator account created.");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
