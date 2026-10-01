import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/server/db";
import styles from "./status.module.css";

export const metadata: Metadata = {
  title: "Database status | MIS Hub",
  description: "Check whether MIS Hub can reach its database.",
};

type DatabaseStatus = "ready" | "schema-error" | "connection-error";

async function checkDatabase(): Promise<DatabaseStatus> {
  await connection();

  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return "connection-error";
  }

  try {
    await db.user.count();
    return "ready";
  } catch {
    return "schema-error";
  }
}

export default async function DatabaseStatusPage() {
  const status = await checkDatabase();
  const ready = status === "ready";
  const title =
    status === "ready"
      ? "Database ready"
      : status === "schema-error"
        ? "Connected, but setup is incomplete"
        : "Database not connected";
  const message =
    status === "ready"
      ? "MIS Hub reached the database and successfully queried its application tables."
      : status === "schema-error"
        ? "MIS Hub reached MySQL, but it could not query the required application tables. Check that the schema was imported into the database named in DATABASE_URL."
        : "MIS Hub could not reach the database. Check DATABASE_URL and confirm that the database server is available.";

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <div
          className={`${styles.indicator} ${ready ? styles.connected : styles.disconnected}`}
          aria-hidden="true"
        />
        <p className={styles.eyebrow}>MIS Hub system check</p>
        <h1>{title}</h1>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <a className={styles.primaryAction} href="/database-status">
            Check again
          </a>
          <Link className={styles.secondaryAction} href="/">
            Return to MIS Hub
          </Link>
        </div>

        <p className={styles.privacyNote}>
          This check never displays database credentials or connection details.
        </p>
      </section>
    </main>
  );
}
