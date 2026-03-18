export interface DashboardSummary {
  totalProjects: number;
  totalInitiatives: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
}

export interface DashboardPartner {
  id: string;
  name: string;
  activeTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  examples: string[];
}

export interface DashboardTask {
  id: string;
  title: string;
  assignee: string;
  status: string;
  dueDate: string;
  overdue: boolean;
  dueSoon: boolean;
  contextId: string;
  contextTitle: string;
  contextType: "projeto" | "iniciativa";
}

export interface DashboardCard {
  id: string;
  title: string;
  type: "projeto" | "iniciativa";
  client: string;
  owner: string;
  column: string;
  healthStatus: string;
  tags: string[];
  progress: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
}

export interface DashboardMilestone {
  id: string;
  title: string;
  description: string;
  date: string;
  type: string;
  contextTitle: string;
  responsible: string;
}

export interface DashboardPayload {
  organization: {
    name: string;
    members: string[];
  };
  generatedAt: string;
  summary: DashboardSummary;
  partners: DashboardPartner[];
  tasks: DashboardTask[];
  cards: DashboardCard[];
  milestones: DashboardMilestone[];
}

export interface TaskUpdateInput {
  title?: string;
  assignee?: string;
  status?: string;
  dueDate?: string;
  contextId?: string;
  contextType?: "projeto" | "iniciativa";
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const response = await fetch("/api/dashboard");
  if (!response.ok) {
    throw new Error("Falha ao carregar o dashboard.");
  }

  return response.json() as Promise<DashboardPayload>;
}

export async function updateDashboardTask(taskId: string, updates: TaskUpdateInput): Promise<{
  message: string;
  task: DashboardTask | null;
  payload: DashboardPayload;
}> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorPayload?.message || "Falha ao atualizar a tarefa.");
  }

  return response.json() as Promise<{
    message: string;
    task: DashboardTask | null;
    payload: DashboardPayload;
  }>;
}
