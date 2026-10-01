import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { HttpError, hashPassword } from "../lib/server/auth";
import { sapDate, sapInput } from "../lib/server/sap-users";

test("SAP dates accept empty values and the distant validity end", () => {
  assert.equal(sapDate("", "Valid To"), null);
  assert.equal(sapDate("9999-12-31", "Valid To")?.toISOString().slice(0, 10), "9999-12-31");
  assert.throws(() => sapDate("2026-02-30", "Valid To"), HttpError);
});

test("SAP input requires account details and ordered optional dates", () => {
  const basic = { firstName: "Ana", lastName: "Cruz", sapId: "TNE-ANA1", department: "Service", dealershipId: "dealer-1", status: "ACTIVE" };
  assert.equal(sapInput(basic).memberId, null);
  assert.throws(() => sapInput({ ...basic, sapId: "" }), HttpError);
  assert.throws(() => sapInput({ ...basic, validFrom: "2026-10-02", validTo: "2026-10-01" }), HttpError);
});

test("SAP API shares both dealerships and enforces links and roles", { skip: !process.env.MIS_INTEGRATION_URL, timeout: 120000 }, async () => {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const base = process.env.MIS_INTEGRATION_URL!;
  const origin = new URL(process.env.APP_URL || base).origin;
  const marker = "sap-test-" + randomBytes(6).toString("hex");
  const password = randomBytes(24).toString("hex");
  const ids: string[] = [];
  const members: string[] = [];
  const accounts: string[] = [];
  const cookies: string[] = [];
  async function request(path: string, actor: number, method = "GET", data?: unknown) {
    return fetch(base + path, { method, headers: { origin, cookie: cookies[actor] || "", "content-type": "application/json", "x-dealership-id": actor === 1 ? "dealer-2" : "dealer-1" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  }
  try {
    for (const [index, role, dealer] of [[0, "IT", "dealer-1"], [1, "IT", "dealer-2"], [2, "MEMBER", "dealer-1"]] as const) {
      const user = await db.user.create({ data: { name: marker + index, email: `${marker}-${index}@example.com`, passwordHash: hashPassword(password), role, dealerships: { create: [{ dealershipId: dealer }] } } });
      ids.push(user.id);
      const login = await request("/api/auth/login", index, "POST", { email: user.email, password });
      assert.equal(login.status, 200);
      cookies.push(login.headers.get("set-cookie")!.split(";")[0]);
    }
    for (const dealer of ["dealer-1", "dealer-2"]) {
      const member = await db.inventoryRecord.create({ data: { kind: "members", name: `${marker}-${dealer}`, dealershipId: dealer, data: {} } });
      members.push(member.id);
    }
    const baseUser = { firstName: "Ana", lastName: "Cruz", sapId: marker, department: "Service", status: "ACTIVE", dealershipId: "dealer-1", memberId: members[1], validFrom: "2026-01-01", validTo: "9999-12-31" };
    assert.equal((await request("/api/sap-users", 2, "POST", baseUser)).status, 403);
    assert.equal((await request("/api/sap-users", 0, "POST", { ...baseUser, memberId: "missing" })).status, 400);
    assert.equal((await request("/api/sap-users", 0, "POST", { ...baseUser, memberId: members[1], validTo: "2025-12-31" })).status, 400);
    const created = await request("/api/sap-users", 0, "POST", baseUser);
    assert.equal(created.status, 201);
    const record = (await created.json()).user;
    accounts.push(record.id);
    assert.equal(record.memberId, members[1]);
    assert.equal(record.validTo, "9999-12-31");
    for (const actor of [0, 1, 2]) {
      const list = await request("/api/sap-users", actor);
      assert.equal(list.status, 200);
      assert.ok((await list.json()).users.some((item: any) => item.id === record.id));
    }
    assert.equal((await request("/api/sap-users", 1, "POST", { ...baseUser, memberId: null })).status, 409);
    assert.equal((await request("/api/sap-users", 1, "POST", { ...baseUser, sapId: marker + "-2" })).status, 409);
    assert.equal((await request(`/api/records/${members[1]}`, 1, "DELETE")).status, 409);
    assert.equal((await request(`/api/sap-users/${record.id}`, 2, "PATCH", { department: "Finance" })).status, 403);
    const updated = await request(`/api/sap-users/${record.id}`, 1, "PATCH", { department: "Finance", memberId: members[0] });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).user.memberId, members[0]);
    assert.equal((await request(`/api/sap-users/${record.id}`, 1, "DELETE")).status, 200);
    accounts.pop();
  } finally {
    await db.sapUser.deleteMany({ where: { id: { in: accounts } } });
    await db.inventoryRecord.deleteMany({ where: { id: { in: members } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
