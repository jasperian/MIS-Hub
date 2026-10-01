import type { PrismaClient } from "@prisma/client";

const owned = new Set([
  "inventoryRecord",
  "credential",
  "ms365Batch",
  "auditLog",
]);

/** Wrap both the client and transaction delegates; never trust supplied ownership. */
export function scopedClient<T extends object>(
  client: T,
  dealershipId: string,
): T {
  return new Proxy(client, {
    get(target, key) {
      const value: any = Reflect.get(target, key);
      if (
        typeof key === "string" &&
        [
          "$queryRaw",
          "$queryRawUnsafe",
          "$executeRaw",
          "$executeRawUnsafe",
        ].includes(key)
      ) {
        return () => {
          throw new Error(
            "Raw queries are not allowed through a dealership client.",
          );
        };
      }
      if (key === "$transaction") {
        return (callback: (tx: object) => unknown, options?: unknown) => {
          if (typeof callback !== "function")
            throw new Error("Scoped transactions require a callback.");
          return value.call(
            target,
            (tx: object) => callback(scopedClient(tx, dealershipId)),
            options,
          );
        };
      }
      if (
        typeof key !== "string" ||
        (!owned.has(key) && key !== "ms365Assignment")
      ) {
        return typeof value === "function" ? value.bind(target) : value;
      }
      return new Proxy(value, {
        get(delegate: any, operation) {
          return async (input: Record<string, any> = {}) => {
            const args = { ...input };
            const filter =
              key === "ms365Assignment"
                ? { batch: { dealershipId } }
                : { dealershipId };
            if (operation === "create") {
              if (key === "ms365Assignment") {
                const batch = await (
                  target as PrismaClient
                ).ms365Batch.findFirst({
                  where: { id: args.data.batchId, dealershipId },
                });
                if (!batch)
                  throw new Error("Batch is outside this dealership.");
              } else {
                const { dealership: ignoredRelation, ...data } = args.data;
                args.data = { ...data, dealershipId };
              }
            } else if (
              [
                "findMany",
                "findFirst",
                "findFirstOrThrow",
                "findUnique",
                "findUniqueOrThrow",
                "count",
                "aggregate",
                "groupBy",
                "update",
                "updateMany",
                "delete",
                "deleteMany",
              ].includes(String(operation))
            ) {
              args.where = {
                ...args.where,
                AND: [args.where?.AND || {}, filter],
              };
              if (args.data && key !== "ms365Assignment") {
                const {
                  dealershipId: ignored,
                  dealership: ignoredRelation,
                  ...data
                } = args.data;
                args.data = data;
              }
            } else {
              throw new Error(
                `Unsupported scoped database operation: ${String(operation)}`,
              );
            }
            return delegate[operation](args);
          };
        },
      });
    },
  });
}
