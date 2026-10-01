import { db } from "./db";
import { HttpError, requireUser } from "./auth";
import { scopedClient } from "./dealership-scope";

export async function dealershipDb(request: Request) {
  const user = await requireUser();
  const dealershipId = request.headers.get("x-dealership-id");
  if (!dealershipId) throw new HttpError(400, "Select a dealership.");
  const membership = await db.userDealership.findUnique({
    where: { userId_dealershipId: { userId: user.id, dealershipId } },
  });
  if (!membership)
    throw new HttpError(403, "You do not have access to this dealership.");
  return scopedClient(db, dealershipId);
}

export async function validateDealershipIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((id) => typeof id !== "string")
  )
    throw new HttpError(400, "Assign at least one dealership.");
  const ids = [...new Set(value)] as string[];
  if (
    (await db.dealership.count({ where: { id: { in: ids } } })) !== ids.length
  )
    throw new HttpError(400, "Select valid dealerships.");
  return ids;
}
