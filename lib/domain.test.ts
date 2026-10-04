import assert from "node:assert/strict";
import test from "node:test";
import {
  ageDays,
  boardCounts,
  deadlineState,
  defaultWorkflows,
  fillTemplate,
  httpUrl,
  isStuck,
  longestStuck,
  parseTags,
  priorityTask,
  todayIso,
} from "./domain.ts";
import type { BoardData, Task } from "./types.ts";

const today = "2026-10-04";

function task(partial: Partial<Task> & Pick<Task, "id" | "workflowId" | "enteredOn">): Task {
  return {
    title: partial.id,
    description: "",
    deadline: null,
    createdAt: partial.enteredOn,
    tags: [],
    people: [],
    links: [],
    comments: [],
    ...partial,
  };
}

function board(tasks: Task[]): BoardData {
  return { workflows: defaultWorkflows(), tasks, emails: { daily: { kind: "daily", subject: "", headline: "", intro: "", signoff: "" }, reminder: { kind: "reminder", subject: "", headline: "", intro: "", signoff: "" } } };
}

test("today uses the India calendar", () => {
  assert.equal(todayIso(new Date("2026-10-03T20:00:00Z")), "2026-10-04");
  assert.equal(todayIso(new Date("2026-10-03T18:00:00Z")), "2026-10-03");
});

test("deadline marks overdue and the 48 hour window, and ignores done work", () => {
  const overdue = task({ id: "a", workflowId: "todo", enteredOn: "2026-10-01", deadline: "2026-10-03" });
  const soon = task({ id: "b", workflowId: "todo", enteredOn: "2026-10-04", deadline: "2026-10-06" });
  const later = task({ id: "c", workflowId: "todo", enteredOn: "2026-10-04", deadline: "2026-10-20" });
  const done = task({ id: "d", workflowId: "done", enteredOn: "2026-10-01", deadline: "2026-10-01" });
  assert.equal(deadlineState(overdue, "Todo", today)?.kind, "overdue");
  assert.equal(deadlineState(soon, "Todo", today)?.label, "Due in 2d");
  assert.equal(deadlineState(later, "Todo", today)?.kind, "ok");
  assert.equal(deadlineState(done, "Done", today), null);
});

test("stuck depends on the workflow alert and the entered date", () => {
  const quiet = defaultWorkflows().find((workflow) => workflow.id === "done")!;
  const noisy = defaultWorkflows().find((workflow) => workflow.id === "todo")!;
  const sitting = task({ id: "a", workflowId: "todo", enteredOn: "2026-09-27" });
  const fresh = task({ id: "b", workflowId: "todo", enteredOn: "2026-10-01" });
  assert.equal(ageDays(sitting.enteredOn, today), 7);
  assert.equal(isStuck(sitting, noisy, today), true);
  assert.equal(isStuck(fresh, noisy, today), false);
  assert.equal(isStuck(sitting, quiet, today), false);
});

test("the first task is the one under the most pressure", () => {
  const data = board([
    task({ id: "old", workflowId: "hold", enteredOn: "2026-09-01" }),
    task({ id: "late", workflowId: "todo", enteredOn: "2026-10-04", deadline: "2026-10-01" }),
  ]);
  assert.equal(priorityTask(data, today)?.id, "late");
  assert.equal(longestStuck(data, today)?.id, "old");
  assert.equal(boardCounts(data, today).critical, 1);
});

test("templates, tags, and links stay strict", () => {
  assert.equal(fillTemplate("Hi {{name}}, {{missing}}", { name: "Aamod" }), "Hi Aamod, ");
  assert.deepEqual(parseTags(" Design, design, email "), ["Design", "email"]);
  assert.equal(httpUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(httpUrl("javascript:alert(1)"), null);
});
