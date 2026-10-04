import { NextResponse } from "next/server";
import { rejectUnlessApiToken } from "@/lib/api-auth";
import { commentFromApi } from "@/lib/task-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const denied = await rejectUnlessApiToken(request);
  if (denied) return denied;
  const { id } = await context.params;
  const result = await commentFromApi(id, await readBody(request));
  return NextResponse.json(result.body, { status: result.status });
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
