import express from "express";
import { createServer } from "http";
import { pool } from "./db";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");

const PROJECTS_PATH = "Operacional/Kanban/projetos.json";
const INITIATIVES_PATH = "Operacional/Kanban/iniciativas.json";
const FINANCE_DIR = "finance";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "NETZ-FAST-LAB";
const GITHUB_REPO = process.env.GITHUB_REPO || "gestao-netz";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "master";
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || "";

type RawTask = {
  id?: string;
  title?: string;
  assignee?: string;
  responsável?: string;
  status?: string;
  dueDate?: string;
  reminders?: Array<Record<string, string>>;
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

type DashboardSummary = {
  totalProjects: number;
  totalInitiatives: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
};

type DashboardPayload = {
  organization: {
    name: string;
    members: string[];
  };
  generatedAt: string;
  summary: DashboardSummary;
  partners: Array<{
    id: string;
    name: string;
    activeTaskCount: number;
    overdueTaskCount: number;
    dueSoonTaskCount: number;
    examples: string[];
    quarterTarget: number;
    realizedAmount: number;
    provisionedAmount: number;
    achievedAmount: number;
    achievedPercentage: number;
  }>;
  tasks: DashboardTask[];
  cards: Array<{
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
  }>;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    type: string;
    contextTitle: string;
    responsible: string;
  }>;
};

type TaskUpdatePayload = {
  title?: string;
  assignee?: string;
  status?: string;
  dueDate?: string;
  contextId?: string;
  contextType?: "projeto" | "iniciativa";
};

type TaskCreatePayload = {
  title?: string;
  assignee?: string;
  status?: string;
  dueDate?: string;
  contextId?: string;
  contextType?: "projeto" | "iniciativa";
};

type AgentProfile = {
  id: string;
  name: string;
  role: string;
  ala: string;
  expertise: string[];
  personality: string;
  deliveryStyle: string;
  signatureMove: string;
};

type AgentStatus = "idle" | "thinking" | "executing" | "waiting" | "error";

type AgentToolDescriptor = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
};

type AgentMemoryEntry = {
  id: string;
  role: "user" | "agent" | "system";
  kind: "chat" | "insight" | "handoff";
  content: string;
  createdAt: string;
};

type AgentCollaboration = {
  agentId: string;
  agentName: string;
  role: string;
  mode: "consultar" | "delegar" | "revisar";
  reason: string;
};

type AgentWorkspace = {
  headline: string;
  focus: string[];
  relevantTasks: string[];
  relatedContexts: string[];
  riskCount: number;
};

type AgentRuntimeState = {
  status: AgentStatus;
  currentTask: string | null;
  lastActivity: string;
  memory: AgentMemoryEntry[];
};

type AgentApiSummary = {
  id: string;
  name: string;
  role: string;
  ala: string;
  expertise: string[];
  personality: string;
  status: AgentStatus;
  currentTask: string | null;
  lastActivity: string;
  tools: AgentToolDescriptor[];
  memoryPreview: AgentMemoryEntry[];
};

type AgentApiDetail = AgentApiSummary & {
  workspace: AgentWorkspace;
  memory: AgentMemoryEntry[];
};

type FinanceMovement = {
  date: string;
  description: string;
  amount: number;
};

const AGENT_PROFILES: Record<string, AgentProfile> = {
  mintz: {
    id: "mintz",
    name: "Mintzie",
    role: "Guardião Cultural e Operacional",
    ala: "Laboratório NETZ",
    expertise: ["cultura", "tom interno", "orquestração de rotinas", "gestão de tarefas"],
    personality: "felino, superior, sarcástico, charmoso e observador, mas muito cirúrgico quando se trata de fluxo de trabalho",
    deliveryStyle: "fale com ironia elegante, mas entregue cobrança e leitura cultural útil. Cobre ação.",
    signatureMove: "farejar vazamento de escopo e desalinhamento antes da equipe perceber",
  },
};

const AGENT_MEMORY_LIMIT = 18;
const AGENT_RUNTIMES = new Map<string, AgentRuntimeState>();

const AGENT_TOOLBOX: Record<string, AgentToolDescriptor[]> = {
  mintz: [
    {
      id: "culture-radar",
      name: "Radar cultural",
      description: "Fareja desalinhamento, excesso de atrito e tom torto antes de contaminar o laboratório.",
      capabilities: ["cultura", "tom", "alinhamento"],
    },
    {
      id: "kanban-action",
      name: "Orquestrador de Kanban",
      description: "Transforma decisão em ação operacional no quadro.",
      capabilities: ["tarefas", "status", "responsáveis"],
    },
  ],
};

function repairText(value: string): string {
  if (!value) return value;
  if (!/[\u00C3\u00C2\uFFFD]/.test(value)) {
    return value;
  }

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
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const PARTNER_ALIASES: Record<string, string[]> = {
  joao: ["joao", "joao henrique", "joao henrique zborowski scholz", "joao scholz", "joe", "john", "joaozissimo"],
  gui: ["gui", "gui r", "gui r.", "roennau", "guilherme roennau", "guilherme r"],
  denis: ["denis", "denis polidoro", "denis p", "denis p."],
  stacke: ["stacke", "tak", "gui s", "gui stacke", "guilherme stacke"],
};

function getFullPath(relativePath: string) {
  return path.join(APP_ROOT, relativePath);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const content = await fs.readFile(getFullPath(relativePath), "utf8");
  return sanitizeDeep(JSON.parse(content)) as T;
}

async function readJsonFileWithFallback<T>(relativePaths: string[]): Promise<T> {
  let lastError: unknown = null;

  for (const relativePath of relativePaths) {
    try {
      return await readJsonFile<T>(relativePath);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao carregar arquivo JSON com fallback.");
}

async function writeJsonFile<T>(relativePath: string, data: T) {
  await fs.writeFile(getFullPath(relativePath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readFinanceMovements(): Promise<FinanceMovement[]> {
  try {
    const financeDir = getFullPath(FINANCE_DIR);
    const files = await fs.readdir(financeDir);
    const extractFile = files.find((file) => /^Extrato-.*\.csv$/i.test(file));

    if (!extractFile) {
      return [];
    }

    const raw = await fs.readFile(path.join(financeDir, extractFile), "utf8");
    const lines = sanitizeDeep(raw)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const dataStart = lines.findIndex((line) => normalizeName(line).startsWith("data lancamento;descricao;valor;saldo"));
    if (dataStart === -1) {
      return [];
    }

    return lines.slice(dataStart + 1).flatMap((line) => {
      const [date = "", description = "", amount = "0"] = line.split(";");
      const parsedAmount = Number.parseFloat(amount.replace(/\./g, "").replace(",", "."));
      if (!date || Number.isNaN(parsedAmount)) {
        return [];
      }

      return [{ date, description, amount: parsedAmount }];
    });
  } catch {
    return [];
  }
}

function getTaskAssignee(task: RawTask): string {
  return (task.assignee || task.responsável || "").trim();
}

function mapStatus(status: string): string {
  const normalized = normalizeName(status);
  if (["completed", "concluida", "done"].includes(normalized)) return "Concluída";
  if (["in_progress", "em andamento", "doing"].includes(normalized)) return "Em andamento";
  if (["review", "em revisao"].includes(normalized)) return "Em revisão";
  return "Pendente";
}

function mapStatusToRaw(status: string): string {
  const normalized = normalizeName(status);
  if (["concluida", "concluída", "done", "completed"].includes(normalized)) return "completed";
  if (["em andamento", "in progress", "in_progress"].includes(normalized)) return "in_progress";
  if (["em revisao", "em revisão", "review"].includes(normalized)) return "review";
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
  for (const [partnerId, aliases] of Object.entries(PARTNER_ALIASES)) {
    if (aliases.includes(normalized)) {
      return partnerId;
    }
  }

  return null;
}

async function readBoardFiles() {
  const [organization, financeMovements] = await Promise.all([
    readJsonFileWithFallback<{ name: string; members: string[] }>([
      "Operacional/organizacao.json",
      "Operacional/organização.json",
    ]),
    readFinanceMovements(),
  ]);

  const resProjects = await pool.query("SELECT * FROM projects");
  const resTasks = await pool.query("SELECT * FROM tasks");

  const buildBoard = (prefix: string) => {
    return {
      boards: [
        {
          cards: resProjects.rows.filter((p: any) => p.id.startsWith(prefix)).map((p: any) => {
            let meta: any = {};
            let tags = [];
            try { meta = typeof p.meta === "string" ? JSON.parse(p.meta) : (p.meta || {}); } catch(e) {}
            try { tags = typeof p.tags === "string" ? JSON.parse(p.tags) : (p.tags || []); } catch(e) {}

            return {
              id: p.id,
              title: p.title,
              client: p.client,
              owner: p.owner,
              column: p.column_status,
              tags: tags,
              health_status: meta.health || "",
              marcos_alinhamento: meta.marcos || [],
              ...meta,
              tasks: resTasks.rows.filter((t: any) => t.project_id === p.id).map((t: any) => ({
                id: t.id,
                title: t.title,
                assignee: t.assignee,
                responsável: t.assignee, // retro
                status: mapStatus(t.status), // Postgres is raw status
                dueDate: t.due_date
              }))
            };
          })
        }
      ]
    };
  };

  const projectsFile = buildBoard("proj-");
  const initiativesFile = buildBoard("inic-");

  return { organization, projectsFile, initiativesFile, financeMovements };
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

async function buildDashboardPayload(): Promise<DashboardPayload> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { organization, projectsFile, initiativesFile, financeMovements } = await readBoardFiles();
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
      responsible: milestone.responsável || "",
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

  const quarterTargetPerPartner = Math.round(192_000 / 4);
  const partners = [
    {
      id: "joao",
      name: "Joãozíssimo",
      activeTaskCount: 0,
      overdueTaskCount: 0,
      dueSoonTaskCount: 0,
      examples: [] as string[],
      quarterTarget: quarterTargetPerPartner,
      realizedAmount: 0,
      provisionedAmount: 0,
      achievedAmount: 0,
      achievedPercentage: 0,
    },
    {
      id: "gui",
      name: "Gui R.",
      activeTaskCount: 0,
      overdueTaskCount: 0,
      dueSoonTaskCount: 0,
      examples: [] as string[],
      quarterTarget: quarterTargetPerPartner,
      realizedAmount: 0,
      provisionedAmount: 0,
      achievedAmount: 0,
      achievedPercentage: 0,
    },
    {
      id: "denis",
      name: "Denis",
      activeTaskCount: 0,
      overdueTaskCount: 0,
      dueSoonTaskCount: 0,
      examples: [] as string[],
      quarterTarget: quarterTargetPerPartner,
      realizedAmount: 0,
      provisionedAmount: 0,
      achievedAmount: 0,
      achievedPercentage: 0,
    },
    {
      id: "stacke",
      name: "Guilherme Stacke",
      activeTaskCount: 0,
      overdueTaskCount: 0,
      dueSoonTaskCount: 0,
      examples: [] as string[],
      quarterTarget: quarterTargetPerPartner,
      realizedAmount: 0,
      provisionedAmount: 0,
      achievedAmount: 0,
      achievedPercentage: 0,
    },
  ];

  for (const task of tasks) {
    const partnerId = getPartnerId(task.assignee);
    if (!partnerId || task.status === "Concluída") continue;
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) continue;

    partner.activeTaskCount += 1;
    if (task.overdue) partner.overdueTaskCount += 1;
    if (task.dueSoon) partner.dueSoonTaskCount += 1;
    if (partner.examples.length < 3) {
      partner.examples.push(`${task.contextTitle}: ${task.title}`);
    }
  }

  const outboundFinance = financeMovements.filter((movement) => movement.amount < 0);
  for (const movement of outboundFinance) {
    const partnerId = getPartnerId(movement.description);
    if (!partnerId) continue;
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) continue;
    partner.realizedAmount += Math.abs(movement.amount);
  }

  const provisionBase = Math.max(0, 192_000 - partners.reduce((sum, partner) => sum + partner.realizedAmount, 0));
  const totalActiveWeight = partners.reduce((sum, partner) => sum + partner.activeTaskCount, 0);

  for (const partner of partners) {
    const activityShare =
      totalActiveWeight > 0 ? partner.activeTaskCount / totalActiveWeight : 1 / Math.max(1, partners.length);
    partner.provisionedAmount = Math.round(provisionBase * activityShare * 0.25);
    partner.achievedAmount = partner.realizedAmount + partner.provisionedAmount;
    partner.achievedPercentage = Math.min(
      100,
      Math.round((partner.achievedAmount / Math.max(1, partner.quarterTarget)) * 100),
    );
  }

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
    partners,
    tasks: [...tasks].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.dueSoon !== b.dueSoon) return a.dueSoon ? -1 : 1;
      if (a.contextType !== b.contextType) return a.contextType === "iniciativa" ? -1 : 1;
      return a.title.localeCompare(b.title, "pt-BR");
    }),
    cards: [...boardCards].sort((a, b) => {
      if (a.type !== b.type) return a.type === "iniciativa" ? -1 : 1;
      return b.openTasks - a.openTasks;
    }),
    milestones: [...milestones]
      .filter((milestone) => milestone.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function ensureAgentRuntime(profile: AgentProfile): AgentRuntimeState {
  const existing = AGENT_RUNTIMES.get(profile.id);
  if (existing) return existing;

  const runtime: AgentRuntimeState = {
    status: "idle",
    currentTask: null,
    lastActivity: new Date(0).toISOString(),
    memory: [],
  };

  AGENT_RUNTIMES.set(profile.id, runtime);
  return runtime;
}

function rememberAgentEvent(
  agentId: string,
  role: AgentMemoryEntry["role"],
  content: string,
  kind: AgentMemoryEntry["kind"] = "chat",
) {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) return;

  const runtime = ensureAgentRuntime(profile);
  runtime.memory = [
    ...runtime.memory,
    {
      id: randomUUID(),
      role,
      kind,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    },
  ].slice(-AGENT_MEMORY_LIMIT);
  runtime.lastActivity = new Date().toISOString();
}

function setAgentStatus(agentId: string, status: AgentStatus, currentTask: string | null = null) {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) return;

  const runtime = ensureAgentRuntime(profile);
  runtime.status = status;
  runtime.currentTask = currentTask;
  runtime.lastActivity = new Date().toISOString();
}

function buildAgentActions(profile: AgentProfile): string[] {
  if (profile.id === "pipo") {
    return ["Quebrar uma frente em fluxo, dono e prazo", "Transformar conversa em protocolo operacional"];
  }

  if (profile.id === "spark") {
    return ["Desenhar arquitetura da solução", "Separar frontend, backend e integrações"];
  }

  if (profile.id === "pixel") {
    return ["Reorganizar a interface com mais clareza", "Desenhar o fluxo mínimo viável"];
  }

  if (profile.id === "mintz") {
    return ["Refinar linguagem e tom do laboratório", "Apontar desalinhamento cultural antes de feder"];
  }

  if (profile.id === "tiopatinhas" || profile.id === "calculin") {
    return ["Ler impacto em receita e custo", "Sugerir critério econômico para decidir prioridade"];
  }

  return [
    `Responder pelo recorte de ${profile.expertise.join(", ")}`,
    "Transformar o pedido em próxima ação concreta",
  ];
}

function scoreTaskForAgent(task: DashboardTask, profile: AgentProfile) {
  const haystack = normalizeName(
    `${task.title} ${task.contextTitle} ${task.assignee} ${task.contextType} ${task.status}`,
  );
  let score = 0;

  for (const expertise of profile.expertise) {
    if (haystack.includes(normalizeName(expertise))) score += 2;
  }

  const topics = detectTopics(haystack);
  if (topics.interface && ["pixel", "lola", "zuzu", "barnum"].includes(profile.id)) score += 3;
  if (topics.operations && ["pipo", "picles", "mintz"].includes(profile.id)) score += 3;
  if (topics.engineering && ["spark", "gigi", "cautela"].includes(profile.id)) score += 3;
  if (topics.finance && ["tiopatinhas", "calculin", "cautela"].includes(profile.id)) score += 3;
  if (task.overdue || task.dueSoon) score += 1;

  return score;
}

function buildAgentWorkspace(profile: AgentProfile, dashboard: DashboardPayload, message = ""): AgentWorkspace {
  const rankedTasks = [...dashboard.tasks]
    .map((task) => ({ task, score: scoreTaskForAgent(task, profile) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => item.task);

  const topicFlags = detectTopics(message);
  const focus = [
    topicFlags.operations ? "Operação em movimento" : null,
    topicFlags.engineering ? "Arquitetura e integrações" : null,
    topicFlags.interface ? "Experiência e interface" : null,
    topicFlags.finance ? "Tesouraria e retorno" : null,
    ...profile.expertise.map((item) => item[0]?.toUpperCase() + item.slice(1)),
  ]
    .filter((item, index, array): item is string => Boolean(item) && array.indexOf(item) === index)
    .slice(0, 4);

  const relatedContexts = Array.from(new Set(rankedTasks.map((task) => task.contextTitle))).slice(0, 4);
  const riskCount = rankedTasks.filter((task) => task.overdue || task.dueSoon).length;

  return {
    headline:
      rankedTasks.length > 0
        ? `${profile.name} está com ${rankedTasks.length} frente(s) diretamente conectadas ao seu recorte agora.`
        : `${profile.name} está livre para puxar uma frente nova sem herdar bagunça alheia.`,
    focus,
    relevantTasks: rankedTasks.map((task) => `${task.contextTitle}: ${task.title}`),
    relatedContexts,
    riskCount,
  };
}

function buildAgentCollaborations(profile: AgentProfile, dashboard: DashboardPayload, message = ""): AgentCollaboration[] {
  const topics = detectTopics(message);
  const picks = new Map<string, AgentCollaboration>();
  const register = (agentId: string, reason: string, mode: AgentCollaboration["mode"]) => {
    const collaborator = AGENT_PROFILES[agentId];
    if (!collaborator || collaborator.id === profile.id || picks.has(agentId)) return;
    picks.set(agentId, {
      agentId,
      agentName: collaborator.name,
      role: collaborator.role,
      mode,
      reason,
    });
  };

  if (["picles", "pipo", "mintz"].includes(profile.id)) {
    register("spark", "traduz isso para arquitetura e implementação sem explodir a bancada", "delegar");
    register("pixel", "dar forma visual quando a frente precisar sair do texto", "consultar");
  }

  if (["spark", "gigi"].includes(profile.id)) {
    register("pipo", "alinhar operação, rito e dono antes do código escapar do trilho", "consultar");
    register("cautela", "revisar riscos de integração e limites do experimento", "revisar");
  }

  if (["pixel", "lola", "zuzu", "barnum"].includes(profile.id)) {
    register("picles", "priorizar o que realmente mexe a agulha antes de polir espuma", "consultar");
    register("spark", "garantir que a experiência não prometa o que a pilha não entrega", "revisar");
  }

  if (["tiopatinhas", "calculin", "cautela"].includes(profile.id)) {
    register("picles", "encaixar critério econômico na priorização da bancada", "consultar");
    register("mintz", "alinhar impacto financeiro com o jeito NETZ de operar", "revisar");
  }

  if (topics.interface) {
    register("pixel", "refinar interface e hierarquia do que vai para a tela", "consultar");
    register("lola", "afinar narrativa para a experiência não soar genérica", "revisar");
  }

  if (topics.operations) {
    register("pipo", "transformar a conversa em fluxo, dono e prazo", "delegar");
    register("mintz", "proteger o tom e o alinhamento no meio da correria", "revisar");
  }

  if (topics.engineering) {
    register("spark", "desenhar a arquitetura e o contrato de dados", "consultar");
    register("gigi", "avaliar deploy, ambiente e risco operacional", "revisar");
  }

  if (topics.finance) {
    register("tiopatinhas", "ler retorno, margem e priorização econômica", "consultar");
    register("calculin", "validar tesouraria, custo e controle fino", "revisar");
  }

  const dashboardPressure =
    dashboard.summary.overdueTasks > 0 || dashboard.summary.dueSoonTasks > 0
      ? "O laboratório está com risco quente; puxe quem ajuda a tirar isso do vermelho."
      : "Sem risco agudo agora, entao vale chamar quem acelera com menos atrito.";

  register("mintz", dashboardPressure, "consultar");

  return Array.from(picks.values()).slice(0, 4);
}

function buildAgentSummary(profile: AgentProfile, dashboard: DashboardPayload, message = ""): AgentApiSummary {
  const runtime = ensureAgentRuntime(profile);
  const tools = AGENT_TOOLBOX[profile.id] || [];
  const workspace = buildAgentWorkspace(profile, dashboard, message);

  if (!runtime.memory.length) {
    rememberAgentEvent(
      profile.id,
      "system",
      `${profile.name} pronto na bancada. Recorte quente agora: ${workspace.focus.join(", ") || "observação geral do laboratório"}.`,
      "insight",
    );
  }

  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    ala: profile.ala,
    expertise: profile.expertise,
    personality: profile.personality,
    status: runtime.status,
    currentTask: runtime.currentTask,
    lastActivity: runtime.lastActivity,
    tools,
    memoryPreview: runtime.memory.slice(-3),
  };
}

function buildAgentDetail(profile: AgentProfile, dashboard: DashboardPayload, message = ""): AgentApiDetail {
  const summary = buildAgentSummary(profile, dashboard, message);
  const runtime = ensureAgentRuntime(profile);

  return {
    ...summary,
    workspace: buildAgentWorkspace(profile, dashboard, message),
    memory: runtime.memory,
  };
}

function getGithubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "netz-copilotx",
  };
}

async function syncJsonFileToGithub(relativePath: string, data: BoardFile, commitMessage: string) {
  if (!GITHUB_TOKEN) return false;

  const githubPath = relativePath.replace(/\\/g, "/");
  const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}?ref=${GITHUB_BRANCH}`;
  const currentFileResponse = await fetch(fileUrl, { headers: getGithubHeaders() });

  if (!currentFileResponse.ok) {
    const details = await currentFileResponse.text();
    throw new Error(`Falha ao ler arquivo no GitHub: ${details}`);
  }

  const currentFile = (await currentFileResponse.json()) as { sha?: string };
  const encodedContent = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64");

  const updateResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`, {
    method: "PUT",
    headers: getGithubHeaders(),
    body: JSON.stringify({
      message: commitMessage,
      content: encodedContent,
      sha: currentFile.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!updateResponse.ok) {
    const details = await updateResponse.text();
    throw new Error(`Falha ao sincronizar arquivo no GitHub: ${details}`);
  }

  return true;
}

async function updateTaskById(taskId: string, updates: TaskUpdatePayload) {
  let queryParts: string[] = [];
  let values: any[] = [];
  let paramIdx = 1;

  if (typeof updates.title === "string") {
    queryParts.push(`title = $${paramIdx++}`);
    values.push(updates.title.trim());
  }
  if (typeof updates.assignee === "string") {
    queryParts.push(`assignee = $${paramIdx++}`);
    values.push(updates.assignee.trim());
  }
  if (typeof updates.status === "string") {
    queryParts.push(`status = $${paramIdx++}`);
    values.push(mapStatusToRaw(updates.status));
  }
  if (typeof updates.dueDate === "string") {
    queryParts.push(`due_date = $${paramIdx++}`);
    values.push(updates.dueDate.trim());
  }

  if (queryParts.length === 0) return { githubSynced: false };

  values.push(taskId);
  const q = `UPDATE tasks SET ${queryParts.join(", ")} WHERE id = $${paramIdx}`;
  
  await pool.query(q, values);
  return { githubSynced: false }; 
}

async function createTaskInContext(input: TaskCreatePayload) {
  const contextId = input.contextId?.trim();
  const title = input.title?.trim();

  if (!contextId || !title) {
    throw new Error("Dados insuficientes para criar tarefa.");
  }

  const newTaskId = `task-${contextId}-${randomUUID().slice(0, 8)}`;
  const trimmedAssignee = input.assignee?.trim() || "";
  const status = mapStatusToRaw(input.status || "Pendente");
  const dueDate = input.dueDate?.trim() || "";

  await pool.query(
    `INSERT INTO tasks (id, project_id, title, assignee, status, due_date) VALUES ($1, $2, $3, $4, $5, $6)`,
    [newTaskId, contextId, title, trimmedAssignee, status, dueDate]
  );

  return { taskId: newTaskId, githubSynced: false };
}

function summarizeDashboardForPrompt(payload: DashboardPayload) {
  const criticalTasks = payload.tasks
    .filter((task) => task.overdue || task.dueSoon)
    .slice(0, 5)
    .map((task) => `${task.contextTitle}: ${task.title} (${task.assignee}, ${task.status})`);

  return {
    summary: payload.summary,
    criticalTasks,
  };
}

function buildAgentSystemPrompt(profile: AgentProfile, dashboard: DashboardPayload) {
  const context = summarizeDashboardForPrompt(dashboard);
  const runtime = ensureAgentRuntime(profile);
  const recentMemory = runtime.memory
    .slice(-4)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join(" | ");

  return [
    `Você é ${profile.name}, ${profile.role} da ala ${profile.ala} do Laboratório Maluco da NETZ.`,
    `Sua personalidade é: ${profile.personality}.`,
    `Sua especialidade principal é: ${profile.expertise.join(", ")}.`,
    `Seu jeito de responder: ${profile.deliveryStyle}.`,
    `Seu movimento característico é: ${profile.signatureMove}.`,
    "Responda sempre em português do Brasil.",
    "Não aja como assistente genérico.",
    "Fale em primeira pessoa, encarnando o agente.",
    "Seja específico, útil e orientado a ação.",
    "Evite abrir toda resposta com a mesma fórmula. Varie a estrutura, puxe o contexto e responda com inteligência real.",
    "Não repita blocos padronizados como 'eu seguiria em 3 movimentos' a menos que isso realmente faça sentido para este pedido.",
    `Estado atual do laboratório: ${context.summary.openTasks} tarefas abertas, ${context.summary.overdueTasks} em risco de explosão, ${context.summary.totalProjects} projetos e ${context.summary.totalInitiatives} experimentos internos.`,
    context.criticalTasks.length > 0 ? `Riscos quentes agora: ${context.criticalTasks.join(" | ")}.` : "Não há riscos quentes destacados agora.",
    recentMemory ? `Memória recente desta conversa: ${recentMemory}.` : "Ainda sem memória recente desta conversa.",
  ].join("\n");
}

async function callGithubModels(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!apiKey) return null;

  const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GITHUB_MODELS_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 700,
      top_p: 0.95,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub Models falhou: ${details}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callOpenAI(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI falhou: ${details}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || null;
}

function detectTopics(message: string) {
  const normalized = normalizeName(message);
  return {
    greeting: /(^|\s)(oi|ola|olá|eai|eae|fala|opa|salve)\b/.test(normalized),
    interface: /site|ux|ui|dashboard|layout|design|interface|landing/.test(normalized),
    operations: /tarefa|kanban|prazo|responsável|status|processo|fluxo|backlog/.test(normalized),
    engineering: /api|backend|código|deploy|bug|integração|banco inter|webhook|infra/.test(normalized),
    finance: /receita|caixa|margem|tesouraria|orçamento|custo|roi|banco/.test(normalized),
  };
}

function pickVariant(message: string, options: string[]) {
  if (options.length === 0) return "";
  const seed = Array.from(message).reduce((total, char) => total + char.charCodeAt(0), 0);
  return options[seed % options.length];
}

function buildFallbackMoves(profile: AgentProfile, message: string) {
  const topics = detectTopics(message);

  if (profile.id === "picles") {
    return [
      "eu cortaria a névoa e definiria um único objetivo operacional",
      topics.operations
        ? "eu quebraria isso em tarefa, dono, prazo e critério de conclusão"
        : "eu conectaria a ideia ao resultado que a NETZ quer ver no trimestre",
      "eu escolheria o próximo movimento que destrava o resto da bancada",
    ];
  }

  if (profile.id === "spark") {
    return [
      "eu separaria o que é interface, o que é backend e o que é integração",
      topics.engineering
        ? "eu desenharia rota, persistência e contrato de dados antes de codar"
        : "eu evitaria remendo bonito que explode na próxima iteração",
      "eu escolheria a implementação menor que ainda sustenta evolução",
    ];
  }

  if (profile.id === "mintz") {
    return [
      "eu observaria se isso fortalece ou desgasta o jeito NETZ de trabalhar",
      "eu apararia arestas de linguagem, postura e alinhamento entre as pessoas",
      "eu cobraria uma ação concreta sem perder o charme felino que vocês claramente precisam",
    ];
  }

  if (profile.id === "pixel") {
    return [
      "eu reduziria a interface ao mínimo que ajuda a agir",
      topics.interface
        ? "eu organizaria a tela em hierarquia, clareza e chamada para ação"
        : "eu transformaria a ideia em fluxo visível, não em bloco de texto",
      "eu prototiparia primeiro o trecho onde a fricção está mais feia",
    ];
  }

  if (profile.id === "tiopatinhas") {
    return [
      "eu perguntaria qual retorno isso promete e em quanto tempo",
      "eu compararia esforço, custo e valor capturável",
      "eu puxaria a conversa para receita, margem e prioridade econômica",
    ];
  }

  return [
    `eu responderia usando meu recorte de ${profile.expertise.join(", ")}`,
    "eu transformaria a ideia em próxima ação concreta",
    "eu deixaria claro o que depende de você e o que já pode ir para o Kanban",
  ];
}

function buildFallbackOpening(profile: AgentProfile, message: string) {
  const trimmed = message.trim();
  const topics = detectTopics(trimmed);

  if (profile.id === "mintz") {
    return pickVariant(trimmed, [
      `Você me trouxe "${trimmed}". Naturalmente sobrou para o felino superior aqui farejar se isso é visão ou bagunça.`,
      `"${trimmed}" caiu no meu colo. Vou assumir que vocês querem elegância, não desordem perfumada.`,
      `Recebi "${trimmed}". Vamos ver se isso merece protocolo ou só uma leve humilhação felina.`,
    ]);
  }

  if (topics.greeting && profile.id === "picles") {
    return pickVariant(trimmed, [
      `E aí. Cumprimentos suficientes; agora me diga o que realmente precisa sair da névoa em "${trimmed}".`,
      `Saudação registrada. Agora corta o aquecimento e me diz qual decisão "${trimmed}" está escondendo.`,
      `Certo, bom dia, boa tarde, o que for. O ponto é: o que em "${trimmed}" precisa virar ação agora?`,
    ]);
  }

  if (profile.id === "picles") {
    return pickVariant(trimmed, [
      `Li seu pedido sobre "${trimmed}". Vou poupar o laboratório da enrolação e cortar direto para o que move a bancada.`,
      `Sobre "${trimmed}": vou ignorar o ruído e puxar só o pedaço que realmente desloca a operação.`,
      `"${trimmed}" pode virar névoa rápido. Então eu vou responder já no corte de prioridade, não no charme.`,
    ]);
  }

  if (profile.id === "spark") {
    return pickVariant(trimmed, [
      `Sobre "${trimmed}": antes de qualquer entusiasmo, eu olho arquitetura, contrato e persistência.`,
      `Se o tema é "${trimmed}", eu começo pelo que sustenta isso sem explodir no próximo deploy.`,
      `"${trimmed}" não me convence por discurso. Me convence por arquitetura, fronteira e dado bem tratado.`,
    ]);
  }

  if (profile.id === "tiopatinhas") {
    return pickVariant(trimmed, [
      `Recebi "${trimmed}". Antes de romantizar, eu quero saber quanto isso rende, custa e trava.`,
      `Sobre "${trimmed}": eu não penso em brilho; penso em caixa, retorno e prioridade.`,
      `"${trimmed}" só me interessa se fizer a tesouraria respirar melhor. Vamos ao ponto.`,
    ]);
  }

  return `Recebi seu pedido sobre "${trimmed}". Vou responder como ${profile.name}, não como assistente genérico domesticado.`;
}

function buildAgentLead(profile: AgentProfile, dashboard: DashboardPayload, message: string) {
  const workspace = buildAgentWorkspace(profile, dashboard, message);
  const hottestTask = workspace.relevantTasks[0];

  if (profile.id === "picles") {
    return hottestTask
      ? `O corte quente aqui encosta em ${hottestTask}. Não é hora de floreio; é hora de decidir foco.`
      : "Ainda há espaço para escolher a frente com melhor efeito dominó.";
  }

  if (profile.id === "spark") {
    return hottestTask
      ? `Se eu puxar por arquitetura, o ponto mais concreto agora é ${hottestTask}.`
      : "Sem pressão técnica gritante agora, então dá para desenhar com cabeça fria.";
  }

  if (profile.id === "mintz") {
    return hottestTask
      ? `O cheiro mais forte de atrito cultural ou operacional está perto de ${hottestTask}.`
      : "Hoje o laboratório está mais arrumado do que vocês merecem, então dá para falar de alinhamento com menos fumaça.";
  }

  if (profile.id === "tiopatinhas") {
    return `No caixa, a distância para o alvo ainda é de ${dashboard.summary.openTasks} frentes abertas disputando atenção e caixa curto pedindo critério.`;
  }

  return hottestTask
    ? `Do meu recorte, a frente mais visível agora é ${hottestTask}.`
    : `Do meu recorte, o melhor movimento é escolher uma frente concreta para puxar já.`;
}

function buildAgentClosing(profile: AgentProfile) {
  if (profile.id === "spark") {
    return "Se você quiser, eu converto isso em arquitetura mínima, contrato de dados e sequência de implementação.";
  }

  if (profile.id === "tiopatinhas") {
    return "Se fizer sentido, eu desdobro isso em leitura de ROI, tesouraria e corte de prioridade econômica.";
  }

  if (profile.id === "mintz") {
    return "Se insistirem, eu também posso transformar isso em mensagem, cobrança ou ajuste de tom sem deixar o laboratório feder.";
  }

  return "Se quiser, eu transformo isso em próxima ação objetiva para a bancada ou direto para o Kanban.";
}

function buildReplySectionTitle(profile: AgentProfile, message: string) {
  const topics = detectTopics(message);

  if (profile.id === "spark") {
    return pickVariant(message, [
      "Eu atacaria isso nesta sequência:",
      "Meu corte técnico seria este:",
      "A implementação mínima que presta começaria assim:",
    ]);
  }

  if (profile.id === "tiopatinhas") {
    return pickVariant(message, [
      "Eu abriria essa frente por três lentes:",
      "O recorte financeiro que importa é este:",
      "Se a pergunta é viabilidade, eu leria assim:",
    ]);
  }

  if (profile.id === "mintz") {
    return pickVariant(message, [
      "O meu faro aponta para isto:",
      "O desalinhamento ou acerto mais claro está aqui:",
      "Se eu tiver que cortar a fumaça, eu diria o seguinte:",
    ]);
  }

  if (profile.id === "picles" && topics.operations) {
    return pickVariant(message, [
      "Eu puxaria a operação por aqui:",
      "O recorte útil para a bancada é este:",
      "Se a ideia é destravar, eu faria assim:",
    ]);
  }

  return pickVariant(message, [
    "Meu corte prático seria este:",
    "Eu responderia por este caminho:",
    "O que move a bancada daqui para frente é isto:",
  ]);
}

function buildFallbackAgentReply(profile: AgentProfile, message: string, dashboard: DashboardPayload) {
  const moves = buildFallbackMoves(profile, message);
  const topics = detectTopics(message);
  const opening = buildFallbackOpening(profile, message);
  const lead = buildAgentLead(profile, dashboard, message);
  const labState = `Laboratório agora: ${dashboard.summary.openTasks} tarefas abertas, ${dashboard.summary.overdueTasks} em risco de explosão e ${dashboard.summary.totalInitiatives} experimentos internos em curso.`;
  const sectionTitle = buildReplySectionTitle(profile, message);

  if (topics.greeting && message.trim().split(/\s+/).length <= 4) {
    return [opening, lead, buildAgentClosing(profile)].join("\n\n");
  }

  if (profile.id === "tiopatinhas") {
    return [
      opening,
      `Leitura de caixa: ${labState}`,
      lead,
      sectionTitle,
      `1. retorno capturável: ${moves[0]}.`,
      `2. esforço versus margem: ${moves[1]}.`,
      `3. prioridade econômica real: ${moves[2]}.`,
      buildAgentClosing(profile),
    ].join("\n\n");
  }

  if (profile.id === "mintz") {
    return [
      opening,
      lead,
      sectionTitle,
      `1. ${moves[0]}.`,
      `2. ${moves[1]}.`,
      `3. ${moves[2]}.`,
      buildAgentClosing(profile),
    ].join("\n\n");
  }

  if (profile.id === "spark") {
    return [
      opening,
      lead,
      sectionTitle,
      `1. arquitetura: ${moves[0]}.`,
      `2. implementação: ${moves[1]}.`,
      `3. risco de bancada: ${moves[2]}.`,
      buildAgentClosing(profile),
    ].join("\n\n");
  }

  return [
    opening,
    labState,
    lead,
    sectionTitle,
    `1. ${moves[0]}.`,
    `2. ${moves[1]}.`,
    `3. ${moves[2]}.`,
    buildAgentClosing(profile),
  ].join("\n\n");
}

async function generateAgentReply(agentId: string, userMessage: string, dashboard: DashboardPayload) {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) {
    throw new Error("Agente não encontrado.");
  }

  setAgentStatus(agentId, "thinking", userMessage.trim());
  const systemPrompt = buildAgentSystemPrompt(profile, dashboard);

  try {
    const githubReply = await callGithubModels(systemPrompt, userMessage);
    if (githubReply) {
      setAgentStatus(agentId, "idle");
      return githubReply;
    }
  } catch (error) {
    console.error("GitHub Models agent error:", error);
  }

  try {
    const openAiReply = await callOpenAI(systemPrompt, userMessage);
    if (openAiReply) {
      setAgentStatus(agentId, "idle");
      return openAiReply;
    }
  } catch (error) {
    console.error("OpenAI agent error:", error);
  }

  const fallbackReply = buildFallbackAgentReply(profile, userMessage, dashboard);
  setAgentStatus(agentId, "idle");
  return fallbackReply;
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
        res.status(404).json({ message: "Tarefa não encontrada nesse contexto." });
        return;
      }

      const payload = await buildDashboardPayload();
      const updatedTask = payload.tasks.find((task) => task.id === taskId && task.contextId === updates.contextId);

      res.json({
        message: taskUpdate.githubSynced
          ? "Tarefa atualizada e sincronizada com o GitHub."
          : "Tarefa atualizada na instância atual. Para persistir entre deploys, configure GITHUB_TOKEN no copilotx.",
        task: updatedTask || null,
        payload,
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ message: "Falha ao atualizar a tarefa." });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const input = sanitizeDeep(req.body || {}) as TaskCreatePayload;
      const created = await createTaskInContext(input);

      if (!created) {
        res.status(404).json({ message: "Contexto não encontrado para criar a tarefa." });
        return;
      }

      const payload = await buildDashboardPayload();
      const createdTask = payload.tasks.find(
        (task) => task.id === created.taskId && task.contextId === input.contextId,
      );

      res.status(201).json({
        message: created.githubSynced
          ? "Tarefa criada e sincronizada com o GitHub."
          : "Tarefa criada na instância atual. Para persistir entre deploys, configure GITHUB_TOKEN no copilotx.",
        task: createdTask || null,
        payload,
      });
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ message: "Falha ao criar a tarefa." });
    }
  });

  app.get("/api/agents", async (_req, res) => {
    try {
      const dashboard = await buildDashboardPayload();
      const agents = Object.values(AGENT_PROFILES).map((profile) => buildAgentSummary(profile, dashboard));
      res.json({ agents });
    } catch (error) {
      console.error("Failed to load agents:", error);
      res.status(500).json({ message: "Falha ao carregar a estação multiagente." });
    }
  });

  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const agentId = req.params.agentId;
      const profile = AGENT_PROFILES[agentId];

      if (!profile) {
        res.status(404).json({ message: "Agente não encontrado." });
        return;
      }

      const dashboard = await buildDashboardPayload();
      res.json({ agent: buildAgentDetail(profile, dashboard) });
    } catch (error) {
      console.error("Failed to load agent detail:", error);
      res.status(500).json({ message: "Falha ao carregar o detalhe do agente." });
    }
  });

  app.post("/api/agents/:agentId/chat", async (req, res) => {
    try {
      const agentId = req.params.agentId;
      const profile = AGENT_PROFILES[agentId];
      const body = sanitizeDeep(req.body || {}) as { message?: string };
      const message = body.message?.trim();

      if (!profile) {
        res.status(404).json({ message: "Agente não encontrado." });
        return;
      }

      if (!message) {
        res.status(400).json({ message: "Mensagem vazia." });
        return;
      }

      const dashboard = await buildDashboardPayload();
      rememberAgentEvent(agentId, "user", message, "chat");
      const reply = await generateAgentReply(agentId, message, dashboard);
      rememberAgentEvent(agentId, "agent", reply, "chat");

      const agent = buildAgentDetail(profile, dashboard, message);
      res.json({
        reply,
        agent,
        suggestions: {
          nextActions: buildAgentActions(profile),
          suggestedCollaborators: buildAgentCollaborations(profile, dashboard, message),
        },
      });
    } catch (error) {
      console.error("Failed to generate agent reply:", error);
      setAgentStatus(req.params.agentId, "error");
      res.status(500).json({ message: "Falha ao conversar com o agente." });
    }
  });

  // ─── Rituals Config ───────────────────────────────────────────────────────

  const RITUAL_DEFAULTS = [
    {
      id: "reclamacao_10am",
      name: "Reclamação 10h",
      description: "Se ninguém falou nada no canal até as 10h, o Mintzie manda uma provocação de bom dia.",
      schedule: "Seg–Sex às 10:00",
      enabled: false,
    },
    {
      id: "ronronado_surpresa",
      name: "Ronronado Surpresa",
      description: "Eventualmente, entre 14h e 17h, o Mintzie manifesta presença com uma mensagem aleatória e felina.",
      schedule: "Aleatório Seg–Sex 14h–17h",
      enabled: false,
    },
    {
      id: "funcionario_da_semana",
      name: "Funcionário da Semana",
      description: "Toda sexta às 17h, o Mintzie sorteia um sócio e proclama o funcionário da semana.",
      schedule: "Sexta às 17:00",
      enabled: false,
    },
    {
      id: "verificador_de_projetos",
      name: "Verificador de Projetos",
      description: "Todo dia útil às 9h, o Mintzie checa projetos com prazo ultrapassado e dispara alertas.",
      schedule: "Seg–Sex às 9:00",
      enabled: false,
    },
    {
      id: "provocacao_operacional_semana",
      name: "Provocação Operacional (Segunda)",
      description: "Toda segunda às 10h, envia um relatório semanal de tarefas sem dono e projetos travados.",
      schedule: "Segunda às 10:00",
      enabled: false,
    },
    {
      id: "gargalo_da_semana",
      name: "Gargalo da Semana (Quarta)",
      description: "Toda quarta às 15h30, aponta o maior gargalo operacional do laboratório.",
      schedule: "Quarta às 15:30",
      enabled: false,
    },
    {
      id: "socios_sem_tarefa",
      name: "Sócios Sem Tarefa (Terça)",
      description: "Toda terça às 9h30, alerta qualquer sócio com poucas ou nenhuma tarefa ativa.",
      schedule: "Terça às 9:30",
      enabled: false,
    },
    {
      id: "checkin_tarefas_abertas",
      name: "Check-in de Tarefas Abertas",
      description: "Terça e quinta às 15h45, faz check-in individual com cada sócio sobre suas tarefas abertas.",
      schedule: "Ter/Qui às 15:45",
      enabled: false,
    },
    {
      id: "rotina_resumo_diario",
      name: "Resumo Diário",
      description: "Gera um resumo executivo das conversas e tarefas da semana, focado em execução.",
      schedule: "Quarta às 18:00",
      enabled: true,
    },
  ];

  async function ensureRitualsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rituals_config (
        id VARCHAR(100) PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
  }

  app.get("/api/rituals", async (_req, res) => {
    try {
      await ensureRitualsTable();
      const result = await pool.query("SELECT id, enabled FROM rituals_config");
      const overrides = Object.fromEntries(result.rows.map((r: any) => [r.id, r.enabled]));
      const rituals = RITUAL_DEFAULTS.map((r) => ({
        ...r,
        enabled: r.id in overrides ? overrides[r.id] : r.enabled,
      }));
      res.json({ rituals });
    } catch (error) {
      console.error("Failed to fetch rituals config:", error);
      res.status(500).json({ message: "Falha ao buscar configuração de rotinas." });
    }
  });

  app.patch("/api/rituals/:ritualId", async (req, res) => {
    try {
      await ensureRitualsTable();
      const { ritualId } = req.params;
      const { enabled } = req.body as { enabled: boolean };
      if (typeof enabled !== "boolean") {
        res.status(400).json({ message: "Campo 'enabled' deve ser boolean." });
        return;
      }
      await pool.query(
        `INSERT INTO rituals_config (id, enabled) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [ritualId, enabled],
      );
      res.json({ id: ritualId, enabled });
    } catch (error) {
      console.error("Failed to update ritual config:", error);
      res.status(500).json({ message: "Falha ao atualizar rotina." });
    }
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use("/brand", express.static(path.resolve(APP_ROOT, "logo")));
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


