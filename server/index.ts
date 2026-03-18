import express from "express";
import { createServer } from "http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");

const PROJECTS_PATH = "Operacional/Kanban/projetos.json";
const INITIATIVES_PATH = "Operacional/Kanban/iniciativas.json";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "NETZ-FAST-LAB";
const GITHUB_REPO = process.env.GITHUB_REPO || "gestao-netz";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "master";
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || "";

type RawTask = {
  id?: string;
  title?: string;
  assignee?: string;
  responsavel?: string;
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
  memory: AgentMemoryEntry[];
  collaborators: AgentCollaboration[];
  workspace: AgentWorkspace;
  availableActions: string[];
};

const AGENT_PROFILES: Record<string, AgentProfile> = {
  picles: {
    id: "picles",
    name: "Picles",
    role: "Cientista-Chefe",
    ala: "Pesquisa",
    expertise: ["orquestracao", "priorizacao", "sintese executiva"],
    personality: "direto, pragmatico, cortante e obcecado por transformar hipotese em resultado",
    deliveryStyle: "sempre devolva leitura executiva, proposta concreta e ordem de prioridade",
    signatureMove: "amarrar a ideia a impacto operacional real",
  },
  arquimedes: {
    id: "arquimedes",
    name: "Arquimedes",
    role: "Analista de Dados",
    ala: "Pesquisa",
    expertise: ["analise", "metricas", "padroes"],
    personality: "frio, logico e sustentado por evidencia",
    deliveryStyle: "sempre explique padroes, hipoteses e o dado que falta",
    signatureMove: "traduzir ruido em sinal",
  },
  veritas: {
    id: "veritas",
    name: "Veritas",
    role: "Pesquisador Verdadeiro",
    ala: "Pesquisa",
    expertise: ["pesquisa", "checagem", "perguntas dificeis"],
    personality: "cetico, afiado e incapaz de aceitar achismo barato",
    deliveryStyle: "questione premissas e proponha validacao",
    signatureMove: "separar ciencia de truque de magica",
  },
  zola: {
    id: "zola",
    name: "Zola",
    role: "Visionario Temporal",
    ala: "Pesquisa",
    expertise: ["cenarios", "prototipos", "futuro"],
    personality: "visionario, inventivo e encantado com futuros plausiveis",
    deliveryStyle: "conecte o pedido a cenario futuro e experimento imediato",
    signatureMove: "puxar o amanha para a bancada de hoje",
  },
  barnum: {
    id: "barnum",
    name: "Dr. Show",
    role: "Vendarketing",
    ala: "Experimentos de Campo",
    expertise: ["vendas", "marketing", "storytelling"],
    personality: "dramatico, persuasivo e irresistivelmente comercial",
    deliveryStyle: "fale como quem esta lapidando um case ou pitch",
    signatureMove: "transformar resultado em narrativa vendavel",
  },
  zuzu: {
    id: "zuzu",
    name: "Zuzu",
    role: "Antropologa de Campo",
    ala: "Experimentos de Campo",
    expertise: ["usuario", "comportamento", "pesquisa de campo"],
    personality: "empatica, observadora e humana sem ser ingenua",
    deliveryStyle: "parta da dor, do comportamento e do contexto humano",
    signatureMove: "recolocar o usuario no centro da bancada",
  },
  pixel: {
    id: "pixel",
    name: "Pixel",
    role: "Designer Experimental",
    ala: "Experimentos de Campo",
    expertise: ["interface", "ux", "prototipos"],
    personality: "visual, exigente e obcecado por clareza estetica e funcional",
    deliveryStyle: "responda com direcao visual, experiencia e proximos mockups",
    signatureMove: "transformar abstracao em experiencia palpavel",
  },
  lola: {
    id: "lola",
    name: "Lola",
    role: "Narradora Cientifica",
    ala: "Experimentos de Campo",
    expertise: ["copy", "narrativa", "documentacao"],
    personality: "envolvente, articulada e didatica",
    deliveryStyle: "organize a resposta como narrativa com contexto, movimento e acao",
    signatureMove: "dar voz clara a descoberta",
  },
  pipo: {
    id: "pipo",
    name: "Pipo",
    role: "Gerente de Processos",
    ala: "Engenharia",
    expertise: ["processos", "cadencia", "coordenacao"],
    personality: "organizado, firme e alergico a caos mal documentado",
    deliveryStyle: "quebre tudo em fluxo, dono, prazo e dependencia",
    signatureMove: "transformar bagunca em protocolo",
  },
  spark: {
    id: "spark",
    name: "Spark",
    role: "Arquiteto do Codigo",
    ala: "Engenharia",
    expertise: ["arquitetura", "backend", "integracoes"],
    personality: "preciso, tecnico e pouco tolerante a gambiarra",
    deliveryStyle: "responda com arquitetura, trade-offs e implementacao",
    signatureMove: "encaixar a solucao no sistema sem colapsar a bancada",
  },
  gigi: {
    id: "gigi",
    name: "Gigi",
    role: "DevOps Silenciosa",
    ala: "Engenharia",
    expertise: ["deploy", "infra", "estabilidade"],
    personality: "serena, tecnica e focada em robustez operacional",
    deliveryStyle: "priorize confiabilidade, observabilidade e risco operacional",
    signatureMove: "manter o laboratorio vivo sem virar manchete",
  },
  mintz: {
    id: "mintz",
    name: "Mintzie",
    role: "Guardiao Cultural",
    ala: "Seguranca e Etica",
    expertise: ["cultura", "valores", "tom interno"],
    personality: "felino, superior, sarcastico, charmoso e observador",
    deliveryStyle: "fale com ironia elegante, mas entregue cobranca e leitura cultural util",
    signatureMove: "farejar desalinhamento antes da equipe perceber",
  },
  cautela: {
    id: "cautela",
    name: "Dr. Cautela",
    role: "Advogado da Etica",
    ala: "Seguranca e Etica",
    expertise: ["etica", "compliance", "risco"],
    personality: "formal, contido e incapaz de ignorar risco mal tratado",
    deliveryStyle: "aponte limites, riscos e condicao para seguir",
    signatureMove: "evitar que a genialidade vire passivo",
  },
  tiopatinhas: {
    id: "tiopatinhas",
    name: "Professor ROI",
    role: "Gerente Financeiro",
    ala: "Seguranca e Etica",
    expertise: ["receita", "margem", "viabilidade"],
    personality: "pragmatico, curioso e orientado a retorno",
    deliveryStyle: "relacione qualquer pedido a receita, custo e payoff",
    signatureMove: "puxar o projeto de volta para o caixa",
  },
  calculin: {
    id: "calculin",
    name: "Calculin",
    role: "Contador Preciso",
    ala: "Seguranca e Etica",
    expertise: ["custos", "controle", "precisao"],
    personality: "minucioso, literal e tranquilamente obsessivo",
    deliveryStyle: "responda com estrutura, numeros e detalhamento",
    signatureMove: "nao deixar variavel escapar da planilha mental",
  },
};

const AGENT_MEMORY_LIMIT = 18;
const AGENT_RUNTIMES = new Map<string, AgentRuntimeState>();

const AGENT_TOOLBOX: Record<string, AgentToolDescriptor[]> = {
  picles: [
    {
      id: "task-breakdown",
      name: "Fatiador de frentes",
      description: "Quebra uma frente nebulosa em objetivo, dono, prazo e criterio de conclusao.",
      capabilities: ["priorizacao", "sequenciamento", "definicao de proxima acao"],
    },
    {
      id: "lab-brief",
      name: "Sintese de bancada",
      description: "Condensa discussao em leitura executiva e ordem de prioridade.",
      capabilities: ["sintese", "briefing", "decisao"],
    },
  ],
  arquimedes: [
    {
      id: "signal-scan",
      name: "Scanner de sinal",
      description: "Fareja padroes, gargalos e anomalias na operacao.",
      capabilities: ["analise", "metricas", "padroes"],
    },
    {
      id: "hypothesis-check",
      name: "Validador de hipotese",
      description: "Separa correlacao oportunista de evidencia minimamente decente.",
      capabilities: ["validacao", "dados faltantes", "checagem"],
    },
  ],
  veritas: [
    {
      id: "premise-audit",
      name: "Auditoria de premissas",
      description: "Ataca suposicoes frageis antes que virem verdade oficial do laboratorio.",
      capabilities: ["pesquisa", "checagem", "contraponto"],
    },
  ],
  zola: [
    {
      id: "future-probe",
      name: "Sonda temporal",
      description: "Traduz o pedido em cenarios futuros e experimentos pequenos de validacao.",
      capabilities: ["cenario", "prototipo", "futuro"],
    },
  ],
  barnum: [
    {
      id: "offer-crafting",
      name: "Lapidador de oferta",
      description: "Transforma resultado em proposta vendavel com tese e chamada para acao.",
      capabilities: ["copy comercial", "pitch", "proposta"],
    },
  ],
  zuzu: [
    {
      id: "user-reading",
      name: "Leitor de comportamento",
      description: "Traduz o caos humano em dor, gatilho e contexto de uso.",
      capabilities: ["usuario", "entrevista", "insight"],
    },
  ],
  pixel: [
    {
      id: "ui-prototype",
      name: "Bancada visual",
      description: "Desenha a menor interface que ja ajuda a agir.",
      capabilities: ["ui", "ux", "hierarquia"],
    },
  ],
  lola: [
    {
      id: "story-assembler",
      name: "Montadora de narrativa",
      description: "Converte achado cru em historia clara, util e memoravel.",
      capabilities: ["copy", "narrativa", "documentacao"],
    },
  ],
  pipo: [
    {
      id: "protocol-engine",
      name: "Motor de protocolo",
      description: "Costura dono, etapa, dependencia e rito para a operacao sair do improviso.",
      capabilities: ["processos", "cadencia", "governanca"],
    },
    {
      id: "kanban-action",
      name: "Orquestrador de Kanban",
      description: "Transforma decisao em acao operacional no quadro.",
      capabilities: ["tarefas", "status", "responsaveis"],
    },
  ],
  spark: [
    {
      id: "system-architecture",
      name: "Prancheta de arquitetura",
      description: "Desenha contratos, persistencia e integracoes antes de codar por impulso.",
      capabilities: ["backend", "integracoes", "arquitetura"],
    },
  ],
  gigi: [
    {
      id: "deploy-guardian",
      name: "Guardia de deploy",
      description: "Olha risco operacional, ambiente e observabilidade antes de empurrar mudanca.",
      capabilities: ["deploy", "infra", "estabilidade"],
    },
  ],
  mintz: [
    {
      id: "culture-radar",
      name: "Radar cultural",
      description: "Fareja desalinhamento, excesso de atrito e tom torto antes de contaminar o laboratorio.",
      capabilities: ["cultura", "tom", "alinhamento"],
    },
  ],
  cautela: [
    {
      id: "risk-check",
      name: "Triagem de risco",
      description: "Aponta risco etico, juridico e operacional antes da genialidade virar passivo.",
      capabilities: ["risco", "etica", "compliance"],
    },
  ],
  tiopatinhas: [
    {
      id: "roi-lens",
      name: "Lente de ROI",
      description: "Puxa qualquer iniciativa de volta para retorno, custo e margem.",
      capabilities: ["receita", "margem", "viabilidade"],
    },
  ],
  calculin: [
    {
      id: "cost-ledger",
      name: "Livro de custos",
      description: "Traz precisionismo cirurgico para custo, tesouraria e controles.",
      capabilities: ["custos", "controle", "financeiro"],
    },
  ],
};

function repairText(value: string): string {
  if (!value) return value;
  if (!/[ÃƒÆ’Ã†â€™ÃƒÆ’Ã¢â‚¬Å¡ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬]/.test(value)) {
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
  if (["completed", "concluida", "done"].includes(normalized)) return "Concluida";
  if (["in_progress", "em andamento", "doing"].includes(normalized)) return "Em andamento";
  if (["review", "em revisao"].includes(normalized)) return "Em revisao";
  return "Pendente";
}

function mapStatusToRaw(status: string): string {
  const normalized = normalizeName(status);
  if (["concluida", "done", "completed"].includes(normalized)) return "completed";
  if (["em andamento", "in progress", "in_progress"].includes(normalized)) return "in_progress";
  if (["em revisao", "review"].includes(normalized)) return "review";
  return "pending";
}

function buildProgress(tasks: DashboardTask[], column: string): number {
  if (tasks.length === 0) {
    return normalizeName(column).includes("conclu") || normalizeName(column) === "done" ? 100 : 0;
  }

  const completed = tasks.filter((task) => task.status === "Concluida").length;
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
    ["joao", "joao henrique", "joao henrique zborowski scholz", "joao scholz", "joe", "john", "joaozissimo"].includes(
      normalized,
    )
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
        title: task.title || "Sem titulo",
        assignee: getTaskAssignee(task) || "Sem dono",
        status: mappedStatus,
        dueDate: task.dueDate || "",
        overdue: mappedStatus !== "Concluida" && isOverdue(task.dueDate || "", today),
        dueSoon: mappedStatus !== "Concluida" && isWithinDays(task.dueDate || "", today, 7),
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

  const { organization, projectsFile, initiativesFile } = await readBoardFiles();
  const cards = buildCards(projectsFile, initiativesFile);
  const tasks = buildTasks(cards, today);

  const boardCards = cards.map((card) => {
    const cardTasks = tasks.filter((task) => task.contextId === (card.id || ""));
    const openTasks = cardTasks.filter((task) => task.status !== "Concluida").length;

    return {
      id: card.id || "sem-id",
      title: card.title || "Sem titulo",
      type: card.contextType,
      client: card.client || card.owner || "NETZ",
      owner: card.owner || card.client || "Equipe NETZ",
      column: card.column || "Backlog",
      healthStatus: card.health_status || "Sem status",
      tags: card.tags || [],
      progress: buildProgress(cardTasks, card.column || ""),
      totalTasks: cardTasks.length,
      openTasks,
      completedTasks: cardTasks.filter((task) => task.status === "Concluida").length,
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

  const partners = [
    { id: "joao", name: "Joaozissimo", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] as string[] },
    { id: "gui", name: "Gui R.", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] as string[] },
    { id: "denis", name: "Denis", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] as string[] },
    { id: "stacke", name: "Guilherme Stacke", activeTaskCount: 0, overdueTaskCount: 0, dueSoonTaskCount: 0, examples: [] as string[] },
  ];

  for (const task of tasks) {
    const partnerId = getPartnerId(task.assignee);
    if (!partnerId || task.status === "Concluida") continue;
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) continue;

    partner.activeTaskCount += 1;
    if (task.overdue) partner.overdueTaskCount += 1;
    if (task.dueSoon) partner.dueSoonTaskCount += 1;
    if (partner.examples.length < 3) {
      partner.examples.push(`${task.contextTitle}: ${task.title}`);
    }
  }

  return {
    organization,
    generatedAt: new Date().toISOString(),
    summary: {
      totalProjects: boardCards.filter((card) => card.type === "projeto").length,
      totalInitiatives: boardCards.filter((card) => card.type === "iniciativa").length,
      openTasks: tasks.filter((task) => task.status !== "Concluida").length,
      completedTasks: tasks.filter((task) => task.status === "Concluida").length,
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
    return ["Desenhar arquitetura da solucao", "Separar frontend, backend e integracoes"];
  }

  if (profile.id === "pixel") {
    return ["Reorganizar a interface com mais clareza", "Desenhar o fluxo minimo viavel"];
  }

  if (profile.id === "mintz") {
    return ["Refinar linguagem e tom do laboratorio", "Apontar desalinhamento cultural antes de feder"];
  }

  if (profile.id === "tiopatinhas" || profile.id === "calculin") {
    return ["Ler impacto em receita e custo", "Sugerir criterio economico para decidir prioridade"];
  }

  return [
    `Responder pelo recorte de ${profile.expertise.join(", ")}`,
    "Transformar o pedido em proxima acao concreta",
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
    topicFlags.operations ? "Operacao em movimento" : null,
    topicFlags.engineering ? "Arquitetura e integracoes" : null,
    topicFlags.interface ? "Experiencia e interface" : null,
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
        ? `${profile.name} esta com ${rankedTasks.length} frente(s) diretamente conectadas ao seu recorte agora.`
        : `${profile.name} esta livre para puxar uma frente nova sem herdar bagunca alheia.`,
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
    register("spark", "traduz isso para arquitetura e implementacao sem explodir a bancada", "delegar");
    register("pixel", "dar forma visual quando a frente precisar sair do texto", "consultar");
  }

  if (["spark", "gigi"].includes(profile.id)) {
    register("pipo", "alinhar operacao, rito e dono antes do codigo escapar do trilho", "consultar");
    register("cautela", "revisar riscos de integracao e limites do experimento", "revisar");
  }

  if (["pixel", "lola", "zuzu", "barnum"].includes(profile.id)) {
    register("picles", "priorizar o que realmente mexe a agulha antes de polir espuma", "consultar");
    register("spark", "garantir que a experiencia nao prometa o que a pilha nao entrega", "revisar");
  }

  if (["tiopatinhas", "calculin", "cautela"].includes(profile.id)) {
    register("picles", "encaixar criterio economico na priorizacao da bancada", "consultar");
    register("mintz", "alinhar impacto financeiro com o jeito NETZ de operar", "revisar");
  }

  if (topics.interface) {
    register("pixel", "refinar interface e hierarquia do que vai para a tela", "consultar");
    register("lola", "afinar narrativa para a experiencia nao soar generica", "revisar");
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
    register("tiopatinhas", "ler retorno, margem e priorizacao economica", "consultar");
    register("calculin", "validar tesouraria, custo e controle fino", "revisar");
  }

  const dashboardPressure =
    dashboard.summary.overdueTasks > 0 || dashboard.summary.dueSoonTasks > 0
      ? "O laboratorio esta com risco quente; puxe quem ajuda a tirar isso do vermelho."
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
      `${profile.name} pronto na bancada. Recorte quente agora: ${workspace.focus.join(", ") || "observacao geral do laboratorio"}.`,
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
    memory: runtime.memory,
    collaborators: buildAgentCollaborations(profile, dashboard, message),
    workspace: buildAgentWorkspace(profile, dashboard, message),
    availableActions: buildAgentActions(profile),
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
  const fileTargets = [
    { relativePath: PROJECTS_PATH, contextType: "projeto" as const },
    { relativePath: INITIATIVES_PATH, contextType: "iniciativa" as const },
  ];

  const prioritizedTargets =
    updates.contextType != null
      ? fileTargets.filter((target) => target.contextType === updates.contextType)
      : fileTargets;

  for (const target of prioritizedTargets) {
    const boardFile = await readJsonFile<BoardFile>(target.relativePath);

    for (const board of boardFile.boards || []) {
      for (const card of board.cards || []) {
        if (updates.contextId && card.id !== updates.contextId) continue;

        const task = (card.tasks || []).find((item) => item.id === taskId);
        if (!task) continue;

        if (typeof updates.title === "string") {
          task.title = updates.title.trim() || task.title || "Sem titulo";
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
        const githubSynced = await syncJsonFileToGithub(
          target.relativePath,
          boardFile,
          `chore(kanban): atualiza tarefa ${task.id} via copilotx`,
        ).catch((error) => {
          console.error("Failed to sync task update to GitHub:", error);
          return false;
        });

        return { githubSynced };
      }
    }
  }

  return null;
}

async function createTaskInContext(input: TaskCreatePayload) {
  const contextId = input.contextId?.trim();
  const contextType = input.contextType;
  const title = input.title?.trim();

  if (!contextId || !contextType || !title) {
    throw new Error("Dados insuficientes para criar tarefa.");
  }

  const target = contextType === "projeto" ? { relativePath: PROJECTS_PATH } : { relativePath: INITIATIVES_PATH };
  const boardFile = await readJsonFile<BoardFile>(target.relativePath);

  for (const board of boardFile.boards || []) {
    for (const card of board.cards || []) {
      if (card.id !== contextId) continue;

      const trimmedAssignee = input.assignee?.trim() || "";
      const newTaskId = `task-${contextId}-${randomUUID().slice(0, 8)}`;
      const newTask: RawTask = {
        id: newTaskId,
        title,
        assignee: trimmedAssignee,
        responsavel: trimmedAssignee,
        status: mapStatusToRaw(input.status || "Pendente"),
        dueDate: input.dueDate?.trim() || "",
      };

      card.tasks = [...(card.tasks || []), newTask];

      await writeJsonFile(target.relativePath, boardFile);
      const githubSynced = await syncJsonFileToGithub(
        target.relativePath,
        boardFile,
        `feat(kanban): cria tarefa ${newTask.id} via copilotx`,
      ).catch((error) => {
        console.error("Failed to sync task creation to GitHub:", error);
        return false;
      });

      return { taskId: newTaskId, githubSynced };
    }
  }

  return null;
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

  return [
    `Voce e ${profile.name}, ${profile.role} da ala ${profile.ala} do Laboratorio Maluco da NETZ.`,
    `Sua personalidade e: ${profile.personality}.`,
    `Sua especialidade principal e: ${profile.expertise.join(", ")}.`,
    `Seu jeito de responder: ${profile.deliveryStyle}.`,
    `Seu movimento caracteristico e: ${profile.signatureMove}.`,
    "Responda sempre em portugues do Brasil.",
    "Nao aja como assistente generico.",
    "Fale em primeira pessoa, encarnando o agente.",
    "Seja especifico, util e orientado a acao.",
    `Estado atual do laboratorio: ${context.summary.openTasks} tarefas abertas, ${context.summary.overdueTasks} em risco de explosao, ${context.summary.totalProjects} projetos e ${context.summary.totalInitiatives} experimentos internos.`,
    context.criticalTasks.length > 0 ? `Riscos quentes agora: ${context.criticalTasks.join(" | ")}.` : "Nao ha riscos quentes destacados agora.",
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
    interface: /site|ux|ui|dashboard|layout|design|interface|landing/.test(normalized),
    operations: /tarefa|kanban|prazo|responsavel|status|processo|fluxo|backlog/.test(normalized),
    engineering: /api|backend|codigo|deploy|bug|integracao|banco inter|webhook|infra/.test(normalized),
    finance: /receita|caixa|margem|tesouraria|orcamento|custo|roi|banco/.test(normalized),
  };
}

function buildFallbackMoves(profile: AgentProfile, message: string) {
  const topics = detectTopics(message);

  if (profile.id === "picles") {
    return [
      "eu cortaria a nevoa e definiria um unico objetivo operacional",
      topics.operations
        ? "eu quebraria isso em tarefa, dono, prazo e criterio de conclusao"
        : "eu conectaria a ideia ao resultado que a NETZ quer ver no trimestre",
      "eu escolheria o proximo movimento que destrava o resto da bancada",
    ];
  }

  if (profile.id === "spark") {
    return [
      "eu separaria o que e interface, o que e backend e o que e integracao",
      topics.engineering
        ? "eu desenharia rota, persistencia e contrato de dados antes de codar"
        : "eu evitaria remendo bonito que explode na proxima iteracao",
      "eu escolheria a implementacao menor que ainda sustenta evolucao",
    ];
  }

  if (profile.id === "mintz") {
    return [
      "eu observaria se isso fortalece ou desgasta o jeito NETZ de trabalhar",
      "eu apararia arestas de linguagem, postura e alinhamento entre as pessoas",
      "eu cobraria uma acao concreta sem perder o charme felino que voces claramente precisam",
    ];
  }

  if (profile.id === "pixel") {
    return [
      "eu reduziria a interface ao minimo que ajuda a agir",
      topics.interface
        ? "eu organizaria a tela em hierarquia, clareza e chamada para acao"
        : "eu transformaria a ideia em fluxo visivel, nao em bloco de texto",
      "eu prototiparia primeiro o trecho onde a friccao esta mais feia",
    ];
  }

  if (profile.id === "tiopatinhas") {
    return [
      "eu perguntaria qual retorno isso promete e em quanto tempo",
      "eu compararia esforco, custo e valor capturavel",
      "eu puxaria a conversa para receita, margem e prioridade economica",
    ];
  }

  return [
    `eu responderia usando meu recorte de ${profile.expertise.join(", ")}`,
    "eu transformaria a ideia em proxima acao concreta",
    "eu deixaria claro o que depende de voce e o que ja pode ir para o Kanban",
  ];
}

function buildFallbackOpening(profile: AgentProfile, message: string) {
  const trimmed = message.trim();

  if (profile.id === "mintz") {
    return `Voce me trouxe "${trimmed}". Naturalmente sobrou para o felino superior aqui farejar se isso e visao ou bagunca.`;
  }

  if (profile.id === "picles") {
    return `Li seu pedido sobre "${trimmed}". Vou poupar o laboratorio da enrolacao e cortar direto para o que move a bancada.`;
  }

  if (profile.id === "spark") {
    return `Sobre "${trimmed}": antes de qualquer entusiasmo, eu olho arquitetura, contrato e persistencia.`;
  }

  return `Recebi seu pedido sobre "${trimmed}". Vou responder como ${profile.name}, nao como assistente generico domesticado.`;
}

function buildFallbackAgentReply(profile: AgentProfile, message: string, dashboard: DashboardPayload) {
  const moves = buildFallbackMoves(profile, message);

  return [
    buildFallbackOpening(profile, message),
    `Agora o laboratorio esta com ${dashboard.summary.openTasks} tarefas abertas, ${dashboard.summary.overdueTasks} em risco de explosao e ${dashboard.summary.totalInitiatives} experimentos internos correndo em paralelo.`,
    "Eu seguiria em 3 movimentos:",
    `1. ${moves[0]}.`,
    `2. ${moves[1]}.`,
    `3. ${moves[2]}.`,
    "Se quiser, eu posso transformar isso na proxima acao operacional exata para o CopilotX ou para o Kanban.",
  ].join("\n");
}

async function generateAgentReply(agentId: string, userMessage: string, dashboard: DashboardPayload) {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) {
    throw new Error("Agente nao encontrado.");
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
        res.status(404).json({ message: "Tarefa nao encontrada nesse contexto." });
        return;
      }

      const payload = await buildDashboardPayload();
      const updatedTask = payload.tasks.find((task) => task.id === taskId && task.contextId === updates.contextId);

      res.json({
        message: taskUpdate.githubSynced
          ? "Tarefa atualizada e sincronizada com o GitHub."
          : "Tarefa atualizada na instancia atual. Para persistir entre deploys, configure GITHUB_TOKEN no copilotx.",
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
        res.status(404).json({ message: "Contexto nao encontrado para criar a tarefa." });
        return;
      }

      const payload = await buildDashboardPayload();
      const createdTask = payload.tasks.find(
        (task) => task.id === created.taskId && task.contextId === input.contextId,
      );

      res.status(201).json({
        message: created.githubSynced
          ? "Tarefa criada e sincronizada com o GitHub."
          : "Tarefa criada na instancia atual. Para persistir entre deploys, configure GITHUB_TOKEN no copilotx.",
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
      res.status(500).json({ message: "Falha ao carregar a estacao multiagente." });
    }
  });

  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const agentId = req.params.agentId;
      const profile = AGENT_PROFILES[agentId];

      if (!profile) {
        res.status(404).json({ message: "Agente nao encontrado." });
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
        res.status(404).json({ message: "Agente nao encontrado." });
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
          suggestedCollaborators: agent.collaborators,
        },
      });
    } catch (error) {
      console.error("Failed to generate agent reply:", error);
      setAgentStatus(req.params.agentId, "error");
      res.status(500).json({ message: "Falha ao conversar com o agente." });
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
