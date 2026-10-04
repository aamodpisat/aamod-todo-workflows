import { ageDays, workflowById } from "./domain";
import { dailyMessage, reminderMessage } from "./mail-preview";
import type { BoardData, Task } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function dailyHtml(board: BoardData, today: string): { subject: string; html: string } {
  const message = dailyMessage(board, today);
  const first = message.first
    ? `<div style="margin:20px 0;padding:18px;border-radius:14px;background:#141414;color:#fff">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.62)">Do this first</div>
        <h2 style="margin:8px 0;font-size:22px">${escapeHtml(message.first.title)}</h2>
        <p style="margin:0;color:rgba(255,255,255,.72)">${escapeHtml(workflowById(board.workflows, message.first.workflowId)?.name ?? "")} · ${ageDays(message.first.enteredOn, today)} days here</p>
      </div>`
    : "";
  const rest = message.rest
    .map((task) => `<p style="margin:0;padding:10px 0;border-top:1px solid #ececec">${escapeHtml(task.title)}</p>`)
    .join("");
  return {
    subject: message.subject,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#141414;max-width:560px">
      <p style="color:#8a8a8a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Morning email</p>
      <h1 style="font-size:32px;line-height:1.05;letter-spacing:-.04em">${escapeHtml(message.headline)}</h1>
      <p>${escapeHtml(message.intro)}</p>
      ${first}
      ${rest}
      <p><strong>${escapeHtml(message.signoff)}</strong></p>
      <p style="color:#8a8a8a">${message.counts.open} open · ${message.counts.critical} near a deadline · ${message.counts.stuck} still for 7 days</p>
    </div>`,
  };
}

export function reminderHtml(board: BoardData, task: Task, today: string): { subject: string; html: string } {
  const message = reminderMessage(board, task, today);
  return {
    subject: message.subject,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#141414;max-width:560px">
      <p style="color:#8a8a8a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Still waiting</p>
      <h1 style="font-size:32px;line-height:1.05;letter-spacing:-.04em">${escapeHtml(message.headline)}</h1>
      <p>${escapeHtml(message.intro)}</p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#141414;color:#fff">
        <div style="font-size:42px;letter-spacing:-.05em">${message.days}</div>
        <p style="margin:4px 0 10px;color:rgba(255,255,255,.72)">days in ${escapeHtml(message.workflow)}</p>
        <h2 style="margin:0;font-size:22px">${escapeHtml(message.title)}</h2>
      </div>
      <p><strong>${escapeHtml(message.signoff)}</strong></p>
    </div>`,
  };
}

export async function deliver(subject: string, html: string, to = process.env.OPERATOR_EMAIL): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from || !to) return { sent: false, reason: "Mail is not configured yet." };
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) return { sent: false, reason: "The mail service rejected this letter." };
  return { sent: true };
}
