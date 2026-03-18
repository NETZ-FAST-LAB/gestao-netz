import express from "express";
import { createServer } from "http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");

const PROJECTS_PATH = "Operacional/Kanban/projetos.json";
const INITIATIVES_PATH = "Operacional/Kanban/iniciativas.json";

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

type TaskUpdatePayload = {
  title?: string;
  assignee?: string;
  status?: string;
  dueDate?: string;
};

function repairText(value: string): string {
  if (!value) return value;
  if (!/[ÃƒÆ’Ãƒâ€šÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬\u00c2]/.test(value)) return value;

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

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getFullPath(relativePath: string) {
  return path.join(APP_ROOT, relativePath);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const content = await fs.readFile(getFullPath(relativePath), "utf8");
  return sanitizeDeep(JSON.parse(content)) as T;
}

async function writeJsonFile<T>(relativePath: string, data: T) {
  await fs.writeFile(getFullPath(relativePath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function mapStatusToRaw(status: string): string {
  const normalized = normalizeName(status);
  if (normalized === "concluida" || normalized === "concluída" || normalized === "done") {
    return "completed";
  }
  if (normalized === "em andamento" || normalized === "in progress" || normalized === "in_progress") {
    return "in_progress";
  }
  if (normalized === "em revisao" || normalized === "em revisão" || normalized === "review") {
    return "review";
  }
  return "pending";
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

  if (
    [
      "joao",
      "joao henrique",
      "joao henrique zborowski scholz",
      "joao scholz",
      "joe",
      "john",
      "joaozissimo",
    ].includes(normalized)
  ) {
    return "joao";
  }

  if (["gui", "gui r", "gui r.", "roennau", "guilherme roennau", "guilherme r"].includes(normalized)) {
    return "gui";
  }

  if (["denis", "denis polidoro", "denis p", "denis p."].includes(normalized)) {
    return "denis";
  }

  if (["stacke", "tak", "gui s", "gui stacke", "guilherme stacke"].includes(normalized)) {
    return "stacke";
  }

  return null;
}

async function readBoardFiles() {
  const [organization, projectsFile, initiativesFile] = await Promise.all([
    readJsonFile<{ name: string; members: string[] }>("Operacional/organizacao.json"),
    readJsonFile<BoardFile>(PROJECTS_PATH),
    readJsonFile<BoardFile>(INITIATIVES_PATH),
  ]);

  return { organization, projectsFile, initiativesFile };
}

function buildCards(projectsFile: BoardFile, initiativesFile: BoardFile) {
  return [
    ...(projectsFile.boards?.flatMap((board) =>
      (board.cards || []).map((card) => ({ ...card, contextType: "projeto" as const })),
    ) || []),
    ...(initiativesFile.boards?.flatMap((board) =>
      (board.cards || []).map((card) => ({ ...card, contextType: "iniciativa" as const })),
    ) || []),
  ];
}

function buildTasks(cards: Array<RawCard & { contextType: "projeto" | "iniciativa" }>, today: Date): DashboardTask[] {
  return cards.flatMap((card) =>
    (card.tasks || []).map((task) => {
      const mappedStatus = mapStatus(task.status || "");
      return {
        id: task.id || `${card.id}-task`,
        title: task.title || "Sem título",
        assignee: getTaskAssignee(task) || "Sem dono",
        status: mappedStatus,
        dueDate: task.dueDate || "",
        overdue: mappedStatus !== "Concluída" && isOverdue(task.dueDate || "", today),
        dueSoon: mappedStatus !== "Concluída" && isWithinDays(task.dueDate || "", today, 7),
        contextId: card.id || "sem-contexto",
        contextTitle: card.title || "Sem contexto",
        contextType: card.contextType,
      };
    }),
  );
}

async function buildDashboardPayload() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { organization, projectsFile, initiativesFile } = await readBoardFiles();
  const cards = buildCards(projectsFile, initiativesFile);
  const tasks = buildTasks(cards, today);

  const boardCards = cards.map((card) => {
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
    { id: "joao", name: "Joãozíssimo", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "gui", name: "Gui R.", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "denis", name: "Dênis", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
    { id: "stacke", name: "Guilherme Stacke", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] },
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
    if (a.contextType !== b.contextType) return a.contextType === "iniciativa" ? -1 : 1;
    return a.title.localeCompare(b.title, "pt-BR");
  });

  const sortedCards = [...boardCards].sort((a, b) => {
    if (a.type !== b.type) return a.type === "iniciativa" ? -1 : 1;
    return b.openTasks - a.openTasks;
  });

  const sortedMilestones = [...milestones]
    .filter((milestone) => milestone.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    organization,
    generatedAt: new Date().toISOString(),
    summary: {
      totalProjects: boardCards.filter((card) => card.type === "projeto").length,
      totalInitiatives: boardCards.filter((card) => card.type === "iniciativa").length,
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

async function updateTaskById(taskId: string, updates: TaskUpdatePayload) {
  const fileTargets = [
    { relativePath: PROJECTS_PATH, contextType: "projeto" as const },
    { relativePath: INITIATIVES_PATH, contextType: "iniciativa" as const },
  ];

  for (const target of fileTargets) {
    const boardFile = await readJsonFile<BoardFile>(target.relativePath);

    for (const board of boardFile.boards || []) {
      for (const card of board.cards || []) {
        const tasks = card.tasks || [];
        const task = tasks.find((item) => item.id === taskId);

        if (!task) continue;

        if (typeof updates.title === "string") {
          task.title = updates.title.trim() || task.title || "Sem título";
        }

        if (typeof updates.assignee === "string") {
          const trimmedAssignee = updates.assignee.trim();
          task.assignee = trimmedAssignee;
          if ("responsavel" in task) {
            task.responsavel = trimmedAssignee;
          }
        }

        if (typeof updates.status === "string") {
          task.status = mapStatusToRaw(updates.status);
        }

        if (typeof updates.dueDate === "string") {
          task.dueDate = updates.dueDate.trim();
        }

        await writeJsonFile(target.relativePath, boardFile);
        return { contextType: target.contextType, cardId: card.id || "", taskId };
      }
    }
  }

  return null;
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

  app.patch("/api/tasks/:taskId", async (req, res) => {
    try {
      const taskId = req.params.taskId;
      const updates = sanitizeDeep(req.body || {}) as TaskUpdatePayload;

      const taskUpdate = await updateTaskById(taskId, updates);
      if (!taskUpdate) {
        res.status(404).json({ message: "Tarefa não encontrada." });
        return;
      }

      const payload = await buildDashboardPayload();
      const updatedTask = payload.tasks.find((task) => task.id === taskId);

      res.json({
        message: "Tarefa atualizada com sucesso.",
        task: updatedTask || null,
        payload,
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ message: "Falha ao atualizar a tarefa." });
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
