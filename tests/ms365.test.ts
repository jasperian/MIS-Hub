import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

test(
  "Microsoft 365 batches enforce capacity, ownership, device, secret, and history rules",
  { skip: !process.env.MIS_INTEGRATION_URL, timeout: 120000 },
  async () => {
    process.loadEnvFile(".env");
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const base = process.env.MIS_INTEGRATION_URL!;
    const origin = new URL(process.env.APP_URL || base).origin;
    const marker = `ms365-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const batchIds: string[] = [];
    const assignmentIds: string[] = [];
    const recordIds: string[] = [];
    const userIds: string[] = [];
    let admin = "";
    let it = "";
    let manager = "";
    let member = "";

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
      assert.equal(response.status, 200, `login must succeed for ${email}`);
      return response.headers.get("set-cookie")!.split(";")[0];
    }

    async function createRecord(
      kind: string,
      name: string,
      data: Record<string, unknown> = {},
    ) {
      const response = await request("/api/records", "POST", {
        kind,
        name,
        data,
      });
      assert.equal(response.status, 201, `create ${kind} ${name}`);
      const record = (await response.json()).record;
      recordIds.push(record.id);
      return record;
    }

    async function createUser(
      role: "IT" | "MANAGER" | "MEMBER",
      memberId?: string,
    ) {
      const password = `${role}-${randomBytes(18).toString("base64url")}`;
      const email = `${marker}-${role.toLowerCase()}@example.com`;
      const response = await request("/api/users", "POST", {
        name: `${marker} ${role}`,
        email,
        password,
        role,
        memberId,
      });
      assert.equal(response.status, 201, `create ${role} login`);
      userIds.push((await response.json()).user.id);
      return { email, password, cookie: await login(email, password) };
    }

    async function createBatch(index: number, password: string) {
      const response = await request("/api/microsoft-365", "POST", {
        accountEmail: `${marker}-batch-${index}@example.com`,
        password,
        status: "ACTIVE",
        notes: marker,
      });
      assert.equal(response.status, 201, `create Microsoft 365 batch ${index}`);
      const batch = (await response.json()).batch;
      batchIds.push(batch.id);
      return batch;
    }

    async function assign(
      batchId: string,
      memberId: string,
      options: { computerId?: string; externalDeviceName?: string } = {},
    ) {
      const response = await request(
        `/api/microsoft-365/${batchId}/assignments`,
        "POST",
        { memberId, ...options, notes: marker },
      );
      if (response.status === 201) {
        const assignment = (await response.clone().json()).assignment;
        assignmentIds.push(assignment.id);
      }
      return response;
    }

    try {
      admin = await login(
        process.env.BOOTSTRAP_ADMIN_EMAIL!,
        process.env.BOOTSTRAP_ADMIN_PASSWORD!,
      );

      const firstMember = await createRecord(
        "members",
        `${marker} member one`,
        { email: `${marker}-member@example.com` },
      );
      const otherMember = await createRecord(
        "members",
        `${marker} member two`,
        { email: `${marker}-other@example.com` },
      );
      const memberLogin = await createUser("MEMBER", firstMember.id);
      const managerLogin = await createUser("MANAGER");
      const itLogin = await createUser("IT");
      member = memberLogin.cookie;
      manager = managerLogin.cookie;
      it = itLogin.cookie;

      const computers = [];
      for (let index = 1; index <= 5; index++)
        computers.push(
          await createRecord("computers", `${marker} computer ${index}`),
        );

      const originalMax =
        (
          await db.ms365Batch.aggregate({
            _max: { batchNumber: true },
          })
        )._max.batchNumber || 0;
      const sharedSecret = `Office-${randomBytes(18).toString("base64url")}`;
      const primary = await createBatch(1, sharedSecret);
      assert.equal(primary.batchNumber, originalMax + 1);
      assert.equal(primary.name, `Batch ${originalMax + 1}`);
      assert.equal(primary.capacity, 5);
      assert.equal(primary.activeCount, 0);
      assert.equal(primary.password, undefined);

      // On a fresh database this reaches and verifies Batch 21. On an existing
      // database, every created number is still checked for max+1 sequencing.
      let latest = primary;
      const targetBatchNumber = Math.max(21, primary.batchNumber);
      while (latest.batchNumber < targetBatchNumber) {
        const next = await createBatch(batchIds.length + 1, sharedSecret);
        assert.equal(next.batchNumber, latest.batchNumber + 1);
        latest = next;
      }
      if (originalMax < 21) assert.equal(latest.name, "Batch 21");

      const linked = await assign(primary.id, firstMember.id, {
        computerId: computers[0].id,
      });
      assert.equal(linked.status, 201, "registered device assignment");
      const linkedAssignment = (await linked.json()).assignment;
      assert.equal(linkedAssignment.slotNumber, 1);
      assert.equal(linkedAssignment.computer.id, computers[0].id);

      const secondBatch =
        batchIds.length > 1
          ? { id: batchIds[1] }
          : await createBatch(batchIds.length + 1, sharedSecret);
      assert.equal(
        (
          await assign(secondBatch.id, otherMember.id, {
            computerId: computers[0].id,
          })
        ).status,
        409,
        "a registered device may have only one active assignment",
      );
      assert.equal(
        (await assign(primary.id, firstMember.id)).status,
        400,
        "a device or external device description is required",
      );

      for (let index = 1; index <= 3; index++)
        assert.equal(
          (
            await assign(primary.id, firstMember.id, {
              computerId: computers[index].id,
            })
          ).status,
          201,
        );
      const external = await assign(primary.id, firstMember.id, {
        externalDeviceName: `${marker} personal tablet`,
      });
      assert.equal(external.status, 201, "external device assignment");
      const externalAssignment = (await external.json()).assignment;
      assert.equal(externalAssignment.slotNumber, 5);
      assert.equal(
        (
          await assign(primary.id, firstMember.id, {
            externalDeviceName: `${marker} sixth device`,
          })
        ).status,
        409,
        "a sixth active assignment is rejected",
      );

      const release = await request(
        `/api/microsoft-365/${primary.id}/assignments/${linkedAssignment.id}/release`,
        "POST",
        {},
      );
      assert.equal(release.status, 200);
      assert.equal((await release.json()).assignment.status, "RELEASED");
      const reused = await assign(primary.id, firstMember.id, {
        computerId: computers[4].id,
      });
      assert.equal(reused.status, 201, "released capacity can be reused");
      assert.equal((await reused.json()).assignment.slotNumber, 1);
      const history = await db.ms365Assignment.findUniqueOrThrow({
        where: { id: linkedAssignment.id },
      });
      assert.equal(history.status, "RELEASED");
      assert.ok(history.releasedAt);

      const unrelatedAssignment = await assign(secondBatch.id, otherMember.id, {
        externalDeviceName: `${marker} other device`,
      });
      assert.equal(unrelatedAssignment.status, 201);
      const memberBatchesResponse = await request(
        "/api/microsoft-365",
        "GET",
        undefined,
        member,
      );
      assert.equal(memberBatchesResponse.status, 200);
      const memberBatches = (await memberBatchesResponse.json()).batches;
      const ownBatch = memberBatches.find(
        (batch: { id: string }) => batch.id === primary.id,
      );
      assert.ok(ownBatch, "member sees a batch assigned to their profile");
      assert.ok(
        ownBatch.assignments.every(
          (assignment: { memberId: string }) =>
            assignment.memberId === firstMember.id,
        ),
      );
      assert.ok(
        !memberBatches.some(
          (batch: { id: string }) => batch.id === secondBatch.id,
        ),
        "member cannot see another member's batch",
      );

      assert.equal(
        (
          await request(
            `/api/microsoft-365/${primary.id}/reveal`,
            "POST",
            { password: managerLogin.password },
            manager,
          )
        ).status,
        403,
        "manager cannot reveal a shared password",
      );
      assert.equal(
        (
          await request(
            `/api/microsoft-365/${primary.id}/reveal`,
            "POST",
            { password: memberLogin.password },
            member,
          )
        ).status,
        403,
        "member cannot reveal a shared password",
      );
      assert.equal(
        (
          await request(`/api/microsoft-365/${primary.id}/reveal`, "POST", {
            password: "incorrect",
          })
        ).status,
        401,
      );
      const adminReveal = await request(
        `/api/microsoft-365/${primary.id}/reveal`,
        "POST",
        { password: process.env.BOOTSTRAP_ADMIN_PASSWORD },
      );
      assert.equal(adminReveal.status, 200);
      assert.equal((await adminReveal.json()).password, sharedSecret);
      assert.equal(adminReveal.headers.get("cache-control"), "no-store");
      const itReveal = await request(
        `/api/microsoft-365/${primary.id}/reveal`,
        "POST",
        { password: itLogin.password },
        it,
      );
      assert.equal(itReveal.status, 200);
      assert.equal((await itReveal.json()).password, sharedSecret);

      const replacementSecret = `Updated-${randomBytes(18).toString("hex")}`;
      assert.equal(
        (
          await request(
            `/api/microsoft-365/${primary.id}/password`,
            "PATCH",
            { loginPassword: itLogin.password, password: replacementSecret },
            it,
          )
        ).status,
        200,
      );
      const storedBatch = await db.ms365Batch.findUniqueOrThrow({
        where: { id: primary.id },
      });
      assert.notEqual(storedBatch.encryptedSecret, replacementSecret);
      assert.ok(!storedBatch.encryptedSecret.includes(replacementSecret));
      const updatedReveal = await request(
        `/api/microsoft-365/${primary.id}/reveal`,
        "POST",
        { password: process.env.BOOTSTRAP_ADMIN_PASSWORD },
      );
      assert.equal((await updatedReveal.json()).password, replacementSecret);

      assert.equal(
        (
          await request(`/api/microsoft-365/${primary.id}`, "PATCH", {
            notes: `${marker} updated`,
          })
        ).status,
        200,
      );
      const auditActions = (
        await db.auditLog.findMany({
          where: {
            OR: [
              { targetId: { in: batchIds } },
              { targetId: { in: assignmentIds } },
            ],
          },
          select: { action: true, details: true },
        })
      ).map((event) => event.action);
      for (const action of [
        "ms365.batch.create",
        "ms365.batch.update",
        "ms365.assignment.create",
        "ms365.assignment.release",
        "ms365.password.reveal",
        "ms365.password.update",
      ])
        assert.ok(auditActions.includes(action), `audit contains ${action}`);
      const auditJson = JSON.stringify(
        await db.auditLog.findMany({
          where: {
            OR: [
              { targetId: { in: batchIds } },
              { targetId: { in: assignmentIds } },
            ],
          },
          select: { details: true },
        }),
      );
      assert.ok(!auditJson.includes(sharedSecret));
      assert.ok(!auditJson.includes(replacementSecret));
    } finally {
      if (admin) await request("/api/auth/logout", "POST", {});
      if (it) await request("/api/auth/logout", "POST", {}, it);
      if (manager) await request("/api/auth/logout", "POST", {}, manager);
      if (member) await request("/api/auth/logout", "POST", {}, member);
      // Remove only rows created by this test, in dependency order.
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: userIds } },
            {
              targetId: {
                in: [...batchIds, ...assignmentIds, ...recordIds, ...userIds],
              },
            },
          ],
        },
      });
      await db.ms365Assignment.deleteMany({
        where: { id: { in: assignmentIds } },
      });
      await db.ms365Batch.deleteMany({ where: { id: { in: batchIds } } });
      await db.inventoryRecord.deleteMany({
        where: { id: { in: recordIds } },
      });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    }
  },
);
