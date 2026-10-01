import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/server/auth";

test(
  "live dealership boundaries, shared directory, linked records, secrets and membership revocation",
  { skip: !process.env.MIS_INTEGRATION_URL, timeout: 120000 },
  async () => {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const base = process.env.MIS_INTEGRATION_URL!;
    const origin = new URL(process.env.APP_URL || base).origin;
    const marker = "dealership-test-" + randomBytes(8).toString("hex");
    const password = randomBytes(24).toString("hex");
    const users: string[] = [],
      records: string[] = [],
      credentials: string[] = [],
      batches: string[] = [];
    const cookies: string[] = [];
    async function request(
      path: string,
      index: number,
      dealershipId: string,
      method = "GET",
      data?: unknown,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          origin,
          cookie: cookies[index] || "",
          "content-type": "application/json",
          "x-dealership-id": dealershipId,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    }
    try {
      for (const [index, role, ids] of [
        [0, "IT", ["dealer-1"]],
        [1, "IT", ["dealer-2"]],
        [2, "ADMIN", ["dealer-1", "dealer-2"]],
        [3, "MEMBER", ["dealer-1"]],
        [4, "MANAGER", ["dealer-2"]],
      ] as const) {
        const user = await db.user.create({
          data: {
            name: marker + index,
            email: marker + index + "@example.com",
            passwordHash: hashPassword(password),
            role,
            dealerships: {
              create: ids.map((dealershipId) => ({ dealershipId })),
            },
          },
        });
        users.push(user.id);
        const response = await request("/api/auth/login", index, "", "POST", {
          email: user.email,
          password,
        });
        assert.equal(response.status, 200);
        cookies.push(response.headers.get("set-cookie")!.split(";")[0]);
        const login = await response.json();
        assert.equal(login.user.dealerships.length, ids.length);
      }
      for (const [index, dealer] of [
        [0, "dealer-1"],
        [1, "dealer-2"],
      ] as const) {
        const created = await request("/api/records", index, dealer, "POST", {
          kind: "members",
          name: marker + index,
          data: { email: marker + "@example.com" },
        });
        assert.equal(created.status, 201);
        records.push((await created.json()).record.id);
        const vault = await request("/api/credentials", index, dealer, "POST", {
          title: marker,
          username: marker,
          password,
        });
        assert.equal(vault.status, 201);
        credentials.push((await vault.json()).credential.id);
        const batch = await request(
          "/api/microsoft-365",
          index,
          dealer,
          "POST",
          { accountEmail: marker + "@example.com", password },
        );
        assert.equal(batch.status, 201);
        batches.push((await batch.json()).batch.id);
      }
      for (const [index, own, other] of [
        [0, "dealer-1", "dealer-2"],
        [1, "dealer-2", "dealer-1"],
      ] as const) {
        assert.equal((await request("/api/records", index, other)).status, 403);
        assert.equal((await request("/api/records", index, "")).status, 400);
        const ownList = await (
          await request("/api/records", index, own)
        ).json();
        assert.ok(ownList.records.some((r: any) => r.id === records[index]));
        assert.ok(
          !ownList.records.some((r: any) => r.id === records[1 - index]),
        );
        assert.equal(
          (
            await request(
              `/api/records/${records[1 - index]}`,
              index,
              own,
              "PATCH",
              { name: "forbidden" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/records/${records[1 - index]}`,
              index,
              own,
              "DELETE",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/credentials/${credentials[1 - index]}/reveal`,
              index,
              own,
              "POST",
              { password },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/microsoft-365/${batches[1 - index]}/reveal`,
              index,
              own,
              "POST",
              { password },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/credentials/${credentials[1 - index]}`,
              index,
              own,
              "PATCH",
              { title: "forbidden" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/credentials/${credentials[1 - index]}`,
              index,
              own,
              "DELETE",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/microsoft-365/${batches[1 - index]}`,
              index,
              own,
              "PATCH",
              { notes: "forbidden" },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              `/api/microsoft-365/${batches[1 - index]}/password`,
              index,
              own,
              "PATCH",
              { loginPassword: password, password: "new password" },
            )
          ).status,
          404,
        );
        const link = await request("/api/records", index, own, "POST", {
          kind: "emails",
          name: marker,
          data: {
            address: marker + index + "@example.com",
            type: "Mailbox",
            memberId: records[1 - index],
          },
        });
        assert.equal(link.status, 400);
        const assignment = await request(
          `/api/microsoft-365/${batches[index]}/assignments`,
          index,
          own,
          "POST",
          { memberId: records[1 - index], externalDeviceName: marker },
        );
        assert.equal(assignment.status, 400);
        const audit = await (
          await request(`/api/audit?targetId=${records[1 - index]}`, index, own)
        ).json();
        assert.deepEqual(audit.events, []);
      }
      assert.equal(
        (
          await request("/api/auth/me", 0, "", "PATCH", {
            name: marker + " renamed",
          })
        ).status,
        200,
        "Login identity can be updated without a dealership",
      );
      const toner = await db.inventoryRecord.create({
        data: {
          dealershipId: "dealer-1",
          kind: "toners",
          name: marker,
          data: { quantity: 5 },
        },
      });
      records.push(toner.id);
      const printer = await db.inventoryRecord.create({
        data: {
          dealershipId: "dealer-2",
          kind: "printers",
          name: marker,
          data: {},
        },
      });
      records.push(printer.id);
      assert.equal(
        (
          await request("/api/records", 0, "dealer-1", "POST", {
            kind: "replacements",
            name: marker,
            data: {
              tonerId: toner.id,
              printerId: printer.id,
              quantity: 1,
              date: "2026-10-01",
            },
          })
        ).status,
        400,
      );
      const unchanged = await db.inventoryRecord.findUniqueOrThrow({
        where: { id: toner.id },
      });
      assert.equal(
        (unchanged.data as any).quantity,
        5,
        "Cross-dealership replacement cannot consume stock",
      );
      const sharedIds: string[] = records.slice(0, 2);
      for (const dealershipId of ["dealer-1", "dealer-2"]) {
        const emailRecord = await db.inventoryRecord.create({
          data: {
            dealershipId,
            kind: "emails",
            name: marker + dealershipId,
            data: {
              address: marker + dealershipId + "@example.com",
              type: "Mailbox",
            },
          },
        });
        records.push(emailRecord.id);
        sharedIds.push(emailRecord.id);
      }
      const hiddenDevice = await db.inventoryRecord.create({
        data: {
          dealershipId: "dealer-2",
          kind: "computers",
          name: marker,
          data: {},
        },
      });
      records.push(hiddenDevice.id);
      assert.equal((await request("/api/directory", 99, "")).status, 401);
      for (const index of [0, 1, 2, 3, 4]) {
        const response = await request(
          "/api/directory?kind=computers",
          index,
          "",
        );
        assert.equal(response.status, 200);
        const directory = (await response.json()).records;
        assert.ok(
          sharedIds.every((id) => directory.some((r: any) => r.id === id)),
          "Every role can read both dealerships' profiles and email records",
        );
        assert.ok(
          directory.every((r: any) => ["members", "emails"].includes(r.kind)),
          "Directory exposes only its two categories",
        );
        assert.ok(
          directory.every(
            (r: any) =>
              r.dealership.id === r.dealershipId &&
              typeof r.dealership.name === "string",
          ),
          "Directory supplies dealership tags",
        );
        assert.ok(!directory.some((r: any) => r.id === hiddenDevice.id));
        assert.equal(
          (
            await request("/api/directory", index, "", "POST", {
              kind: "members",
            })
          ).status,
          405,
        );
      }
      for (const dealer of ["dealer-1", "dealer-2"])
        assert.equal((await request("/api/records", 2, dealer)).status, 200);
      assert.equal(
        (
          await request(
            `/api/credentials/${credentials[0]}/reveal`,
            2,
            "dealer-1",
            "POST",
            { password },
          )
        ).status,
        404,
        "Admin still cannot reveal another user's private credential",
      );
      assert.equal(
        (
          await request(`/api/users/${users[0]}`, 2, "dealer-1", "PATCH", {
            dealershipIds: ["dealer-2"],
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/records", 0, "dealer-1")).status,
        403,
        "Revocation applies to an existing session",
      );
      assert.equal(
        await db.inventoryRecord.count({ where: { id: { in: records } } }),
        records.length,
        "Denied requests preserve records",
      );
    } finally {
      await db.ms365Assignment.deleteMany({
        where: { batchId: { in: batches } },
      });
      await db.ms365Batch.deleteMany({ where: { id: { in: batches } } });
      await db.credential.deleteMany({ where: { id: { in: credentials } } });
      await db.inventoryRecord.deleteMany({ where: { id: { in: records } } });
      await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    }
  },
);
