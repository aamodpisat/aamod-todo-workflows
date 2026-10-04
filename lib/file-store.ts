import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultEmails, defaultWorkflows, todayIso } from "./domain";
import type { BoardData, EmailKind, EmailTemplate, MailLog, Task, Workflow } from "./types";

type FileData = BoardData & { mailLog: MailLog[] };

export type TodoStore = {
  getBoard(): Promise<BoardData>;
  createTask(task: Task): Promise<void>;
  saveTask(taskId: string, patch: Partial<Pick<Task, "title" | "description" | "deadline" | "tags">>): Promise<void>;
  moveTask(taskId: string, workflowId: string, enteredOn: string): Promise<void>;
  addComment(taskId: string, comment: Task["comments"][number]): Promise<Task | null>;
  addLink(taskId: string, link: Task["links"][number]): Promise<void>;
  addPerson(taskId: string, email: string): Promise<Task | null>;
  renameWorkflow(workflowId: string, name: string): Promise<void>;
  setWorkflowAlert(workflowId: string, alert: boolean): Promise<void>;
  moveWorkflow(workflowId: string, direction: -1 | 1): Promise<void>;
  addWorkflow(workflow: Workflow): Promise<void>;
  removeWorkflow(workflowId: string): Promise<void>;
  saveEmail(kind: EmailKind, template: Omit<EmailTemplate, "kind">): Promise<void>;
  wasDailySent(day: string): Promise<boolean>;
  wasStuckSent(taskId: string, workflowId: string, enteredOn: string): Promise<boolean>;
  recordMail(entry: MailLog): Promise<void>;
};

function emptyData(): FileData {
  return { workflows: defaultWorkflows(), tasks: [], emails: defaultEmails(), mailLog: [] };
}

export function createFileStore(directory = path.join(process.cwd(), ".data")): TodoStore {
  const file = path.join(directory, "board.json");
  let chain: Promise<unknown> = Promise.resolve();

  function locked<T>(work: () => Promise<T>): Promise<T> {
    const run = chain.then(work, work);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function read(): Promise<FileData> {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as FileData;
      if (!parsed.workflows?.length || !parsed.emails) return emptyData();
      parsed.mailLog ??= [];
      return parsed;
    } catch {
      return emptyData();
    }
  }

  async function write(data: FileData): Promise<void> {
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2));
    await rename(temporary, file);
  }

  function taskOf(data: FileData, taskId: string): Task | undefined {
    return data.tasks.find((task) => task.id === taskId);
  }

  return {
    async getBoard() {
      const data = await read();
      return { workflows: data.workflows, tasks: data.tasks, emails: data.emails };
    },
    createTask(task) {
      return locked(async () => {
        const data = await read();
        data.tasks.unshift(task);
        await write(data);
      });
    },
    saveTask(taskId, patch) {
      return locked(async () => {
        const data = await read();
        const task = taskOf(data, taskId);
        if (!task) throw new Error("Task not found");
        if (patch.title != null) task.title = patch.title;
        if (patch.description != null) task.description = patch.description;
        if (patch.deadline !== undefined) task.deadline = patch.deadline;
        if (patch.tags) task.tags = patch.tags;
        await write(data);
      });
    },
    moveTask(taskId, workflowId, enteredOn) {
      return locked(async () => {
        const data = await read();
        const task = taskOf(data, taskId);
        if (!task) throw new Error("Task not found");
        if (!data.workflows.some((workflow) => workflow.id === workflowId)) throw new Error("Workflow not found");
        if (task.workflowId === workflowId) return;
        task.workflowId = workflowId;
        task.enteredOn = enteredOn;
        await write(data);
      });
    },
    addComment(taskId, comment) {
      return locked(async () => {
        const data = await read();
        const task = taskOf(data, taskId);
        if (!task) return null;
        task.comments.push(comment);
        await write(data);
        return task;
      });
    },
    addLink(taskId, link) {
      return locked(async () => {
        const data = await read();
        const task = taskOf(data, taskId);
        if (!task) throw new Error("Task not found");
        task.links.push(link);
        await write(data);
      });
    },
    addPerson(taskId, email) {
      return locked(async () => {
        const data = await read();
        const task = taskOf(data, taskId);
        if (!task) return null;
        if (!task.people.includes(email)) task.people.push(email);
        await write(data);
        return task;
      });
    },
    renameWorkflow(workflowId, name) {
      return locked(async () => {
        const data = await read();
        const workflow = data.workflows.find((item) => item.id === workflowId);
        if (!workflow) throw new Error("Workflow not found");
        workflow.name = name;
        await write(data);
      });
    },
    setWorkflowAlert(workflowId, alert) {
      return locked(async () => {
        const data = await read();
        const workflow = data.workflows.find((item) => item.id === workflowId);
        if (!workflow) throw new Error("Workflow not found");
        workflow.alert = alert;
        await write(data);
      });
    },
    moveWorkflow(workflowId, direction) {
      return locked(async () => {
        const data = await read();
        const ordered = data.workflows.slice().sort((a, b) => a.position - b.position);
        const index = ordered.findIndex((workflow) => workflow.id === workflowId);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= ordered.length) return;
        const current = ordered[index];
        ordered[index] = ordered[next];
        ordered[next] = current;
        ordered.forEach((workflow, position) => {
          workflow.position = position;
        });
        data.workflows = ordered;
        await write(data);
      });
    },
    addWorkflow(workflow) {
      return locked(async () => {
        const data = await read();
        data.workflows.push(workflow);
        await write(data);
      });
    },
    removeWorkflow(workflowId) {
      return locked(async () => {
        const data = await read();
        if (data.workflows.length <= 1) throw new Error("Keep at least one workflow.");
        const count = data.tasks.filter((task) => task.workflowId === workflowId).length;
        if (count) throw new Error(`Move the ${count} task${count > 1 ? "s" : ""} out before removing this workflow.`);
        data.workflows = data.workflows.filter((workflow) => workflow.id !== workflowId);
        await write(data);
      });
    },
    saveEmail(kind, template) {
      return locked(async () => {
        const data = await read();
        data.emails[kind] = { kind, ...template };
        await write(data);
      });
    },
    async wasDailySent(day) {
      const data = await read();
      return data.mailLog.some((entry) => entry.kind === "daily" && entry.sentOn === day);
    },
    async wasStuckSent(taskId, workflowId, enteredOn) {
      const data = await read();
      return data.mailLog.some(
        (entry) => entry.kind === "stuck" && entry.taskId === taskId && entry.workflowId === workflowId && entry.enteredOn === enteredOn,
      );
    },
    recordMail(entry) {
      return locked(async () => {
        const data = await read();
        data.mailLog.push(entry);
        await write(data);
      });
    },
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function stampTask(input: Omit<Task, "id" | "createdAt" | "enteredOn" | "comments" | "links" | "people" | "tags"> & Partial<Task>): Task {
  const today = todayIso();
  return {
    id: input.id ?? newId(),
    title: input.title,
    description: input.description,
    workflowId: input.workflowId,
    enteredOn: input.enteredOn ?? today,
    deadline: input.deadline ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    tags: input.tags ?? [],
    people: input.people ?? [],
    links: input.links ?? [],
    comments: input.comments ?? [],
  };
}
