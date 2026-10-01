import test from "node:test";
import assert from "node:assert/strict";
import { isLaserJet, replacementHistory } from "../lib/toner";
import { validateRecord } from "../lib/server/validation";

test("LaserJet labels work without HP and tolerate the existing Laserjett spelling", () => {
  for (const brand of ["HP LaserJet Pro", "hp laser jet 1020", "LaserJet", "Laserjett", "LASER JET"])
    assert.equal(isLaserJet(brand), true);
  for (const brand of ["Brother laser", "HP DeskJet", "EPSON", undefined])
    assert.equal(isLaserJet(brand), false);
});

test("optional page counters accept zero and reject invalid values", () => {
  for (const pageCounter of [undefined, null, "", 0, "0", 123])
    assert.doesNotThrow(() =>
      validateRecord("replacements", "Change", { pageCounter }),
    );
  for (const pageCounter of [-1, "abc", 1.5, " ", false, [], Infinity])
    assert.throws(
      () => validateRecord("replacements", "Change", { pageCounter }),
      /Page counter/,
    );
});

test("usage follows per-printer chronology, missing readings and resets", () => {
  const row = (
    id: string,
    date: string,
    pageCounter: unknown,
    printerId = "p1",
    recordedAt = "",
  ) => ({ id, data: { date, pageCounter, printerId, recordedAt } });
  const history = replacementHistory([
    row("c", "2026-09-03", 100),
    row("a", "2026-09-01", 0),
    row("b", "2026-09-02", 80),
    row("d", "2026-09-04", ""),
    row("e", "2026-09-05", 200),
    row("f", "2026-09-06", 10),
    row("g", "2026-09-06", 15, "p1", "2026-09-06T12:00:00Z"),
    row("other", "2026-09-03", 999, "p2"),
  ]);
  const usage = Object.fromEntries(
    history.map((r) => [r.record.id, r.pagesUsed]),
  );
  assert.deepEqual(usage, {
    g: "5",
    f: "Counter reset or corrected",
    e: "Unavailable",
    d: "Unavailable",
    other: "Unavailable",
    c: "20",
    b: "80",
    a: "Unavailable",
  });
});
