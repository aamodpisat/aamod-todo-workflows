import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession, type SessionRole } from "./session";

export async function currentRole(): Promise<SessionRole | null> {
  const cookieStore = await cookies();
  return readSession(cookieStore.get(SESSION_COOKIE)?.value);
}
