import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/server/db";
import styles from "./status.module.css";

export const metadata: Metadata = {
  title: "Database status | MIS Hub",
  description: "Check whether MIS Hub can reach its database.",
};

async function checkDatabase() {
  await connection();

  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function DatabaseStatusPage() {
  const connected = await checkDatabase();

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <div
          className={`${styles.indicator} ${connected ? styles.connected : styles.disconnected}`}
          aria-hidden="true"
        />
        <p className={styles.eyebrow}>MIS Hub system check</p>
        <h1>
          {connected ? "Database connected" : "Database not connected"}
        </h1>
        <p className={styles.message}>
          {connected
            ? "MIS Hub successfully reached the database and completed a test query."
            : "MIS Hub could not reach the database. Check DATABASE_URL and confirm that the database server is available."}
        </p>

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
