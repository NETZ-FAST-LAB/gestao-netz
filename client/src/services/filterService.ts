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

export function canonicalizeAssigneeLabel(assignee: string) {
  const normalized = normalize(assignee);

  if (!normalized || normalized === "sem dono" || normalized === "antigravity") {
    return "Sem dono";
  }

  if (
    [
      "joao",
      "joaozissimo",
      "joao henrique",
      "joao henrique zborowski scholz",
      "joao scholz",
      "joe",
      "john",
    ].includes(normalized)
  ) {
    return "Joãozíssimo";
  }

  if (["gui", "gui r", "gui r.", "roennau", "guilherme roennau", "guilherme r"].includes(normalized)) {
    return "Gui R.";
  }

  if (["denis", "denis polidoro", "denis p", "denis p.", "denis polidoro netz", "denis polidoro."].includes(normalized)) {
    return "Dênis Polidoro";
  }

  if (["gui stacke", "guilherme stacke", "guilherme stack", "gui s", "tak", "stacke"].includes(normalized)) {
    return "tak";
  }

  return assignee.trim();
}

export function getTaskAssigneeOptions(tasks: DashboardTask[]) {
  const uniqueAssignees = Array.from(
    new Set(tasks.map((task) => canonicalizeAssigneeLabel(task.assignee)).filter((assignee) => assignee !== "Sem dono")),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return ["todos", ...uniqueAssignees];
}

export function applyKanbanFilters(tasks: DashboardTask[], filters: KanbanFilterQuery) {
  const normalizedSearch = normalize(filters.search);

  return tasks.filter((task) => {
    const canonicalAssignee = canonicalizeAssigneeLabel(task.assignee);

    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }

    if (filters.assignee !== "todos" && canonicalAssignee !== filters.assignee) {
      return false;
    }

    if (filters.contextType !== "todos" && task.contextType !== filters.contextType) {
      return false;
    }

    if (filters.onlyCritical && !(task.overdue || task.dueSoon)) {
      return false;
    }

    if (filters.onlyUnassigned && canonicalAssignee !== "Sem dono") {
      return false;
    }

    if (normalizedSearch) {
      const haystack = normalize(`${task.title} ${task.contextTitle} ${canonicalAssignee}`);
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}
