"use client";

import { ageDays, boardCounts, deadlineState, isCritical, isStuck, openTasks, priorityTask, workflowById } from "@/lib/domain";
import type { BoardData, Task } from "@/lib/types";

const INK = ["#141414", "#3f3f3f", "#6e6e6e", "#9a9a9a", "#c6c6c6", "#e4e4e4"];

export function Dashboard({ data, onOpen }: { data: BoardData; onOpen: (id: string) => void }) {
  const counts = boardCounts(data);
  const first = priorityTask(data);
  const flag = first ? deadlineState(first, workflowById(data.workflows, first.workflowId)?.name ?? "") : null;
  const open = openTasks(data);
  const byWorkflow = data.workflows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((workflow) => ({ label: workflow.name, value: data.tasks.filter((task) => task.workflowId === workflow.id).length }));
  const ages = [
    { label: "0–2 days", value: open.filter((task) => ageDays(task.enteredOn) <= 2).length },
    { label: "3–6 days", value: open.filter((task) => ageDays(task.enteredOn) >= 3 && ageDays(task.enteredOn) <= 6).length },
    { label: "7 days+", value: open.filter((task) => ageDays(task.enteredOn) >= 7).length, warn: true },
  ];
  const deadlines = [
    { label: "Overdue", value: open.filter((task) => deadlineState(task, nameOf(data, task))?.kind === "overdue").length, warn: true },
    { label: "Due in 48h", value: open.filter((task) => deadlineState(task, nameOf(data, task))?.kind === "soon").length, warn: true },
    { label: "Later", value: open.filter((task) => deadlineState(task, nameOf(data, task))?.kind === "ok").length },
    { label: "No deadline", value: open.filter((task) => !task.deadline).length },
  ];

  return (
    <div className="page">
      {first ? (
        <section className="hero">
          <div>
            <div className="kicker">Do this first</div>
            <h2>{first.title}</h2>
            <p className="muted">{nameOf(data, first)} · {ageDays(first.enteredOn)} days here{flag ? ` · ${flag.label}` : ""}</p>
          </div>
          <button className="btn small" type="button" onClick={() => onOpen(first.id)}>Open task</button>
        </section>
      ) : null}
      <div className="stats">
        <div className="stat"><b>{counts.open}</b><span>Open tasks</span></div>
        <div className="stat hot"><b>{counts.critical}</b><span>Overdue or due within 48 hours</span></div>
        <div className="stat"><b>{counts.stuck}</b><span>Still 7 days or more</span></div>
        <div className="stat"><b>{counts.done}</b><span>Done or archived</span></div>
      </div>
      <div className="charts">
        <section className="panel">
          <h2>Tasks by workflow</h2>
          <p className="caption">How the current board is split.</p>
          <Donut parts={byWorkflow} />
        </section>
        <section className="panel">
          <h2>How long open tasks have sat</h2>
          <p className="caption">Days in the current workflow. 7 days or more is the reminder line.</p>
          <Bars rows={ages} />
        </section>
        <section className="panel span-2">
          <h2>Deadlines on open tasks</h2>
          <p className="caption">Overdue and due within 48 hours carry the red mark on the board.</p>
          <Bars rows={deadlines} />
        </section>
      </div>
    </div>
  );
}

function nameOf(data: BoardData, task: Task): string {
  return workflowById(data.workflows, task.workflowId)?.name ?? "";
}

function Donut({ parts }: { parts: Array<{ label: string; value: number }> }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const rings = parts.map((part, index) => {
    const length = total === 0 ? 0 : (part.value / total) * circumference;
    const circle = (
      <circle key={part.label} cx="60" cy="60" r={radius} fill="none" stroke={INK[index % INK.length]} strokeWidth="14" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
    );
    offset += length;
    return circle;
  });
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" width="148" height="148" aria-label="Tasks by workflow">
        <g transform="rotate(-90 60 60)">{rings}</g>
        <text x="60" y="56" textAnchor="middle" fontSize="22" fill="#141414">{total}</text>
        <text x="60" y="74" textAnchor="middle" fontSize="10" fill="#8a8a8a">tasks</text>
      </svg>
      <div className="legend">
        {parts.map((part, index) => (
          <div key={part.label}><i style={{ background: INK[index % INK.length] }} />{part.label} · {part.value}</div>
        ))}
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: Array<{ label: string; value: number; warn?: boolean }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div className="bar"><i className={row.warn && row.value ? "warn" : ""} style={{ width: `${Math.round((row.value / max) * 100)}%` }} /></div>
          <span>{row.value}</span>
        </div>
      ))}
    </>
  );
}

export function needsAttention(data: BoardData): boolean {
  return openTasks(data).some((task) => isCritical(task, nameOf(data, task)) || isStuck(task, workflowById(data.workflows, task.workflowId)));
}
