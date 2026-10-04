"use client";

import { ageDays, boardCounts, deadlineState, longestStuck, todayIso, workflowById } from "@/lib/domain";
import { dailyMessage, reminderMessage } from "@/lib/mail-preview";
import type { BoardData } from "@/lib/types";

export function Updates({ data }: { data: BoardData }) {
  const today = todayIso();
  const daily = dailyMessage(data, today);
  const stuck = longestStuck(data, today);
  const reminder = stuck ? reminderMessage(data, stuck, today) : null;
  const counts = boardCounts(data, today);
  return (
    <div className="page mail-stack">
      <article className="letter">
        <div className="letter-top">
          <div className="kicker">Morning email · 08:00</div>
          <p className="muted" style={{ marginTop: 8 }}>{daily.subject}</p>
          <h2>{daily.headline}</h2>
          <p>{daily.intro}</p>
        </div>
        {daily.first ? (
          <div className="focus">
            <div className="kicker">Do this first</div>
            <h3>{daily.first.title}</h3>
            <p className="meta">{workflowById(data.workflows, daily.first.workflowId)?.name} · {ageDays(daily.first.enteredOn, today)} days here{deadlineState(daily.first, workflowById(data.workflows, daily.first.workflowId)?.name ?? "", today) ? ` · ${deadlineState(daily.first, workflowById(data.workflows, daily.first.workflowId)?.name ?? "", today)?.label}` : ""}</p>
          </div>
        ) : null}
        <div className="letter-body">
          {daily.rest.map((task) => (
            <div className="list-item" key={task.id}>
              <span>{task.title}</span>
              <span className="muted">{workflowById(data.workflows, task.workflowId)?.name}</span>
            </div>
          ))}
          <p style={{ marginTop: 16 }}>{daily.signoff}</p>
          <p className="fine">{counts.open} open · {counts.critical} near a deadline · {counts.stuck} still for 7 days</p>
        </div>
      </article>
      <article className="letter">
        <div className="letter-top">
          <div className="kicker">Reminder · a workflow has not moved</div>
          {reminder ? (
            <>
              <p className="muted" style={{ marginTop: 8 }}>{reminder.subject}</p>
              <h2>{reminder.headline}</h2>
              <p>{reminder.intro}</p>
            </>
          ) : <h2>Nothing has sat for 7 days.</h2>}
        </div>
        {stuck && reminder ? (
          <div className="focus">
            <div className="days">{reminder.days}</div>
            <p className="meta">days in {reminder.workflow}</p>
            <h3>{reminder.title}</h3>
          </div>
        ) : null}
        {reminder ? <div className="letter-body"><p>{reminder.signoff}</p></div> : <div className="letter-body"><p className="muted">This letter stays quiet until a task sits in an alerting workflow for 7 days.</p></div>}
      </article>
      <p className="fine">These words are edited under Workflows. The 08:00 Asia/Kolkata send uses the same letter. Mail on your iPhone is how it reaches the phone.</p>
    </div>
  );
}
