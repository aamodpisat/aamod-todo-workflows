import { NextResponse } from "next/server";
import { rejectUnlessApiToken } from "@/lib/api-auth";
import { createTaskFromApi, listTasks } from "@/lib/task-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await rejectUnlessApiToken(request);
  if (denied) return denied;
  const workflow = new URL(request.url).searchParams.get("workflow");
  const result = await listTasks(workflow);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const denied = await rejectUnlessApiToken(request);
  if (denied) return denied;
  const result = await createTaskFromApi(await readBody(request));
  return NextResponse.json(result.body, { status: result.status });
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
