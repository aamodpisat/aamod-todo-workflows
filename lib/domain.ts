import type { BoardData, DeadlineFlag, EmailTemplate, Task, Workflow } from "./types";

export const OPERATOR_NAME = "Aamod";
export const NEAR_DAYS = 2;
export const STUCK_DAYS = 7;
export const TIME_ZONE = "Asia/Kolkata";

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysFromToday(iso: string, today = todayIso()): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function ageDays(enteredOn: string, today = todayIso()): number {
  return -daysFromToday(enteredOn, today);
}

export function isTerminalName(name: string): boolean {
  return name === "Done" || name === "Archived";
}

export function workflowById(workflows: Workflow[], id: string): Workflow | undefined {
  return workflows.find((workflow) => workflow.id === id);
}

export function inboxWorkflow(workflows: Workflow[]): Workflow | undefined {
  return (
    workflows.find((workflow) => workflow.name.trim().toLowerCase() === "todo") ??
    workflows.slice().sort((a, b) => a.position - b.position)[0]
  );
}

export function deadlineState(task: Task, workflowName: string, today = todayIso()): DeadlineFlag | null {
  if (!task.deadline || isTerminalName(workflowName)) return null;
  const days = daysFromToday(task.deadline, today);
  if (days < 0) return { kind: "overdue", label: `Overdue ${Math.abs(days)}d` };
  if (days <= NEAR_DAYS) return { kind: "soon", label: days === 0 ? "Due today" : `Due in ${days}d` };
  return { kind: "ok", label: `Due ${task.deadline}` };
}

export function isCritical(task: Task, workflowName: string, today = todayIso()): boolean {
  const flag = deadlineState(task, workflowName, today);
  return Boolean(flag && flag.kind !== "ok");
}

export function isStuck(task: Task, workflow: Workflow | undefined, today = todayIso()): boolean {
  return Boolean(workflow?.alert) && ageDays(task.enteredOn, today) >= STUCK_DAYS;
}

export function openTasks(board: BoardData): Task[] {
  return board.tasks.filter((task) => {
    const workflow = workflowById(board.workflows, task.workflowId);
    return !isTerminalName(workflow?.name ?? "");
  });
}

function pressure(task: Task, board: BoardData, today: string): number {
  const workflow = workflowById(board.workflows, task.workflowId);
  const flag = deadlineState(task, workflow?.name ?? "", today);
  let score = ageDays(task.enteredOn, today);
  if (flag?.kind === "overdue") score += 100;
  else if (flag?.kind === "soon") score += 40;
  if (isStuck(task, workflow, today)) score += 30;
  return score;
}

export function priorityTask(board: BoardData, today = todayIso()): Task | null {
  return openTasks(board).sort((a, b) => pressure(b, board, today) - pressure(a, board, today))[0] ?? null;
}

export function longestStuck(board: BoardData, today = todayIso()): Task | null {
  return (
    board.tasks
      .filter((task) => isStuck(task, workflowById(board.workflows, task.workflowId), today))
      .sort((a, b) => ageDays(b.enteredOn, today) - ageDays(a.enteredOn, today))[0] ?? null
  );
}

export function boardCounts(board: BoardData, today = todayIso()) {
  const open = openTasks(board);
  return {
    open: open.length,
    critical: open.filter((task) => isCritical(task, workflowById(board.workflows, task.workflowId)?.name ?? "", today)).length,
    stuck: board.tasks.filter((task) => isStuck(task, workflowById(board.workflows, task.workflowId), today)).length,
    done: board.tasks.length - open.length,
  };
}

export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (vars[key] == null ? "" : String(vars[key])));
}

export function defaultEmails(): { daily: EmailTemplate; reminder: EmailTemplate } {
  return {
    daily: {
      kind: "daily",
      subject: "Aamod, {{urgent}} tasks need you before the day gets away",
      headline: "Start with this one.",
      intro: "Everything else can wait. If you only touch one task this morning, make it the one below.",
      signoff: "Move it forward, even by a single step.",
    },
    reminder: {
      kind: "reminder",
      subject: "Still in {{workflow}}: {{task}}",
      headline: "This has been waiting {{days}} days.",
      intro: "It has not changed workflow. Finish the next step, or move it on purpose.",
      signoff: "A task left sitting is a decision. Make that decision today.",
    },
  };
}

export function defaultWorkflows(): Workflow[] {
  return [
    { id: "todo", name: "Todo", position: 0, alert: true },
    { id: "progress", name: "In Progress", position: 1, alert: true },
    { id: "review", name: "In Review", position: 2, alert: true },
    { id: "hold", name: "On Hold", position: 3, alert: true },
    { id: "done", name: "Done", position: 4, alert: false },
    { id: "archived", name: "Archived", position: 5, alert: false },
  ];
}

export function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(",")) {
    const tag = part.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function httpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
