import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
loadEnvConfig(process.cwd());
const db = new PrismaClient();

async function main() {
  // Snapshot before any DDL. Includes secrets already encrypted by the application.
  const tables =
    await db.$queryRawUnsafe<Record<string, string>[]>("SHOW TABLES");
  const backup: Record<string, unknown> = {};
  for (const row of tables) {
    const table = Object.values(row)[0];
    if (!/^[A-Za-z0-9_]+$/.test(table))
      throw new Error("Unexpected table name.");
    backup[table] = {
      ddl: await db.$queryRawUnsafe(`SHOW CREATE TABLE \`${table}\``),
      rows: await db.$queryRawUnsafe(`SELECT * FROM \`${table}\``),
    };
  }
  const directory = resolve(".backups");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, `dealership-${Date.now()}.json`);
  writeFileSync(
    path,
    JSON.stringify(
      backup,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
    { flag: "wx" },
  );
  console.log(`Database snapshot saved: ${path}`);

  await db.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS `Dealership` (`id` VARCHAR(191) NOT NULL PRIMARY KEY, `name` VARCHAR(191) NOT NULL) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await db.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS `UserDealership` (`userId` VARCHAR(191) NOT NULL, `dealershipId` VARCHAR(191) NOT NULL, PRIMARY KEY (`userId`,`dealershipId`), INDEX (`dealershipId`), FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY (`dealershipId`) REFERENCES `Dealership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await db.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS `_MisMigration` (`id` VARCHAR(191) PRIMARY KEY) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await db.$executeRawUnsafe(
    "INSERT IGNORE INTO `Dealership` (`id`,`name`) VALUES ('dealer-1','TNE'),('dealer-2','TNESC')",
  );
  const completed = await db.$queryRawUnsafe<unknown[]>(
    "SELECT id FROM `_MisMigration` WHERE id='dealership-v1'",
  );
  for (const table of [
    "InventoryRecord",
    "Credential",
    "Ms365Batch",
    "AuditLog",
  ]) {
    const columns = await db.$queryRawUnsafe<{ Field: string }[]>(
      `SHOW COLUMNS FROM \`${table}\``,
    );
    if (!columns.some((c) => c.Field === "dealershipId")) {
      await db.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` ADD COLUMN \`dealershipId\` VARCHAR(191) ${table === "AuditLog" ? "NULL" : "NOT NULL DEFAULT 'dealer-1'"}`,
      );
    }
    if (table === "AuditLog" && !completed.length) {
      await db.$executeRawUnsafe(
        "UPDATE `AuditLog` SET dealershipId='dealer-1' WHERE dealershipId IS NULL AND (action LIKE 'inventory.%' OR action LIKE 'credential.%' OR action LIKE 'ms365.%' OR action='profile.update')",
      );
    }
    const indexes = await db.$queryRawUnsafe<{ Key_name: string }[]>(
      `SHOW INDEX FROM \`${table}\``,
    );
    const indexName =
      table === "AuditLog"
        ? "AuditLog_dealershipId_createdAt_idx"
        : `${table}_dealershipId_idx`;
    if (!indexes.some((i) => i.Key_name === indexName))
      await db.$executeRawUnsafe(
        `CREATE INDEX \`${indexName}\` ON \`${table}\` (dealershipId${table === "AuditLog" ? ",createdAt" : ""})`,
      );
    const constraints = await db.$queryRawUnsafe<unknown[]>(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?",
      table,
      `${table}_dealershipId_fkey`,
    );
    if (!constraints.length)
      await db.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${table}_dealershipId_fkey\` FOREIGN KEY (dealershipId) REFERENCES Dealership(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
      );
  }
  const indexes = await db.$queryRawUnsafe<{ Key_name: string }[]>(
    "SHOW INDEX FROM Ms365Batch",
  );
  for (const field of ["batchNumber", "accountEmail"]) {
    const name = `Ms365Batch_dealershipId_${field}_key`;
    if (!indexes.some((i) => i.Key_name === name))
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX \`${name}\` ON Ms365Batch (dealershipId,\`${field}\`)`,
      );
    const old = `Ms365Batch_${field}_key`;
    if (indexes.some((i) => i.Key_name === old))
      await db.$executeRawUnsafe(`DROP INDEX \`${old}\` ON Ms365Batch`);
  }
  if (!completed.length)
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "INSERT IGNORE INTO UserDealership (userId,dealershipId) SELECT id,'dealer-1' FROM User",
      );
      await tx.$executeRawUnsafe(
        "INSERT IGNORE INTO UserDealership (userId,dealershipId) SELECT id,'dealer-2' FROM User WHERE role='ADMIN'",
      );
      await tx.$executeRawUnsafe(
        "INSERT IGNORE INTO `_MisMigration` (id) VALUES ('dealership-v1')",
      );
    });
  for (const table of ["InventoryRecord", "Credential", "Ms365Batch"]) {
    const missing = await db.$queryRawUnsafe<unknown[]>(
      `SELECT id FROM \`${table}\` WHERE dealershipId IS NULL OR dealershipId NOT IN (SELECT id FROM Dealership)`,
    );
    if (missing.length) throw new Error(`Unassigned records in ${table}.`);
  }
  console.log(
    "Dealership migration verified. Existing data belongs to TNE.",
  );
}
main()
  .catch(() => {
    console.error(
      "Migration failed; preserve the snapshot and retry after correcting database access/schema issues.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
