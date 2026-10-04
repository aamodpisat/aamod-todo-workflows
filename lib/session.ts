import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "todo_session";

export type SessionRole = "operator" | "admin";

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

export async function signSession(role: SessionRole): Promise<string | null> {
  const key = secretKey();
  if (!key) return null;
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("operator")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function readSession(token: string | undefined): Promise<SessionRole | null> {
  const key = secretKey();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.sub !== "operator") return null;
    return payload.role === "admin" ? "admin" : "operator";
  } catch {
    return null;
  }
}
