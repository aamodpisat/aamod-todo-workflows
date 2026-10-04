"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { inboxWorkflow, isEmail, parseTags, todayIso, httpUrl } from "./domain";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "./rate-limit";
import { secretsMatch } from "./secret";
import { currentRole } from "./auth";
import { SESSION_COOKIE, signSession } from "./session";
import { newId } from "./file-store";
import { getStore } from "./store";
import { deliver } from "./mail";
import type { EmailKind } from "./types";

export type ActionResult = { ok: true; notice?: string } | { ok: false; error: string };

async function requireUser(): Promise<void> {
  const role = await currentRole();
  if (!role) redirect("/login");
}

async function requireAdmin(): Promise<ActionResult | null> {
  const role = await currentRole();
  if (!role) redirect("/login");
  if (role !== "admin") return { ok: false, error: "The admin key is required for this." };
  return null;
}

async function clientKey(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function login(formData: FormData): Promise<ActionResult> {
  const key = await clientKey();
  if (!loginAllowed(key)) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  if (!process.env.APP_SYSTEM_ID || !process.env.SESSION_SECRET) {
    return { ok: false, error: "The server is missing APP_SYSTEM_ID or SESSION_SECRET." };
  }
  const systemId = String(formData.get("systemId") ?? "");
  const matches = await secretsMatch(systemId, process.env.APP_SYSTEM_ID);
  if (!matches) {
    recordLoginFailure(key);
    return { ok: false, error: "That system id was not accepted." };
  }
  clearLoginFailures(key);
  const token = await signSession("operator");
  if (!token) return { ok: false, error: "SESSION_SECRET needs to be at least 16 characters." };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function signInAdmin(formData: FormData): Promise<ActionResult> {
  const key = await clientKey();
  if (!loginAllowed(key)) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  if (!process.env.APP_ADMIN_ID || !process.env.SESSION_SECRET) {
    return { ok: false, error: "The server is missing APP_ADMIN_ID or SESSION_SECRET." };
  }
  const adminId = String(formData.get("adminId") ?? "");
  const matches = await secretsMatch(adminId, process.env.APP_ADMIN_ID);
  if (!matches) {
    recordLoginFailure(key);
    return { ok: false, error: "That admin key was not accepted." };
  }
  clearLoginFailures(key);
  const token = await signSession("admin");
  if (!token) return { ok: false, error: "SESSION_SECRET needs to be at least 16 characters." };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function createTask(input: { title: string; description: string; deadline: string; tags: string }): Promise<ActionResult> {
  await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Add a title." };
  const store = await getStore();
  const board = await store.getBoard();
  const inbox = inboxWorkflow(board.workflows);
  if (!inbox) return { ok: false, error: "Add a workflow before creating a task." };
  const today = todayIso();
  await store.createTask({
    id: newId(),
    title,
    description: input.description.trim(),
    workflowId: inbox.id,
    enteredOn: today,
    deadline: input.deadline || null,
    createdAt: new Date().toISOString(),
    tags: parseTags(input.tags),
    people: [],
    links: [],
    comments: [],
  });
  return { ok: true, notice: `Task created in ${inbox.name}` };
}

export async function moveTask(taskId: string, workflowId: string): Promise<ActionResult> {
  await requireUser();
  const store = await getStore();
  await store.moveTask(taskId, workflowId, todayIso());
  return { ok: true };
}

export async function saveTask(taskId: string, patch: { description?: string; deadline?: string; tags?: string }): Promise<ActionResult> {
  await requireUser();
  const store = await getStore();
  await store.saveTask(taskId, {
    description: patch.description,
    deadline: patch.deadline === undefined ? undefined : patch.deadline || null,
    tags: patch.tags === undefined ? undefined : parseTags(patch.tags),
  });
  return { ok: true };
}

export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  await requireUser();
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  const store = await getStore();
  const task = await store.addComment(taskId, { id: newId(), body: text, createdOn: todayIso() });
  if (!task) return { ok: false, error: "Task not found." };
  if (!task.people.length) return { ok: true, notice: "Comment saved" };
  const notices: string[] = [];
  for (const email of task.people) {
    const result = await deliver(`Update on ${task.title}`, `<p>${escapeForMail(text)}</p><p>${escapeForMail(task.title)}</p>`, email);
    notices.push(result.sent ? `Emailed ${email}` : result.reason ?? "Mail was not sent");
  }
  return { ok: true, notice: `Comment saved. ${notices.join(" ")}` };
}

export async function addLink(taskId: string, label: string, url: string): Promise<ActionResult> {
  await requireUser();
  const safeUrl = httpUrl(url);
  if (!safeUrl) return { ok: false, error: "Links need to start with http:// or https://." };
  const store = await getStore();
  await store.addLink(taskId, { id: newId(), label: label.trim() || safeUrl, url: safeUrl });
  return { ok: true };
}

export async function addPerson(taskId: string, email: string): Promise<ActionResult> {
  await requireUser();
  const value = email.trim().toLowerCase();
  if (!isEmail(value)) return { ok: false, error: "Enter a full email address." };
  const store = await getStore();
  const task = await store.addPerson(taskId, value);
  if (!task) return { ok: false, error: "Task not found." };
  const result = await deliver(`You were tagged on ${task.title}`, `<p>You were tagged on ${escapeForMail(task.title)}.</p>`, value);
  return { ok: true, notice: result.sent ? `Tagged ${value} and emailed them` : `Tagged ${value}. ${result.reason}` };
}

export async function renameWorkflow(workflowId: string, name: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const next = name.trim();
  if (!next) return { ok: false, error: "A workflow needs a name." };
  const store = await getStore();
  await store.renameWorkflow(workflowId, next);
  return { ok: true };
}

export async function setWorkflowAlert(workflowId: string, alert: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = await getStore();
  await store.setWorkflowAlert(workflowId, alert);
  return { ok: true };
}

export async function moveWorkflow(workflowId: string, direction: -1 | 1): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = await getStore();
  await store.moveWorkflow(workflowId, direction);
  return { ok: true };
}

export async function addWorkflow(name: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const next = name.trim();
  if (!next) return { ok: false, error: "Name the workflow." };
  const store = await getStore();
  const board = await store.getBoard();
  const position = board.workflows.reduce((max, workflow) => Math.max(max, workflow.position), -1) + 1;
  await store.addWorkflow({ id: newId(), name: next, position, alert: true });
  return { ok: true };
}

export async function removeWorkflow(workflowId: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const store = await getStore();
    await store.removeWorkflow(workflowId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove that workflow." };
  }
}

const EMAIL_FIELDS = ["subject", "headline", "intro", "signoff"] as const;

export async function saveEmailField(kind: EmailKind, field: (typeof EMAIL_FIELDS)[number], value: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (kind !== "daily" && kind !== "reminder") return { ok: false, error: "Unknown letter." };
  if (!EMAIL_FIELDS.includes(field)) return { ok: false, error: "Unknown field." };
  const store = await getStore();
  const board = await store.getBoard();
  const current = board.emails[kind];
  await store.saveEmail(kind, { ...current, [field]: value });
  return { ok: true };
}

function escapeForMail(value: string): string {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
}
