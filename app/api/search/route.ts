import { failure, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { matchesSearch, matchingSearchValue, sortSearchResults, visibleInventory, type SearchResult } from "@/lib/search";

const inventoryKinds = new Set(["computers", "printers", "toners", "ip", "access-points", "members", "emails"]);

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (!q || q.length > 100) return Response.json({ results: [] });
    const allowed = new Map(user.dealerships.map(entry => [entry.dealershipId, entry.dealership.name]));
    const ids = [...allowed.keys()];
    const [records, sapUsers, batches, credentials] = await Promise.all([
      db.inventoryRecord.findMany({ where: { dealershipId: { in: ids }, kind: { in: [...inventoryKinds] } } }),
      db.sapUser.findMany({ where: { dealershipId: { in: ids } }, select: { id: true, firstName: true, lastName: true, sapId: true, department: true, dealershipId: true } }),
      db.ms365Batch.findMany({ where: { dealershipId: { in: ids } }, select: { id: true, batchNumber: true, accountEmail: true, dealershipId: true, assignments: { select: { memberId: true, computerId: true, externalDeviceName: true } } } }),
      db.credential.findMany({ where: { dealershipId: { in: ids }, ownerId: user.id }, select: { id: true, title: true, username: true, url: true, dealershipId: true } }),
    ]);
    const results: SearchResult[] = [];
    const add = (item: Omit<SearchResult, "dealershipName">) => results.push({ ...item, dealershipName: allowed.get(item.dealershipId) || "Dealership" });
    for (const record of visibleInventory(records, user)) {
      const data = record.data as Record<string, unknown>;
      if (!matchesSearch(q, [record.name, data.email, data.serial, data.ip, data.ipAddress, data.employeeId, data.brand, data.model, data.department, data.location, data.mac, data.ssid])) continue;
      add({ id: record.id, kind: record.kind, title: record.name, subtitle: String(data.email || data.serial || data.ip || data.model || ""), dealershipId: record.dealershipId });
    }
    for (const sap of sapUsers) if (matchesSearch(q, [sap.firstName, sap.lastName, `${sap.firstName} ${sap.lastName}`, sap.sapId, sap.department]))
      add({ id: sap.id, kind: "sap-users", title: `${sap.firstName} ${sap.lastName}`, subtitle: sap.sapId, dealershipId: sap.dealershipId });
    // Members may only find batches returned by the existing Microsoft 365 access rule.
    const ownedMemberIds = new Set(visibleInventory(records, user).filter(r => r.kind === "members").map(r => r.id));
    const names = new Map(records.map(r => [r.id, r.name]));
    for (const batch of batches) {
      const assignments = user.role === "MEMBER" ? batch.assignments.filter(a => ownedMemberIds.has(a.memberId)) : batch.assignments;
      if (user.role === "MEMBER" && !assignments.length) continue;
      const title = `Batch ${batch.batchNumber}`;
      const assignmentValues = assignments.flatMap(a => [names.get(a.memberId), a.computerId ? names.get(a.computerId) : "", a.externalDeviceName]);
      const values = [title, batch.accountEmail, ...assignmentValues];
      if (!matchesSearch(q, values)) continue;
      const assignmentMatch = matchingSearchValue(q, assignmentValues);
      add({ id: batch.id, kind: "microsoft-365", title, subtitle: assignmentMatch ? `Assigned to ${assignmentMatch} · ${batch.accountEmail}` : batch.accountEmail, dealershipId: batch.dealershipId });
    }
    for (const credential of credentials) if (matchesSearch(q, [credential.title, credential.username, credential.url]))
      add({ id: credential.id, kind: "credentials", title: credential.title, subtitle: credential.username, dealershipId: credential.dealershipId });
    return Response.json({ results: sortSearchResults(q, results).slice(0, 50) });
  } catch (error) { return failure(error); }
}
