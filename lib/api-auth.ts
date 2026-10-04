import { NextResponse } from "next/server";
import { secretsMatch } from "./secret";

export async function rejectUnlessApiToken(request: Request): Promise<NextResponse | null> {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "API_TOKEN is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!(await secretsMatch(token, expected))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
