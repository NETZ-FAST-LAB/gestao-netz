import express from "express";
import { createServer } from "http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");

type RawTask = {
  id?: string;
  title?: string;
  assignee?: string;
  responsavel?: string;
  status?: string;
  dueDate?: string;
};

type RawCard = {
  id?: string;
  title?: string;
  client?: string;
  owner?: string;
  column?: string;
  health_status?: string;
  tags?: string[];
  tasks?: RawTask[];
  marcos_alinhamento?: Array<Record<string, string>>;
  lembretes_mintzie?: {
    checkpoints?: Array<Record<string, string>>;
    fechamento?: Record<string, string>;
    upsell?: Record<string, string>;
  };
};

type BoardFile = {
  boards?: Array<{
    cards?: RawCard[];
  }>;
};

type DashboardTask = {
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
};

type DashboardWorkload = {
  id: string;
  name: string;
  activeTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  examples: string[];
};

function repairText(value: string): string {
  if (!value) return value;
  if (!/[ÃÂâ€™â€œâ€\u00c2]/.test(value)) return value;

  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") {
    return repairText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeDeep(item)]),
    ) as T;
  }

  return value;
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const fullPath = path.join(APP_ROOT, relativePath);
  const content = await fs.readFile(fullPath, "utf8");
  return sanitizeDeep(JSON.parse(content)) as T;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getTaskAssignee(task: RawTask): string {
  return (task.assignee || task.responsavel || "").trim();
}

function mapStatus(status: string): string {
  const normalized = normalizeName(status);
  if (normalized === "completed" || normalized === "concluida" || normalized === "done") {
    return "Concluída";
  }
  if (normalized === "in_progress" || normalized === "em andamento" || normalized === "doing") {
    return "Em andamento";
  }
  if (normalized === "review" || normalized === "em revisao") {
    return "Em revisão";
  }
  return "Pendente";
}

function buildProgress(tasks: DashboardTask[], column: string): number {
  if (tasks.length === 0) {
    return normalizeName(column).includes("conclu") || normalizeName(column) === "done" ? 100 : 0;
  }

  const completed = tasks.filter((task) => task.status === "Concluída").length;
  return Math.round((completed / tasks.length) * 100);
}

function isWithinDays(dateString: string, today: Date, days: number): boolean {
  if (!dateString) return false;
  const dueDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;

  const diffMs = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
}

function isOverdue(dateString: string, today: Date): boolean {
  if (!dateString) return false;
  const dueDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate.getTime() < today.getTime();
}

function getPartnerId(assignee: string): string | null {
  const normalized = normalizeName(assignee);

  if (["joao", "joaozissimo"].includes(normalized)) return "joao";
  if (["gui", "gui r", "guilherme roennau", "guilherme r"].includes(normalized)) return "gui";
  if (["denis", "denis polidoro", "denis p", "dênis"].includes(normalized)) return "denis";
  if (["stacke", "guilherme stacke", "guilherme s"].includes(normalized)) return "stacke";

  return null;
}

async function buildDashboardPayload() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [organization, projectsFile, initiativesFile] = await Promise.all([
    readJsonFile<{ name: string; members: string[] }>("Operacional/organizacao.json"),
    readJsonFile<BoardFile>("Operacional/Kanban/projetos.json"),
    readJsonFile<BoardFile>("Operacional/Kanban/iniciativas.json"),
  ]);

  const cards = [
    ...(projectsFile.boards?.flatMap((board) =>
      (board.cards || []).map((card) => ({ ...card, contextType: "projeto" as const })),
    ) || []),
    ...(initiativesFile.boards?.flatMap((board) =>
      (board.cards || []).map((card) => ({ ...card, contextType: "iniciativa" as const })),
    ) || []),
  ];

  const tasks: DashboardTask[] = cards.flatMap((card) =>
    (card.tasks || []).map((task) => ({
      id: task.id || `${card.id}-task`,
      title: task.title || "Sem título",
      assignee: getTaskAssignee(task) || "Sem dono",
      status: mapStatus(task.status || ""),
      dueDate: task.dueDate || "",
      overdue: task.status !== "completed" && isOverdue(task.dueDate || "", today),
      dueSoon: task.status !== "completed" && isWithinDays(task.dueDate || "", today, 7),
      contextId: card.id || "sem-contexto",
      contextTitle: card.title || "Sem contexto",
      contextType: card.contextType,
    })),
  );

  const projectCards = cards.map((card) => {
    const cardTasks = tasks.filter((task) => task.contextId === (card.id || ""));
    const openTasks = cardTasks.filter((task) => task.status !== "Concluída").length;

    return {
      id: card.id || "sem-id",
      title: card.title || "Sem título",
      type: card.contextType,
      client: card.client || card.owner || "NETZ",
      owner: card.owner || card.client || "Equipe NETZ",
      column: card.column || "Backlog",
      healthStatus: card.health_status || "Sem status",
      tags: card.tags || [],
      progress: buildProgress(cardTasks, card.column || ""),
      totalTasks: cardTasks.length,
      openTasks,
      completedTasks: cardTasks.filter((task) => task.status === "Concluída").length,
    };
  });

  const milestones = cards.flatMap((card) => {
    const alignmentMilestones = (card.marcos_alinhamento || []).map((milestone) => ({
      id: milestone.id || `${card.id}-milestone`,
      title: milestone.titulo || "Marco",
      description: milestone.descricao || "",
      date: milestone.data || "",
      type: milestone.tipo || "marco",
      contextTitle: card.title || "Sem contexto",
      responsible: milestone.responsavel || "",
    }));

    const reminderMilestones = [
      ...((card.lembretes_mintzie?.checkpoints || []).map((checkpoint) => ({
        id: `${card.id}-${checkpoint.data}-checkpoint`,
        title: checkpoint.titulo || "Checkpoint",
        description: checkpoint.mensagem || "",
        date: checkpoint.data || "",
        type: "checkpoint",
        contextTitle: card.title || "Sem contexto",
        responsible: card.owner || "",
      })) || []),
      ...(card.lembretes_mintzie?.fechamento?.data
        ? [
            {
              id: `${card.id}-fechamento`,
              title: card.lembretes_mintzie.fechamento.titulo || "Fechamento",
              description: card.lembretes_mintzie.fechamento.mensagem || "",
              date: card.lembretes_mintzie.fechamento.data || "",
              type: "fechamento",
              contextTitle: card.title || "Sem contexto",
              responsible: card.owner || "",
            },
          ]
        : []),
      ...(card.lembretes_mintzie?.upsell?.data
        ? [
            {
              id: `${card.id}-upsell`,
              title: card.lembretes_mintzie.upsell.titulo || "Upsell",
              description: card.lembretes_mintzie.upsell.mensagem || "",
              date: card.lembretes_mintzie.upsell.data || "",
              type: "upsell",
              contextTitle: card.title || "Sem contexto",
              responsible: card.owner || "",
            },
          ]
        : []),
    ];

    return [...alignmentMilestones, ...reminderMilestones];
  });

  const partnerSeed: DashboardWorkload[] = [
    { id: "joao", name: "João", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "gui", name: "Gui", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "denis", name: "Dênis", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "stacke", name: "Stacke", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
  ];

  for (const task of tasks) {
    const partnerId = getPartnerId(task.assignee);
    if (!partnerId || task.status === "Concluída") continue;

    const partner = partnerSeed.find((item) => item.id === partnerId);
    if (!partner) continue;

    partner.activeTaskCount += 1;
    if (task.overdue) partner.overdueTaskCount += 1;
    if (task.dueSoon) partner.dueSoonTaskCount += 1;
    if (partner.examples.length < 3) {
      partner.examples.push(`${task.contextTitle}: ${task.title}`);
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueSoon !== b.dueSoon) return a.dueSoon ? -1 : 1;
    return a.title.localeCompare(b.title, "pt-BR");
  });

  const sortedCards = [...projectCards].sort((a, b) => b.openTasks - a.openTasks);
  const sortedMilestones = [...milestones]
    .filter((milestone) => milestone.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    organization,
    generatedAt: new Date().toISOString(),
    summary: {
      totalProjects: projectCards.filter((card) => card.type === "projeto").length,
      totalInitiatives: projectCards.filter((card) => card.type === "iniciativa").length,
      openTasks: tasks.filter((task) => task.status !== "Concluída").length,
      completedTasks: tasks.filter((task) => task.status === "Concluída").length,
      overdueTasks: tasks.filter((task) => task.overdue).length,
      dueSoonTasks: tasks.filter((task) => task.dueSoon).length,
      unassignedTasks: tasks.filter((task) => task.assignee === "Sem dono").length,
    },
    partners: partnerSeed,
    tasks: sortedTasks,
    cards: sortedCards,
    milestones: sortedMilestones,
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const payload = await buildDashboardPayload();
      res.json(payload);
    } catch (error) {
      console.error("Failed to build dashboard payload:", error);
      res.status(500).json({ message: "Falha ao carregar os dados reais do dashboard." });
    }
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
