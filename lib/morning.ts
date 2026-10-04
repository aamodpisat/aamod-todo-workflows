import { isStuck, todayIso } from "./domain";
import { newId } from "./file-store";
import { dailyHtml, deliver, reminderHtml } from "./mail";
import { getStore } from "./store";

export async function runMorningMail(today = todayIso()): Promise<{ daily: string; reminders: number }> {
  const store = await getStore();
  const board = await store.getBoard();
  let daily = "already-sent";
  if (!(await store.wasDailySent(today))) {
    const letter = dailyHtml(board, today);
    const result = await deliver(letter.subject, letter.html);
    if (!result.sent) daily = result.reason ?? "not-sent";
    else {
      await store.recordMail({ id: newId(), kind: "daily", taskId: null, workflowId: null, enteredOn: null, sentOn: today });
      daily = "sent";
    }
  }
  let reminders = 0;
  for (const task of board.tasks) {
    const workflow = board.workflows.find((item) => item.id === task.workflowId);
    if (!isStuck(task, workflow, today)) continue;
    if (await store.wasStuckSent(task.id, task.workflowId, task.enteredOn)) continue;
    const letter = reminderHtml(board, task, today);
    const result = await deliver(letter.subject, letter.html);
    if (!result.sent) continue;
    await store.recordMail({
      id: newId(),
      kind: "stuck",
      taskId: task.id,
      workflowId: task.workflowId,
      enteredOn: task.enteredOn,
      sentOn: today,
    });
    reminders += 1;
  }
  return { daily, reminders };
}
