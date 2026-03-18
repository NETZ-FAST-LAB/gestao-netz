import { Plus } from "lucide-react";

import { KanbanCard } from "@/components/Kanban/Card";
import { Button } from "@/components/ui/button";
import type { DashboardTask } from "@/services/dashboardService";
import type { KanbanColumnDefinition } from "@/types/kanban";

interface KanbanColumnProps {
  column: KanbanColumnDefinition;
  tasks: DashboardTask[];
  draggingTaskId: string | null;
  onDropTask: (status: KanbanColumnDefinition["id"]) => void;
  onCreateTask: (status: KanbanColumnDefinition["id"]) => void;
  onEditTask: (task: DashboardTask) => void;
  onDragTask: (task: DashboardTask) => void;
}

export function KanbanColumn({
  column,
  tasks,
  draggingTaskId,
  onDropTask,
  onCreateTask,
  onEditTask,
  onDragTask,
}: KanbanColumnProps) {
  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropTask(column.id)}
      className={`flex min-h-[34rem] min-w-[19rem] flex-1 flex-col rounded-3xl border bg-gradient-to-b ${column.accentClass} p-4 backdrop-blur-xl`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{column.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{column.description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
          {tasks.length}
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
        onClick={() => onCreateTask(column.id)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nova tarefa
      </Button>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <KanbanCard
              key={`${task.contextId}-${task.id}`}
              task={task}
              onEditTask={onEditTask}
              onDragStart={onDragTask}
              isDragging={draggingTaskId === task.id}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-5 py-8 text-center text-sm text-slate-500">
            {column.emptyState}
          </div>
        )}
      </div>
    </section>
  );
}
