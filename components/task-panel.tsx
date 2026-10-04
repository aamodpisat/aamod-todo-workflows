"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addComment, addLink, addPerson, moveTask, saveTask } from "@/lib/actions";
import { ageDays, deadlineState, inboxWorkflow, workflowById } from "@/lib/domain";
import type { BoardData, Task } from "@/lib/types";

export function TaskDrawer({
  data,
  task,
  onClose,
  onNotice,
}: {
  data: BoardData;
  task: Task;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const workflow = workflowById(data.workflows, task.workflowId);
  const flag = deadlineState(task, workflow?.name ?? "");
  const router = useRouter();
  function changed(message?: string) {
    if (message) onNotice(message);
    router.refresh();
  }
  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer">
        <div className="drawer-top">
          <div className="kicker">{workflow?.name} · {ageDays(task.enteredOn)} days here</div>
          <button className="btn ghost small" type="button" onClick={onClose}>Close</button>
        </div>
        <h2>{task.title}</h2>
        {flag && flag.kind !== "ok" ? <p className="chip hot" style={{ display: "inline-block", marginBottom: 12 }}>{flag.label}</p> : null}
        <label>Move workflow</label>
        <select
          value={task.workflowId}
          onChange={(event) => void moveTask(task.id, event.target.value).then(() => changed())}
        >
          {data.workflows.slice().sort((a, b) => a.position - b.position).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <label>Description</label>
        <textarea defaultValue={task.description} onBlur={(event) => void saveTask(task.id, { description: event.target.value }).then(() => router.refresh())} />
        <div className="field-row">
          <div>
            <label>Deadline, optional</label>
            <input type="date" defaultValue={task.deadline ?? ""} onChange={(event) => void saveTask(task.id, { deadline: event.target.value }).then(() => changed())} />
          </div>
          <div>
            <label>Tags</label>
            <input type="text" defaultValue={task.tags.join(", ")} onBlur={(event) => void saveTask(task.id, { tags: event.target.value }).then(() => router.refresh())} />
          </div>
        </div>
        <label>Links</label>
        {task.links.length ? task.links.map((link) => (
          <div className="link-row" key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a><br /><small>{link.url}</small></div>
        )) : <p className="muted">No links yet.</p>}
        <form className="inline" action={async (formData) => {
          const result = await addLink(task.id, String(formData.get("label") ?? ""), String(formData.get("url") ?? ""));
          if (!result.ok) onNotice(result.error);
          else changed();
        }}>
          <input name="label" type="text" placeholder="Label" />
          <input name="url" type="url" placeholder="https://" />
          <button className="btn small" type="submit">Add</button>
        </form>
        <label style={{ marginTop: 14 }}>Notify by email</label>
        {task.people.length ? task.people.map((person) => <div className="person" key={person}>{person}</div>) : <p className="muted">No one tagged.</p>}
        <form className="inline" action={async (formData) => {
          const result = await addPerson(task.id, String(formData.get("email") ?? ""));
          if (result.ok) changed(result.notice ?? "Tagged");
          else onNotice(result.error);
        }}>
          <input name="email" type="email" placeholder="name@example.com" />
          <button className="btn small" type="submit">Tag</button>
        </form>
        <label style={{ marginTop: 14 }}>Comments</label>
        {task.comments.length ? task.comments.map((comment) => (
          <div className="comment" key={comment.id}>{comment.body}<br /><small>{comment.createdOn}</small></div>
        )) : <p className="muted">No comments yet.</p>}
        <form action={async (formData) => {
          const result = await addComment(task.id, String(formData.get("text") ?? ""));
          if (result.ok) changed(result.notice ?? "Comment saved");
          else onNotice(result.error);
        }}>
          <textarea name="text" placeholder="Write an update" />
          <button className="btn small" type="submit">Add comment</button>
        </form>
      </aside>
    </div>
  );
}

export function Composer({ data, onClose, onNotice }: { data: BoardData; onClose: () => void; onNotice: (message: string) => void }) {
  const [error, setError] = useState("");
  const start = inboxWorkflow(data.workflows);
  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-wrap">
        <form
          className="modal"
          action={async (formData) => {
            const { createTask } = await import("@/lib/actions");
            const result = await createTask({
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              deadline: String(formData.get("deadline") ?? ""),
              tags: String(formData.get("tags") ?? ""),
            });
            if (!result.ok) setError(result.error);
            else {
              onNotice(result.notice ?? "Task created");
              onClose();
            }
          }}
        >
          <div className="modal-top">
            <div className="kicker">New task</div>
            <button className="btn ghost small" type="button" onClick={onClose}>Close</button>
          </div>
          <h2>What needs doing?</h2>
          <p className="hint" style={{ marginBottom: 14 }}>It starts in {start?.name ?? "Todo"}. Move it after it exists.</p>
          <label>Title</label>
          <input name="title" type="text" required />
          <label>Description</label>
          <textarea name="description" />
          <label>Deadline, optional</label>
          <input name="deadline" type="date" />
          <label>Tags, comma separated</label>
          <input name="tags" type="text" placeholder="design, email" />
          <p className="error">{error}</p>
          <button className="btn" type="submit">Create task</button>
        </form>
      </div>
    </div>
  );
}
