import type { DashboardTask } from "@/services/dashboardService";

export type KanbanStatus = DashboardTask["status"];

export interface KanbanColumnDefinition {
  id: KanbanStatus;
  title: string;
  description: string;
  accentClass: string;
  emptyState: string;
}

export const KANBAN_COLUMNS: KanbanColumnDefinition[] = [
  {
    id: "Pendente",
    title: "Planejamento",
    description: "Hipoteses, backlog e preparacao de experimento.",
    accentClass: "from-slate-500/35 to-slate-700/10 border-slate-300/15",
    emptyState: "Nenhuma formula esperando desenho.",
  },
  {
    id: "Em andamento",
    title: "Em andamento",
    description: "Experimentos ativos na bancada.",
    accentClass: "from-cyan-400/30 to-cyan-950/10 border-cyan-300/15",
    emptyState: "Nenhum reagente borbulhando agora.",
  },
  {
    id: "Em revisao",
    title: "Em revisão",
    description: "Checagem, lapidacao e controle de qualidade.",
    accentClass: "from-amber-400/30 to-amber-950/10 border-amber-300/15",
    emptyState: "Nada em revisao critica neste momento.",
  },
  {
    id: "Concluida",
    title: "Concluídas",
    description: "Entregas que ja sairam da bancada.",
    accentClass: "from-emerald-400/30 to-emerald-950/10 border-emerald-300/15",
    emptyState: "Ainda sem experimentos finalizados aqui.",
  },
];

export function groupTasksByStatus(tasks: DashboardTask[]) {
  return KANBAN_COLUMNS.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.id),
  }));
}
