import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

test("email passwords stay encrypted and can be revealed only by staff", { skip: !process.env.MIS_INTEGRATION_URL, timeout: 120000 }, async () => {
  process.loadEnvFile(".env");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const base = process.env.MIS_INTEGRATION_URL!;
  const origin = new URL(process.env.APP_URL || base).origin;
  const marker = `email-secret-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = randomBytes(24).toString("base64url");
  const loginPassword = randomBytes(24).toString("base64url");
  let admin = "", member = "", recordId = "", userId = "", memberId = "";
  async function request(path: string, method = "GET", data?: unknown, cookie = admin) {
    return fetch(base + path, { method, headers: { origin, "content-type": "application/json", "x-dealership-id": "dealer-1", ...(cookie ? { cookie } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  }
  async function login(email: string, pass: string) {
    const response = await request("/api/auth/login", "POST", { email, password: pass }, "");
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  try {
    admin = await login(process.env.BOOTSTRAP_ADMIN_EMAIL!, process.env.BOOTSTRAP_ADMIN_PASSWORD!);
    const person = await request("/api/records", "POST", { kind: "members", name: marker, data: { email: `${marker}@example.com` } });
    assert.equal(person.status, 201);
    memberId = (await person.json()).record.id;
    const user = await request("/api/users", "POST", { name: marker, email: `${marker}@example.com`, password: loginPassword, role: "MEMBER", dealershipIds: ["dealer-1"], memberId });
    assert.equal(user.status, 201);
    userId = (await user.json()).user.id;
    member = await login(`${marker}@example.com`, loginPassword);
    const created = await request("/api/records", "POST", { kind: "emails", name: marker, data: { email: `${marker}-mail@example.com`, memberId }, password });
    assert.equal(created.status, 201);
    recordId = (await created.json()).record.id;
    assert.equal((await request(`/api/records/${recordId}`, "PATCH", { data: { password: "plain-text" } })).status, 400);
    const secret = await db.emailAccountPassword.findUniqueOrThrow({ where: { recordId } });
    assert.notEqual(secret.encryptedSecret, password);
    assert.ok(!secret.encryptedSecret.includes(password));
    const directory = await (await request("/api/directory", "GET", undefined, member)).text();
    assert.ok(!directory.includes(password));
    assert.equal((await request(`/api/email-passwords/${recordId}`, "GET", undefined, member)).status, 403);
    assert.equal((await request(`/api/email-passwords/${recordId}`, "POST", { loginPassword }, member)).status, 403);
    assert.deepEqual(await (await request(`/api/email-passwords/${recordId}`)).json(), { hasPassword: true });
    assert.equal((await request(`/api/email-passwords/${recordId}`, "POST", { loginPassword: "wrong" })).status, 401);
    const revealed = await request(`/api/email-passwords/${recordId}`, "POST", { loginPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD });
    assert.equal(revealed.status, 200);
    assert.deepEqual(await revealed.json(), { password });
    assert.equal(revealed.headers.get("cache-control"), "no-store");
    const edited = await request(`/api/records/${recordId}`, "PATCH", { password: "changed-secret" });
    assert.equal(edited.status, 200);
    const changed = await request(`/api/email-passwords/${recordId}`, "POST", { loginPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD });
    assert.deepEqual(await changed.json(), { password: "changed-secret" });
    assert.equal((await request(`/api/email-passwords/${recordId}`, "DELETE", undefined, member)).status, 403);
    assert.equal((await request(`/api/email-passwords/${recordId}`, "DELETE")).status, 200);
    assert.deepEqual(await (await request(`/api/email-passwords/${recordId}`)).json(), { hasPassword: false });
  } finally {
    if (admin) await request("/api/auth/logout", "POST", {});
    if (member) await request("/api/auth/logout", "POST", {}, member);
    await db.auditLog.deleteMany({ where: { OR: [{ targetId: { in: [recordId, memberId, userId].filter(Boolean) } }, { actorId: userId || "none" }] } });
    if (recordId) await db.inventoryRecord.deleteMany({ where: { id: recordId } });
    if (memberId) await db.inventoryRecord.deleteMany({ where: { id: memberId } });
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
