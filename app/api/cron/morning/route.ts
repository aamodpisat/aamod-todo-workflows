import { NextResponse } from "next/server";
import { runMorningMail } from "@/lib/morning";
import { secretsMatch } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!(await secretsMatch(token, expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runMorningMail();
  return NextResponse.json({ ok: true, ...result });
}
