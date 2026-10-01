type Replacement = { id: string; data: Record<string, any> };

export function isLaserJet(brand: unknown) {
  return (
    typeof brand === "string" &&
    /\blaser\s*jett?\b/i.test(brand)
  );
}

export function replacementHistory<T extends Replacement>(records: T[]) {
  const ordered = [...records].sort(
    (a, b) =>
      String(a.data.date || "").localeCompare(String(b.data.date || "")) ||
      String(a.data.recordedAt || "").localeCompare(
        String(b.data.recordedAt || ""),
      ) ||
      a.id.localeCompare(b.id),
  );
  const previous = new Map<string, unknown>();
  return ordered
    .map((record) => {
      const counter = record.data.pageCounter;
      const prior = previous.get(record.data.printerId);
      const present = (value: unknown) =>
        value !== "" &&
        value !== undefined &&
        value !== null &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) >= 0;
      const pagesUsed =
        present(counter) && present(prior)
          ? Number(counter) < Number(prior)
            ? "Counter reset or corrected"
            : String(Number(counter) - Number(prior))
          : "Unavailable";
      previous.set(record.data.printerId, counter);
      return { record, pagesUsed };
    })
    .reverse();
}
