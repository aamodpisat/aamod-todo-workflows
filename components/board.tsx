"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ageDays, deadlineState, isStuck, workflowById } from "@/lib/domain";
import type { BoardData, Task } from "@/lib/types";

export function Board({
  data,
  tasks,
  onOpen,
  onMove,
}: {
  data: BoardData;
  tasks: Task[];
  onOpen: (id: string) => void;
  onMove: (taskId: string, workflowId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const workflowId = event.over ? String(event.over.id) : "";
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task || !workflowId || task.workflowId === workflowId) return;
    onMove(taskId, workflowId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board">
        {data.workflows
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((workflow) => (
            <Column key={workflow.id} id={workflow.id} name={workflow.name} alert={workflow.alert} count={tasks.filter((task) => task.workflowId === workflow.id).length}>
              {tasks.filter((task) => task.workflowId === workflow.id).map((task) => (
                <Card key={task.id} task={task} workflow={workflow} onOpen={() => onOpen(task.id)} />
              ))}
            </Column>
          ))}
      </div>
    </DndContext>
  );
}

function toneClass(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "in progress") return " tone-progress";
  if (key === "in review") return " tone-review";
  if (key === "on hold") return " tone-hold";
  if (key === "done" || key === "archived") return " tone-done";
  return "";
}

function Column({ id, name, alert, count, children }: { id: string; name: string; alert: boolean; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={isOver ? "column over" : "column"}>
      <div className="col-head">
        <strong>{name}</strong>
        <em>{count}{alert ? " · alerts" : ""}</em>
      </div>
      {count === 0 ? <div className="empty-col">Drop a task here</div> : children}
    </section>
  );
}

function Card({ task, workflow, onOpen }: { task: Task; workflow: BoardData["workflows"][number]; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const flag = deadlineState(task, workflow.name);
  const hot = Boolean(flag && flag.kind !== "ok");
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card${toneClass(workflow.name)}${hot ? " critical" : ""}${isDragging ? " dragging" : ""}`}
      {...listeners}
      {...attributes}
      onClick={onOpen}
    >
      <h2>{task.title}</h2>
      <div className="chips">
        {task.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
        {hot && flag ? <span className="chip hot">{flag.label}</span> : null}
        {isStuck(task, workflow) ? <span className="chip still">Still {ageDays(task.enteredOn)}d</span> : null}
      </div>
      <div className="card-meta">
        <span>{ageDays(task.enteredOn)}d here</span>
        <span>{!hot && task.deadline ? task.deadline : ""}</span>
      </div>
    </article>
  );
}

export function workflowName(data: BoardData, id: string): string {
  return workflowById(data.workflows, id)?.name ?? "";
}
