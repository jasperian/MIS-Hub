import test from "node:test";
import assert from "node:assert/strict";
import { scopedClient } from "../lib/server/dealership-scope";

test("dealership filters intersect caller conditions and cover transactions and aggregates", async () => {
  const calls: any[] = [];
  const delegate = new Proxy(
    {},
    {
      get: (_, operation) => async (args: unknown) => {
        calls.push({ operation, args });
        return [];
      },
    },
  );
  const client = {
    inventoryRecord: delegate,
    credential: delegate,
    ms365Batch: delegate,
    auditLog: delegate,
    ms365Assignment: delegate,
    $transaction: async (fn: (tx: object) => unknown) => fn(client),
  };
  const scoped: any = scopedClient(client, "dealer-1");
  for (const model of [
    "inventoryRecord",
    "credential",
    "ms365Batch",
    "auditLog",
    "ms365Assignment",
  ]) {
    for (const op of [
      "findMany",
      "findUnique",
      "update",
      "delete",
      "deleteMany",
      "aggregate",
      "count",
    ]) {
      await scoped[model][op]({
        where: {
          id: "other-id",
          dealershipId: "dealer-2",
          AND: { kind: "members" },
        },
        data: { name: "changed", dealershipId: "dealer-2" },
      });
      const { args } = calls.at(-1);
      assert.equal(args.where.id, "other-id");
      assert.deepEqual(args.where.AND, [
        { kind: "members" },
        model === "ms365Assignment"
          ? { batch: { dealershipId: "dealer-1" } }
          : { dealershipId: "dealer-1" },
      ]);
      if (model !== "ms365Assignment")
        assert.equal(args.data.dealershipId, undefined);
    }
  }
  await scoped.$transaction((tx: any) => tx.inventoryRecord.findMany());
  assert.deepEqual(calls.at(-1).args.where.AND, [
    {},
    { dealershipId: "dealer-1" },
  ]);
  await scoped.auditLog.create({
    data: { actorId: "u", dealershipId: "dealer-2" },
  });
  assert.equal(calls.at(-1).args.data.dealershipId, "dealer-1");
  await assert.rejects(() => scoped.inventoryRecord.upsert({}), /Unsupported/);
});
