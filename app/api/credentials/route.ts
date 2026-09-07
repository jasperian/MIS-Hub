import { secretString } from "@/lib/server/auth";
import {
  body,
  checkOrigin,
  failure,
  requireUser,
  string,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { encrypt } from "@/lib/server/encryption";
import { metadata } from "@/lib/server/credentials";
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({
      credentials: await db.credential.findMany({
        where: { ownerId: user.id },
        select: metadata,
        orderBy: { updatedAt: "desc" },
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await body(request);
    const title = string(input.title, "Title");
    const username = string(input.username, "Username");
    const password = secretString(input.password, "Password", 4096);
    const notes =
      typeof input.notes === "string" ? input.notes.slice(0, 10000) : "";
    const credential = await db.credential.create({
      data: {
        ownerId: user.id,
        title,
        username,
        url: typeof input.url === "string" ? input.url.slice(0, 2048) : null,
        encryptedSecret: encrypt(JSON.stringify({ password, notes })),
      },
      select: metadata,
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "credential.create",
        targetId: credential.id,
      },
    });
    return Response.json({ credential }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
