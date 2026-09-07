import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import { checkOrigin, COOKIE, failure, tokenHash } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (token)
      await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    jar.delete(COOKIE);
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
