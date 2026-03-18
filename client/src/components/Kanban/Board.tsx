import { useMemo, useState } from "react";

import { KanbanColumn } from "@/components/Kanban/Column";
import type { DashboardTask } from "@/services/dashboardService";
import { KANBAN_COLUMNS } from "@/types/kanban";

interface KanbanBoardProps {
  tasks: DashboardTask[];
  onEditTask: (task: DashboardTask) => void;
  onCreateTask: (status: DashboardTask["status"]) => void;
  onMoveTask: (task: DashboardTask, status: DashboardTask["status"]) => void;
}

export function KanbanBoard({ tasks, onEditTask, onCreateTask, onMoveTask }: KanbanBoardProps) {
  const [draggingTask, setDraggingTask] = useState<DashboardTask | null>(null);

  const columns = useMemo(
    () =>
      KANBAN_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.id),
      })),
    [tasks],
  );

  function handleDrop(status: DashboardTask["status"]) {
    if (!draggingTask) return;
    if (draggingTask.status !== status) {
      onMoveTask(draggingTask, status);
    }
    setDraggingTask(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Kanban da bancada</h2>
          <p className="mt-1 text-sm text-slate-400">
            Arraste entre colunas para mudar o status ou crie novas tarefas direto da sala de controle.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={column.tasks}
            draggingTaskId={draggingTask?.id || null}
            onDropTask={handleDrop}
            onCreateTask={onCreateTask}
            onEditTask={onEditTask}
            onDragTask={setDraggingTask}
          />
        ))}
      </div>
    </div>
  );
}
