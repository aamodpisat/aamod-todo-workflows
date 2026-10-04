import { OPERATOR_NAME, ageDays, boardCounts, fillTemplate, openTasks, priorityTask, workflowById } from "./domain";
import type { BoardData, Task } from "./types";

export function dailyMessage(board: BoardData, today: string) {
  const counts = boardCounts(board, today);
  const vars = { name: OPERATOR_NAME, urgent: counts.critical, open: counts.open, stuck: counts.stuck };
  const template = board.emails.daily;
  const first = priorityTask(board, today);
  const rest = openTasks(board).filter((task) => task.id !== first?.id).slice(0, 4);
  return {
    subject: fillTemplate(template.subject, vars),
    headline: fillTemplate(template.headline, vars),
    intro: fillTemplate(template.intro, vars),
    signoff: fillTemplate(template.signoff, vars),
    first,
    rest,
    counts,
  };
}

export function reminderMessage(board: BoardData, task: Task, today: string) {
  const workflow = workflowById(board.workflows, task.workflowId);
  const vars = {
    name: OPERATOR_NAME,
    task: task.title,
    workflow: workflow?.name ?? "",
    days: ageDays(task.enteredOn, today),
  };
  const template = board.emails.reminder;
  return {
    subject: fillTemplate(template.subject, vars),
    headline: fillTemplate(template.headline, vars),
    intro: fillTemplate(template.intro, vars),
    signoff: fillTemplate(template.signoff, vars),
    days: vars.days,
    workflow: vars.workflow,
    title: task.title,
  };
}
