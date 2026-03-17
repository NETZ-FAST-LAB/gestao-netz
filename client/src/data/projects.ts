// Banco de Projetos da NETZ

export interface Project {
  id: string;
  name: string;
  description: string;
  client: string;
  ala: "pesquisa" | "experimentos" | "engenharia" | "seguranca";
  status: "proposta" | "em-progresso" | "finalizado" | "pausado";
  startDate: string;
  endDate: string;
  budget: number;
  progress: number;
  team: string[];
  type: "poc" | "implementacao" | "squad" | "consultoria";
  tags: string[];
}

export const projects: Project[] = [
  {
    id: "proj-1",
    name: "CORSAN/AEGEA — IA para Gestão de Infraestrutura",
    description: "Implementação de soluções de IA para otimização de operações em infraestrutura hídrica",
    client: "CORSAN + AEGEA",
    ala: "pesquisa",
    status: "em-progresso",
    startDate: "2026-02-01",
    endDate: "2026-05-31",
    budget: 85000,
    progress: 60,
    team: ["Denis", "Arquimedes", "Spark"],
    type: "implementacao",
    tags: ["IA", "Infraestrutura", "Microsoft", "FINEP"]
  },
  {
    id: "proj-2",
    name: "Squad VIEX — Desenvolvimento Web",
    description: "Squad dedicado para desenvolvimento de plataforma web para VIEX",
    client: "VIEX",
    ala: "engenharia",
    status: "em-progresso",
    startDate: "2026-01-15",
    endDate: "2026-06-30",
    budget: 45000,
    progress: 45,
    team: ["Guilherme Roennau", "Spark", "Gigi"],
    type: "squad",
    tags: ["Web", "Squad", "Desenvolvimento"]
  },
  {
    id: "proj-3",
    name: "PoC — Chatbot IA para Cooperativas",
    description: "Prova de conceito de chatbot inteligente para atendimento em cooperativas",
    client: "Cooperativa Sicredi",
    ala: "experimentos",
    status: "em-progresso",
    startDate: "2026-02-15",
    endDate: "2026-04-15",
    budget: 25000,
    progress: 75,
    team: ["Denis", "Zuzu", "Pixel"],
    type: "poc",
    tags: ["IA", "Chatbot", "Cooperativas"]
  },
  {
    id: "proj-4",
    name: "Consultoria — Transformação Digital Microsoft",
    description: "Consultoria estratégica para empresas em transformação digital no ecossistema Microsoft",
    client: "Microsoft Partners",
    ala: "pesquisa",
    status: "proposta",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    budget: 35000,
    progress: 0,
    team: ["João", "Arquimedes", "Veritas"],
    type: "consultoria",
    tags: ["Consultoria", "Microsoft", "Transformação Digital"]
  },
  {
    id: "proj-5",
    name: "Website Institucional NETZ",
    description: "Redesign e otimização do website institucional da NETZ",
    client: "NETZ",
    ala: "experimentos",
    status: "em-progresso",
    startDate: "2026-02-01",
    endDate: "2026-04-30",
    budget: 18000,
    progress: 55,
    team: ["Guilherme Stacke", "Pixel", "Lola"],
    type: "implementacao",
    tags: ["Design", "Web", "Branding"]
  },
  {
    id: "proj-6",
    name: "Implementação IA — Análise de Dados para Startup",
    description: "Implementação de pipeline de IA para análise preditiva de dados",
    client: "StartupXYZ",
    ala: "engenharia",
    status: "pausado",
    startDate: "2026-01-20",
    endDate: "2026-05-20",
    budget: 42000,
    progress: 30,
    team: ["Denis", "Spark", "Arquimedes"],
    type: "implementacao",
    tags: ["IA", "Data Science", "Startup"]
  }
];

export const getProjectsByStatus = (status: string) => {
  return projects.filter(p => p.status === status);
};

export const getProjectsByAla = (alaId: string) => {
  return projects.filter(p => p.ala === alaId);
};

export const getProjectsByType = (type: string) => {
  return projects.filter(p => p.type === type);
};

export const getTotalProjectValue = () => {
  return projects.reduce((sum, p) => sum + p.budget, 0);
};

export const getActiveProjectsValue = () => {
  return projects
    .filter(p => p.status === "em-progresso" || p.status === "proposta")
    .reduce((sum, p) => sum + p.budget, 0);
};
