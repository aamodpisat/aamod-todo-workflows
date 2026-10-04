"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addWorkflow, moveWorkflow, removeWorkflow, renameWorkflow, saveEmailField, setWorkflowAlert } from "@/lib/actions";
import type { BoardData, EmailKind } from "@/lib/types";

export function Workflows({ data, onToast }: { data: BoardData; onToast: (message: string) => void }) {
  const [error, setError] = useState("");
  const router = useRouter();
  const ordered = data.workflows.slice().sort((a, b) => a.position - b.position);

  return (
    <div className="page admin-page">
      <section className="panel">
        <h2>Workflows</h2>
        <p className="caption">This page opens with the admin key. A workflow with tasks cannot be removed. Tasks cannot be deleted.</p>
        {ordered.map((workflow, index) => (
          <div className="wf-row" key={workflow.id}>
            <input
              defaultValue={workflow.name}
              onBlur={(event) => {
                if (event.target.value.trim() && event.target.value.trim() !== workflow.name) {
                  void renameWorkflow(workflow.id, event.target.value).then(() => router.refresh());
                }
              }}
            />
            <div className="wf-actions">
              <label className="check">
                <input
                  type="checkbox"
                  checked={workflow.alert}
                  onChange={(event) => void setWorkflowAlert(workflow.id, event.target.checked).then(() => router.refresh())}
                />
                7-day alert
              </label>
              <button className="btn ghost small" type="button" disabled={index === 0} onClick={() => void moveWorkflow(workflow.id, -1).then(() => router.refresh())}>Up</button>
              <button
                className="btn ghost small"
                type="button"
                onClick={async () => {
                  const result = await removeWorkflow(workflow.id);
                  if (!result.ok) setError(result.error);
                  else {
                    setError("");
                    router.refresh();
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <p className="error">{error}</p>
        <form
          className="inline"
          action={async (formData) => {
            const result = await addWorkflow(String(formData.get("name") ?? ""));
            if (!result.ok) setError(result.error);
            else {
              setError("");
              router.refresh();
            }
          }}
        >
          <input name="name" type="text" placeholder="New workflow name" />
          <button className="btn small" type="submit">Add</button>
        </form>
      </section>
      <TemplateEditor kind="daily" title="Morning email" caption="Sent every day at 08:00 Asia/Kolkata. Placeholders: {{name}} {{urgent}} {{open}} {{stuck}}." template={data.emails.daily} onToast={onToast} />
      <TemplateEditor kind="reminder" title="Stuck reminder" caption="Sent when a task stays 7 days in a workflow whose alert is on. Placeholders: {{name}} {{task}} {{workflow}} {{days}}." template={data.emails.reminder} onToast={onToast} />
    </div>
  );
}

function TemplateEditor({
  kind,
  title,
  caption,
  template,
  onToast,
}: {
  kind: EmailKind;
  title: string;
  caption: string;
  template: BoardData["emails"]["daily"];
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  async function save(field: "subject" | "headline" | "intro" | "signoff", value: string) {
    if (value === template[field]) return;
    const result = await saveEmailField(kind, field, value);
    if (!result.ok) onToast(result.error);
    else router.refresh();
  }
  return (
    <section className="panel tpl">
      <h2>{title}</h2>
      <p className="caption">{caption}</p>
      <label>Subject</label>
      <input defaultValue={template.subject} onBlur={(event) => void save("subject", event.target.value)} />
      <label>Headline</label>
      <input defaultValue={template.headline} onBlur={(event) => void save("headline", event.target.value)} />
      <label>Opening</label>
      <textarea defaultValue={template.intro} onBlur={(event) => void save("intro", event.target.value)} />
      <label>Closing line</label>
      <input defaultValue={template.signoff} onBlur={(event) => void save("signoff", event.target.value)} />
    </section>
  );
}
