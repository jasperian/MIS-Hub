import { secretString } from "@/lib/server/auth";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/server/db";
import {
  body,
  checkOrigin,
  COOKIE,
  failure,
  HttpError,
  publicUser,
  rateLimit,
  string,
  tokenHash,
  verifyPassword,
} from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = await body(request);
    const email = string(input.email, "Email").toLowerCase();
    rateLimit("login:" + email);
    const password = secretString(input.password, "Password", 1024);
    if (input.rememberMe !== undefined && typeof input.rememberMe !== "boolean")
      throw new HttpError(400, "Remember me must be true or false.");
    const user = await db.user.findUnique({ where: { email }, include: { dealerships: { include: { dealership: true } } } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash))
      throw new HttpError(401, "Invalid email or password.");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + (input.rememberMe ? 30 * 24 : 8) * 60 * 60 * 1000);
    await db.session.create({
      data: { tokenHash: tokenHash(token), userId: user.id, expiresAt },
    });
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      secure: new URL(process.env.APP_URL || request.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });
    return Response.json({ user: publicUser(user) });
  } catch (error) {
    return failure(error);
  }
}
