"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, moveTask } from "@/lib/actions";
import type { BoardData } from "@/lib/types";
import { Board } from "./board";
import { Dashboard } from "./dashboard";
import { Composer, TaskDrawer } from "./task-panel";
import { Updates } from "./updates";
import { Workflows } from "./workflows";

const LINKS = [
  { href: "/", label: "Board", view: "board" },
  { href: "/dashboard", label: "Dashboard", view: "dashboard" },
  { href: "/updates", label: "Updates", view: "updates" },
  { href: "/admin", label: "Admin", view: "admin", adminOnly: true },
] as const;

export type AppView = (typeof LINKS)[number]["view"];

export function AppFrame({ data, view, admin }: { data: BoardData; view: AppView; admin: boolean }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [filter, setFilter] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const tags = [...new Set(data.tasks.flatMap((task) => task.tags))].sort();
  const visible = data.tasks.filter((task) => filter.every((tag) => task.tags.includes(tag)));
  const openTask = data.tasks.find((task) => task.id === openId) ?? null;
  const links = LINKS.filter((link) => !("adminOnly" in link && link.adminOnly) || admin);
  const title = links.find((link) => link.view === view)?.label ?? "Board";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenId(null);
        setComposer(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">Aamod<small>Personal Todo</small></div>
        <nav className="nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={view === link.view ? "active" : ""}>{link.label}</Link>
          ))}
        </nav>
        <div>
          <h3>Tags</h3>
          <div className="nav">
            {tags.map((tag) => (
              <button key={tag} type="button" className={filter.includes(tag) ? "tag-btn on" : "tag-btn"} onClick={() => setFilter((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{tag}</button>
            ))}
          </div>
        </div>
        <div className="rail-foot">Tasks cannot be deleted. Move them to Archived.</div>
      </aside>
      <main className="stage">
        <header className="top">
          <h1>{title}</h1>
          <nav className="mobile-nav">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={view === link.view ? "active" : ""}>{link.label}</Link>
            ))}
          </nav>
          <div className="sub">{view === "board" ? (filter.length ? `Filtered by ${filter.join(", ")}` : "All tasks") : ""}</div>
          <button className="btn small" type="button" onClick={() => setComposer(true)}>New task</button>
          <form action={logout}><button className="btn ghost small" type="submit">Sign out</button></form>
        </header>
        {view === "board" ? (
          <Board
            data={data}
            tasks={visible}
            onOpen={setOpenId}
            onMove={(taskId, workflowId) => {
              void moveTask(taskId, workflowId).then(() => router.refresh());
            }}
          />
        ) : null}
        {view === "dashboard" ? <Dashboard data={data} onOpen={setOpenId} /> : null}
        {view === "updates" ? <Updates data={data} /> : null}
        {view === "admin" ? <Workflows data={data} onToast={setToast} /> : null}
      </main>
      {openTask ? <TaskDrawer data={data} task={openTask} onClose={() => setOpenId(null)} onNotice={(message) => { setToast(message); router.refresh(); }} /> : null}
      {composer ? <Composer data={data} onClose={() => { setComposer(false); router.refresh(); }} onNotice={setToast} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
