export type Workflow = {
  id: string;
  name: string;
  position: number;
  alert: boolean;
};

export type TaskLink = { id: string; label: string; url: string };
export type TaskComment = { id: string; body: string; createdOn: string };

export type Task = {
  id: string;
  title: string;
  description: string;
  workflowId: string;
  enteredOn: string;
  deadline: string | null;
  createdAt: string;
  tags: string[];
  people: string[];
  links: TaskLink[];
  comments: TaskComment[];
};

export type EmailKind = "daily" | "reminder";

export type EmailTemplate = {
  kind: EmailKind;
  subject: string;
  headline: string;
  intro: string;
  signoff: string;
};

export type MailLog = {
  id: string;
  kind: "daily" | "stuck";
  taskId: string | null;
  workflowId: string | null;
  enteredOn: string | null;
  sentOn: string;
};

export type BoardData = {
  workflows: Workflow[];
  tasks: Task[];
  emails: { daily: EmailTemplate; reminder: EmailTemplate };
};

export type DeadlineFlag = { kind: "overdue" | "soon" | "ok"; label: string };
