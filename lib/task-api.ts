import { inboxWorkflow, isEmail, parseTags, todayIso } from "./domain";
import { newId } from "./file-store";
import { deliver } from "./mail";
import { getStore } from "./store";
import type { Task, Workflow } from "./types";

export type ApiBody = { status: number; body: Record<string, unknown> };

type JsonObject = Record<string, unknown>;

function present(task: Task, workflows: Workflow[]) {
  const workflow = workflows.find((item) => item.id === task.workflowId);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    workflowId: task.workflowId,
    workflow: workflow?.name ?? "",
    enteredOn: task.enteredOn,
    deadline: task.deadline,
    createdAt: task.createdAt,
    tags: task.tags,
    people: task.people,
    links: task.links,
    comments: task.comments,
  };
}

function asObject(input: unknown): JsonObject | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as JsonObject;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function tagsOf(value: unknown): string[] | undefined {
  if (typeof value === "string") return parseTags(value);
  if (!Array.isArray(value)) return undefined;
  return parseTags(value.filter((item): item is string => typeof item === "string").join(","));
}

function emailsOf(value: unknown): string[] {
  const raw = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const email = item.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function workflowIdOf(value: unknown, workflows: Workflow[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  const match = workflows.find((workflow) => workflow.id.toLowerCase() === key || workflow.name.toLowerCase() === key);
  return match?.id ?? null;
}

function deadlineOf(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

async function board() {
  const store = await getStore();
  return { store, data: await store.getBoard() };
}

async function mailPeople(task: Task, emails: string[], subject: string, html: string) {
  const mail = [];
  for (const email of emails) {
    const result = await deliver(subject, html, email);
    mail.push({ email, sent: result.sent, ...(result.reason ? { reason: result.reason } : {}) });
  }
  return mail;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
}

export async function listTasks(workflow: string | null): Promise<ApiBody> {
  const { data } = await board();
  let tasks = data.tasks;
  if (workflow) {
    const id = workflowIdOf(workflow, data.workflows);
    if (!id) return { status: 400, body: { ok: false, error: "Unknown workflow." } };
    tasks = tasks.filter((task) => task.workflowId === id);
  }
  return { status: 200, body: { ok: true, tasks: tasks.map((task) => present(task, data.workflows)) } };
}

export async function getTask(taskId: string): Promise<ApiBody> {
  const { data } = await board();
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return { status: 404, body: { ok: false, error: "Task not found." } };
  return { status: 200, body: { ok: true, task: present(task, data.workflows) } };
}

export async function createTaskFromApi(input: unknown): Promise<ApiBody> {
  const body = asObject(input);
  if (!body) return { status: 400, body: { ok: false, error: "Send a JSON object." } };
  const title = text(body.title)?.trim() ?? "";
  if (!title) return { status: 400, body: { ok: false, error: "Add a title." } };
  const description = text(body.description)?.trim() ?? "";
  const deadline = deadlineOf(body.deadline);
  if (body.deadline !== undefined && deadline === undefined) {
    return { status: 400, body: { ok: false, error: "Deadline must be YYYY-MM-DD or empty." } };
  }
  const { store, data } = await board();
  const requested = workflowIdOf(body.status ?? body.workflowId ?? body.workflow, data.workflows);
  if (requested === null) return { status: 400, body: { ok: false, error: "Unknown status." } };
  const workflow = data.workflows.find((item) => item.id === requested) ?? inboxWorkflow(data.workflows);
  if (!workflow) return { status: 400, body: { ok: false, error: "Add a workflow before creating a task." } };
  const emails = emailsOf(body.emails ?? body.email);
  const invalid = emails.find((email) => !isEmail(email));
  if (invalid) return { status: 400, body: { ok: false, error: `Not an email: ${invalid}` } };
  const today = todayIso();
  const task: Task = {
    id: newId(),
    title,
    description,
    workflowId: workflow.id,
    enteredOn: today,
    deadline: deadline ?? null,
    createdAt: new Date().toISOString(),
    tags: tagsOf(body.tags) ?? [],
    people: [],
    links: [],
    comments: [],
  };
  await store.createTask(task);
  for (const email of emails) await store.addPerson(task.id, email);
  const saved = (await store.getBoard()).tasks.find((item) => item.id === task.id) ?? { ...task, people: emails };
  const mail = emails.length
    ? await mailPeople(saved, emails, `You were tagged on ${saved.title}`, `<p>You were tagged on ${escapeHtml(saved.title)}.</p>`)
    : [];
  return { status: 201, body: { ok: true, task: present(saved, data.workflows), mail } };
}

export async function updateTaskFromApi(taskId: string, input: unknown): Promise<ApiBody> {
  const body = asObject(input);
  if (!body) return { status: 400, body: { ok: false, error: "Send a JSON object." } };
  const { store, data } = await board();
  const current = data.tasks.find((item) => item.id === taskId);
  if (!current) return { status: 404, body: { ok: false, error: "Task not found." } };
  const title = text(body.title);
  if (title !== undefined && !title.trim()) return { status: 400, body: { ok: false, error: "A task needs a title." } };
  const deadline = deadlineOf(body.deadline);
  if (body.deadline !== undefined && deadline === undefined) {
    return { status: 400, body: { ok: false, error: "Deadline must be YYYY-MM-DD or empty." } };
  }
  const tags = tagsOf(body.tags);
  const description = text(body.description);
  const requested = workflowIdOf(body.status ?? body.workflowId ?? body.workflow, data.workflows);
  if (requested === null) return { status: 400, body: { ok: false, error: "Unknown status." } };
  await store.saveTask(taskId, {
    title: title?.trim(),
    description: description?.trim(),
    deadline,
    tags,
  });
  if (requested && requested !== current.workflowId) await store.moveTask(taskId, requested, todayIso());
  const next = await store.getBoard();
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) return { status: 404, body: { ok: false, error: "Task not found." } };
  return { status: 200, body: { ok: true, task: present(task, next.workflows) } };
}

export async function commentFromApi(taskId: string, input: unknown): Promise<ApiBody> {
  const body = asObject(input);
  if (!body) return { status: 400, body: { ok: false, error: "Send a JSON object." } };
  const textBody = text(body.body)?.trim() ?? "";
  if (!textBody) return { status: 400, body: { ok: false, error: "Write a comment." } };
  const { store, data } = await board();
  if (!data.tasks.some((item) => item.id === taskId)) return { status: 404, body: { ok: false, error: "Task not found." } };
  const task = await store.addComment(taskId, { id: newId(), body: textBody, createdOn: todayIso() });
  if (!task) return { status: 404, body: { ok: false, error: "Task not found." } };
  const mail = task.people.length
    ? await mailPeople(task, task.people, `Update on ${task.title}`, `<p>${escapeHtml(textBody)}</p><p>${escapeHtml(task.title)}</p>`)
    : [];
  return { status: 201, body: { ok: true, task: present(task, data.workflows), mail } };
}

export async function notifyFromApi(taskId: string, input: unknown): Promise<ApiBody> {
  const body = asObject(input);
  if (!body) return { status: 400, body: { ok: false, error: "Send a JSON object." } };
  const emails = emailsOf(body.emails ?? body.email);
  if (!emails.length) return { status: 400, body: { ok: false, error: "Add at least one email." } };
  const invalid = emails.find((email) => !isEmail(email));
  if (invalid) return { status: 400, body: { ok: false, error: `Not an email: ${invalid}` } };
  const { store, data } = await board();
  if (!data.tasks.some((item) => item.id === taskId)) return { status: 404, body: { ok: false, error: "Task not found." } };
  let task: Task | null = null;
  for (const email of emails) task = await store.addPerson(taskId, email);
  if (!task) return { status: 404, body: { ok: false, error: "Task not found." } };
  const mail = await mailPeople(task, emails, `You were tagged on ${task.title}`, `<p>You were tagged on ${escapeHtml(task.title)}.</p>`);
  return { status: 200, body: { ok: true, task: present(task, data.workflows), mail } };
}
