import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

test(
  "live persistence, member isolation, vault ownership and toner transactions",
  { skip: !process.env.MIS_INTEGRATION_URL, timeout: 120000 },
  async () => {
    process.loadEnvFile(".env");
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const base = process.env.MIS_INTEGRATION_URL!;
    const origin = new URL(process.env.APP_URL || base).origin;
    const marker = `integration-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const recordIds: string[] = [],
      userIds: string[] = [],
      credentialIds: string[] = [];
    let admin = "",
      member = "";
    async function request(
      path: string,
      method = "GET",
      data?: unknown,
      cookie = admin,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          origin,
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    }
    async function login(email: string, password: string) {
      const response = await request(
        "/api/auth/login",
        "POST",
        { email, password },
        "",
      );
      assert.equal(response.status, 200, "login must succeed");
      return response.headers.get("set-cookie")!.split(";")[0];
    }
    async function create(
      kind: string,
      data: Record<string, unknown> = {},
      name = `${marker}-${kind}`,
    ) {
      const response = await request("/api/records", "POST", {
        kind,
        name,
        data,
      });
      assert.equal(response.status, 201, `create ${kind}`);
      const record = (await response.json()).record;
      recordIds.push(record.id);
      return record;
    }
    try {
      admin = await login(
        process.env.BOOTSTRAP_ADMIN_EMAIL!,
        process.env.BOOTSTRAP_ADMIN_PASSWORD!,
      );
      const person = await create("members", {
        email: `${marker}@example.com`,
      });
      const memberPassword = randomBytes(24).toString("base64url");
      const userResponse = await request("/api/users", "POST", {
        name: marker,
        email: `${marker}@example.com`,
        password: memberPassword,
        role: "MEMBER",
        memberId: person.id,
      });
      assert.equal(userResponse.status, 201);
      userIds.push((await userResponse.json()).user.id);
      member = await login(`${marker}@example.com`, memberPassword);
      assert.equal(
        (
          await request(
            "/api/records",
            "POST",
            { kind: "computers", name: marker, data: {} },
            member,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/api/records/${person.id}`,
            "PATCH",
            { name: "unauthorized" },
            member,
          )
        ).status,
        403,
      );
      const assignedEmail = await create("emails", {
        email: `${marker}-work@example.com`,
        memberId: person.id,
      });
      const unrelatedEmail = await create(
        "emails",
        { email: `${marker}-other@example.com` },
        `${marker}-unrelated`,
      );
      const ownRecords = (
        await (await request("/api/records", "GET", undefined, member)).json()
      ).records;
      assert.ok(
        ownRecords.some((r: { id: string }) => r.id === assignedEmail.id),
      );
      assert.ok(
        !ownRecords.some((r: { id: string }) => r.id === unrelatedEmail.id),
      );

      const secret = randomBytes(24).toString("base64url");
      const credentialResponse = await request(
        "/api/credentials",
        "POST",
        { title: marker, username: marker, password: secret },
        member,
      );
      assert.equal(credentialResponse.status, 201);
      const credential = (await credentialResponse.json()).credential;
      credentialIds.push(credential.id);
      assert.equal(credential.password, undefined);
      const stored = await db.credential.findUniqueOrThrow({
        where: { id: credential.id },
      });
      assert.ok(!stored.encryptedSecret.includes(secret));
      assert.notEqual(stored.encryptedSecret, secret);
      assert.equal(
        (
          await request(
            `/api/credentials/${credential.id}/reveal`,
            "POST",
            { password: "wrong-password" },
            member,
          )
        ).status,
        401,
      );
      const revealed = await request(
        `/api/credentials/${credential.id}/reveal`,
        "POST",
        { password: memberPassword },
        member,
      );
      assert.equal(revealed.status, 200);
      assert.equal((await revealed.json()).password, secret);
      assert.equal(revealed.headers.get("cache-control"), "no-store");
      assert.equal(
        (
          await request(`/api/credentials/${credential.id}/reveal`, "POST", {
            password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
          })
        ).status,
        404,
      );
      const adminCredentialResponse = await request(
        "/api/credentials",
        "POST",
        { title: marker, username: marker, password: secret },
      );
      assert.equal(adminCredentialResponse.status, 201);
      const adminCredential = (await adminCredentialResponse.json()).credential;
      credentialIds.push(adminCredential.id);
      assert.equal(
        (
          await request(
            `/api/credentials/${adminCredential.id}/reveal`,
            "POST",
            { password: memberPassword },
            member,
          )
        ).status,
        404,
      );

      const existingRecords = await db.inventoryRecord.findMany();
      const availableIp = Array.from(
        { length: 254 },
        (_, i) => `172.16.11.${254 - i}`,
      ).find(
        (ip) =>
          !existingRecords.some((r) => {
            const data = r.data as Record<string, unknown>;
            return (
              data.ip === ip ||
              data.ipAddress === ip ||
              (r.kind === "ip" && r.name === ip)
            );
          }),
      );
      assert.ok(availableIp, "test requires one available address");
      await create("computers", { ip: availableIp });
      assert.equal(
        (
          await request("/api/records", "POST", {
            kind: "printers",
            name: marker,
            data: { ip: availableIp },
          })
        ).status,
        409,
      );
      const printer = await create("printers");
      const toner = await create("toners", { quantity: 2 });
      await create("replacements", {
        printerId: printer.id,
        tonerId: toner.id,
        quantity: 1,
      });
      assert.equal(
        (
          (
            await db.inventoryRecord.findUniqueOrThrow({
              where: { id: toner.id },
            })
          ).data as Record<string, unknown>
        ).quantity,
        1,
      );
      const before = await db.inventoryRecord.count({
        where: { kind: "replacements", name: `${marker}-replacements` },
      });
      assert.equal(
        (
          await request("/api/records", "POST", {
            kind: "replacements",
            name: `${marker}-replacements`,
            data: { printerId: printer.id, tonerId: toner.id, quantity: 2 },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          (
            await db.inventoryRecord.findUniqueOrThrow({
              where: { id: toner.id },
            })
          ).data as Record<string, unknown>
        ).quantity,
        1,
      );
      assert.equal(
        await db.inventoryRecord.count({
          where: { kind: "replacements", name: `${marker}-replacements` },
        }),
        before,
      );
      assert.equal(
        (await request(`/api/records/${printer.id}`, "DELETE")).status,
        409,
        "maintenance links prevent deletion",
      );
      assert.equal(
        (
          await request("/api/records", "POST", {
            kind: "computers",
            name: marker,
            data: { memberId: "missing-member" },
          })
        ).status,
        400,
      );
      const shared = await create("emails", {
        email: `${marker}-shared@example.com`,
        type: "Shared mailbox",
        memberIds: [person.id],
      });
      const visible = (
        await (await request("/api/records", "GET", undefined, member)).json()
      ).records;
      assert.ok(visible.some((r: { id: string }) => r.id === shared.id));
      assert.equal(
        (
          await request("/api/records", "POST", {
            kind: "emails",
            name: marker,
            data: { email: `${marker}-alias@example.com`, type: "Alias" },
          })
        ).status,
        400,
      );
      const profile = await request(
        "/api/auth/me",
        "PATCH",
        { name: "Updated member", phone: "123456", role: "ADMIN" },
        member,
      );
      assert.equal(profile.status, 200);
      assert.equal((await profile.json()).user.role, "MEMBER");
      const updatedProfile = await db.inventoryRecord.findUniqueOrThrow({
        where: { id: person.id },
      });
      assert.equal(updatedProfile.name, "Updated member");
      assert.equal(
        (updatedProfile.data as Record<string, unknown>).phone,
        "123456",
      );
      const history = await request(`/api/audit?targetId=${person.id}`);
      assert.ok(
        (await history.json()).events.some(
          (event: { details: unknown }) => !!event.details,
        ),
      );
      assert.equal(
        (await request("/api/audit", "GET", undefined, member)).status,
        403,
      );
      const spacedSecret = "  private secret with spaces  ";
      assert.equal(
        (
          await request(
            `/api/credentials/${credential.id}`,
            "PATCH",
            { password: spacedSecret },
            member,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await (
            await request(
              `/api/credentials/${credential.id}/reveal`,
              "POST",
              { password: memberPassword },
              member,
            )
          ).json()
        ).password,
        spacedSecret,
      );
      const newPassword = ` ${randomBytes(24).toString("hex")} `;
      assert.equal(
        (
          await request(
            "/api/auth/me",
            "PATCH",
            { currentPassword: "incorrect", newPassword },
            member,
          )
        ).status,
        401,
      );
      const changed = await request(
        "/api/auth/me",
        "PATCH",
        { currentPassword: memberPassword, newPassword },
        member,
      );
      assert.equal(changed.status, 200);
      assert.equal((await changed.json()).requiresLogin, true);
      assert.equal(
        (await request("/api/auth/me", "GET", undefined, member)).status,
        401,
      );
      member = await login(`${marker}@example.com`, newPassword);
    } finally {
      // Exact IDs created by this test only; immutable history has no public deletion route.
      if (admin) await request("/api/auth/logout", "POST", {});
      if (member) await request("/api/auth/logout", "POST", {}, member);
      await db.credential.deleteMany({ where: { id: { in: credentialIds } } });
      await db.inventoryRecord.deleteMany({ where: { id: { in: recordIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    }
  },
);
