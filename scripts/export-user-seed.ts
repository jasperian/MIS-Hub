import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const emails = ["tne@mis.local", "tnesc@mis.local", "admin@mis.local"];
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

async function main() {
  const users = await db.user.findMany({ where: { email: { in: emails } } });
  if (users.length !== emails.length) throw new Error("Create all three accounts before exporting SQL.");
  const lines = [
    "-- MIS Hub account seed. Contains password hashes; keep this file private.",
    "-- Run after importing prisma/initial-schema.sql. Existing accounts are preserved.",
    "START TRANSACTION;",
    "INSERT IGNORE INTO `Dealership` (`id`, `name`) VALUES ('dealer-1', 'TNE'), ('dealer-2', 'TNESC');",
  ];
  for (const email of emails) {
    const user = users.find((row) => row.email === email)!;
    lines.push(
      `INSERT IGNORE INTO \`User\` (\`id\`, \`name\`, \`email\`, \`passwordHash\`, \`role\`, \`active\`) VALUES (${quote(user.id)}, ${quote(user.name)}, ${quote(user.email)}, ${quote(user.passwordHash)}, ${quote(user.role)}, ${user.active ? 1 : 0});`,
    );
  }
  for (const [email, dealershipId] of [
    ["tne@mis.local", "dealer-1"],
    ["tnesc@mis.local", "dealer-2"],
    ["admin@mis.local", "dealer-1"],
    ["admin@mis.local", "dealer-2"],
  ]) {
    lines.push(
      `INSERT IGNORE INTO \`UserDealership\` (\`userId\`, \`dealershipId\`) SELECT \`id\`, ${quote(dealershipId)} FROM \`User\` WHERE \`email\` = ${quote(email)};`,
    );
  }
  lines.push("COMMIT;", "");
  const directory = join(process.cwd(), ".backups");
  await mkdir(directory, { recursive: true });
  const path = join(directory, "seed-users.sql");
  await writeFile(path, lines.join("\n"), { mode: 0o600 });
  console.log(`Created ${path}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
