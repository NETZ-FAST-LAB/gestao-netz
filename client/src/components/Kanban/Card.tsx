import { CalendarClock, Pencil, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardTask } from "@/services/dashboardService";
import { canonicalizeAssigneeLabel } from "@/services/filterService";

interface KanbanCardProps {
  task: DashboardTask;
  onEditTask: (task: DashboardTask) => void;
  onDragStart: (task: DashboardTask) => void;
  isDragging?: boolean;
}

function formatDate(date: string) {
  if (!date) return "Sem prazo";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export function KanbanCard({ task, onEditTask, onDragStart, isDragging = false }: KanbanCardProps) {
  return (
    <article
      draggable
      onDragStart={() => onDragStart(task)}
      className={`rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition ${
        isDragging ? "opacity-50" : "hover:border-cyan-300/25 hover:bg-slate-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium leading-6 text-white">{task.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {task.contextType === "projeto" ? "Projeto" : "Experimento interno"} | {task.contextTitle}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => onEditTask(task)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={task.overdue ? "destructive" : task.dueSoon ? "secondary" : "outline"}>{task.status}</Badge>
        {task.overdue && <Badge variant="destructive">Risco de explosão</Badge>}
      </div>

      <div className="mt-4 space-y-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5 text-slate-500" />
          <span>{canonicalizeAssigneeLabel(task.assignee)}</span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
          <span>{formatDate(task.dueDate)}</span>
        </div>
      </div>
    </article>
  );
}
