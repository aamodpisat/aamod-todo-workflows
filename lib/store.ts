import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { defaultEmails, defaultWorkflows } from "./domain";
import { createFileStore, type TodoStore } from "./file-store";
import type { BoardData, EmailKind, EmailTemplate, MailLog, Task, TaskComment, TaskLink, Workflow } from "./types";

type Sql = NeonQueryFunction<false, false>;

let postgresStore: Promise<TodoStore> | null = null;

export function getStore(): Promise<TodoStore> {
  if (process.env.DATABASE_URL) {
    postgresStore ??= createPostgresStore(process.env.DATABASE_URL);
    return postgresStore;
  }
  if (process.env.VERCEL) {
    return Promise.reject(new Error("DATABASE_URL is required on Vercel. Add a Postgres connection string in the project environment."));
  }
  return Promise.resolve(createFileStore());
}

async function createPostgresStore(databaseUrl: string): Promise<TodoStore> {
  const sql = neon(databaseUrl);
  await ensureSchema(sql);
  await seed(sql);
  return postgresApi(sql);
}

async function ensureSchema(sql: Sql): Promise<void> {
  const statements = [
    `create table if not exists workflows (
      id text primary key,
      name text not null,
      position integer not null,
      alert boolean not null default true
    )`,
    `create table if not exists tasks (
      id text primary key,
      title text not null,
      description text not null default '',
      workflow_id text not null references workflows(id),
      entered_on text not null,
      deadline text,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists comments (
      id text primary key,
      task_id text not null references tasks(id),
      body text not null,
      created_on text not null
    )`,
    `create table if not exists links (
      id text primary key,
      task_id text not null references tasks(id),
      label text not null,
      url text not null
    )`,
    `create table if not exists task_tags (
      task_id text not null references tasks(id),
      tag text not null,
      primary key (task_id, tag)
    )`,
    `create table if not exists task_people (
      task_id text not null references tasks(id),
      email text not null,
      primary key (task_id, email)
    )`,
    `create table if not exists email_templates (
      kind text primary key,
      subject text not null,
      headline text not null,
      intro text not null,
      signoff text not null
    )`,
    `create table if not exists mail_log (
      id text primary key,
      kind text not null,
      task_id text,
      workflow_id text,
      entered_on text,
      sent_on text not null
    )`,
  ];
  for (const statement of statements) await sql.query(statement);
}

async function seed(sql: Sql): Promise<void> {
  const existing = await sql`select count(*)::int as count from workflows`;
  if (Number(existing[0]?.count ?? 0) === 0) {
    for (const workflow of defaultWorkflows()) {
      await sql`insert into workflows (id, name, position, alert) values (${workflow.id}, ${workflow.name}, ${workflow.position}, ${workflow.alert})`;
    }
  }
  const emails = defaultEmails();
  for (const template of [emails.daily, emails.reminder]) {
    await sql`insert into email_templates (kind, subject, headline, intro, signoff)
      values (${template.kind}, ${template.subject}, ${template.headline}, ${template.intro}, ${template.signoff})
      on conflict (kind) do nothing`;
  }
}

function postgresApi(sql: Sql): TodoStore {
  return {
    getBoard: () => loadBoard(sql),
    async createTask(task) {
      await sql`insert into tasks (id, title, description, workflow_id, entered_on, deadline, created_at)
        values (${task.id}, ${task.title}, ${task.description}, ${task.workflowId}, ${task.enteredOn}, ${task.deadline}, ${task.createdAt})`;
      await replaceTags(sql, task.id, task.tags);
    },
    async saveTask(taskId, patch) {
      if (patch.title != null) await sql`update tasks set title = ${patch.title} where id = ${taskId}`;
      if (patch.description != null) await sql`update tasks set description = ${patch.description} where id = ${taskId}`;
      if (patch.deadline !== undefined) await sql`update tasks set deadline = ${patch.deadline} where id = ${taskId}`;
      if (patch.tags) await replaceTags(sql, taskId, patch.tags);
    },
    async moveTask(taskId, workflowId, enteredOn) {
      await sql`update tasks set workflow_id = ${workflowId}, entered_on = ${enteredOn} where id = ${taskId} and workflow_id <> ${workflowId}`;
    },
    async addComment(taskId, comment) {
      await sql`insert into comments (id, task_id, body, created_on) values (${comment.id}, ${taskId}, ${comment.body}, ${comment.createdOn})`;
      const board = await loadBoard(sql);
      return board.tasks.find((task) => task.id === taskId) ?? null;
    },
    async addLink(taskId, link) {
      await sql`insert into links (id, task_id, label, url) values (${link.id}, ${taskId}, ${link.label}, ${link.url})`;
    },
    async addPerson(taskId, email) {
      await sql`insert into task_people (task_id, email) values (${taskId}, ${email}) on conflict do nothing`;
      const board = await loadBoard(sql);
      return board.tasks.find((task) => task.id === taskId) ?? null;
    },
    async renameWorkflow(workflowId, name) {
      await sql`update workflows set name = ${name} where id = ${workflowId}`;
    },
    async setWorkflowAlert(workflowId, alert) {
      await sql`update workflows set alert = ${alert} where id = ${workflowId}`;
    },
    async moveWorkflow(workflowId, direction) {
      const board = await loadBoard(sql);
      const ordered = board.workflows.slice().sort((a, b) => a.position - b.position);
      const index = ordered.findIndex((workflow) => workflow.id === workflowId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= ordered.length) return;
      const current = ordered[index];
      ordered[index] = ordered[next];
      ordered[next] = current;
      for (let position = 0; position < ordered.length; position += 1) {
        await sql`update workflows set position = ${position} where id = ${ordered[position].id}`;
      }
    },
    async addWorkflow(workflow) {
      await sql`insert into workflows (id, name, position, alert) values (${workflow.id}, ${workflow.name}, ${workflow.position}, ${workflow.alert})`;
    },
    async removeWorkflow(workflowId) {
      const board = await loadBoard(sql);
      if (board.workflows.length <= 1) throw new Error("Keep at least one workflow.");
      const count = board.tasks.filter((task) => task.workflowId === workflowId).length;
      if (count) throw new Error(`Move the ${count} task${count > 1 ? "s" : ""} out before removing this workflow.`);
      await sql`delete from workflows where id = ${workflowId}`;
    },
    async saveEmail(kind, template) {
      await sql`insert into email_templates (kind, subject, headline, intro, signoff)
        values (${kind}, ${template.subject}, ${template.headline}, ${template.intro}, ${template.signoff})
        on conflict (kind) do update set subject = excluded.subject, headline = excluded.headline, intro = excluded.intro, signoff = excluded.signoff`;
    },
    async wasDailySent(day) {
      const rows = await sql`select 1 from mail_log where kind = 'daily' and sent_on = ${day} limit 1`;
      return rows.length > 0;
    },
    async wasStuckSent(taskId, workflowId, enteredOn) {
      const rows = await sql`select 1 from mail_log where kind = 'stuck' and task_id = ${taskId} and workflow_id = ${workflowId} and entered_on = ${enteredOn} limit 1`;
      return rows.length > 0;
    },
    async recordMail(entry) {
      await sql`insert into mail_log (id, kind, task_id, workflow_id, entered_on, sent_on)
        values (${entry.id}, ${entry.kind}, ${entry.taskId}, ${entry.workflowId}, ${entry.enteredOn}, ${entry.sentOn})`;
    },
  };
}

async function replaceTags(sql: Sql, taskId: string, tags: string[]): Promise<void> {
  await sql`delete from task_tags where task_id = ${taskId}`;
  for (const tag of tags) await sql`insert into task_tags (task_id, tag) values (${taskId}, ${tag})`;
}

async function loadBoard(sql: Sql): Promise<BoardData> {
  const workflows = (await sql`select id, name, position, alert from workflows order by position`) as Workflow[];
  const taskRows = (await sql`select id, title, description, workflow_id as "workflowId", entered_on as "enteredOn", deadline, created_at as "createdAt" from tasks order by created_at desc`) as Array<
    Omit<Task, "tags" | "people" | "links" | "comments">
  >;
  const comments = (await sql`select id, task_id as "taskId", body, created_on as "createdOn" from comments order by created_on`) as Array<TaskComment & { taskId: string }>;
  const links = (await sql`select id, task_id as "taskId", label, url from links`) as Array<TaskLink & { taskId: string }>;
  const tags = (await sql`select task_id as "taskId", tag from task_tags`) as Array<{ taskId: string; tag: string }>;
  const people = (await sql`select task_id as "taskId", email from task_people`) as Array<{ taskId: string; email: string }>;
  const emailRows = (await sql`select kind, subject, headline, intro, signoff from email_templates`) as EmailTemplate[];
  const defaults = defaultEmails();
  const emails = {
    daily: emailRows.find((row) => row.kind === "daily") ?? defaults.daily,
    reminder: emailRows.find((row) => row.kind === "reminder") ?? defaults.reminder,
  };
  const tasks: Task[] = taskRows.map((row) => ({
    ...row,
    deadline: row.deadline || null,
    createdAt: String(row.createdAt),
    tags: tags.filter((tag) => tag.taskId === row.id).map((tag) => tag.tag),
    people: people.filter((person) => person.taskId === row.id).map((person) => person.email),
    links: links.filter((link) => link.taskId === row.id).map(({ id, label, url }) => ({ id, label, url })),
    comments: comments.filter((comment) => comment.taskId === row.id).map(({ id, body, createdOn }) => ({ id, body, createdOn })),
  }));
  return { workflows, tasks, emails };
}

export type { MailLog };
