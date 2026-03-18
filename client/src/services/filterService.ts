import type { DashboardTask } from "@/services/dashboardService";

export interface KanbanFilterQuery {
  search: string;
  statuses: string[];
  assignee: string;
  contextType: "todos" | "projeto" | "iniciativa";
  onlyCritical: boolean;
  onlyUnassigned: boolean;
}

export const DEFAULT_KANBAN_FILTERS: KanbanFilterQuery = {
  search: "",
  statuses: [],
  assignee: "todos",
  contextType: "todos",
  onlyCritical: false,
  onlyUnassigned: false,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getTaskAssigneeOptions(tasks: DashboardTask[]) {
  const uniqueAssignees = Array.from(new Set(tasks.map((task) => task.assignee))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return ["todos", ...uniqueAssignees];
}

export function applyKanbanFilters(tasks: DashboardTask[], filters: KanbanFilterQuery) {
  const normalizedSearch = normalize(filters.search);

  return tasks.filter((task) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }

    if (filters.assignee !== "todos" && task.assignee !== filters.assignee) {
      return false;
    }

    if (filters.contextType !== "todos" && task.contextType !== filters.contextType) {
      return false;
    }

    if (filters.onlyCritical && !(task.overdue || task.dueSoon)) {
      return false;
    }

    if (filters.onlyUnassigned && task.assignee !== "Sem dono") {
      return false;
    }

    if (normalizedSearch) {
      const haystack = normalize(`${task.title} ${task.contextTitle} ${task.assignee}`);
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}
