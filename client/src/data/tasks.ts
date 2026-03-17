// Dados das tarefas prioritárias do Canvas consolidado

export interface Task {
  id: string;
  title: string;
  description: string;
  mestre: "joao" | "guilherme-r" | "denis" | "guilherme-s";
  ala: "pesquisa" | "experimentos" | "engenharia" | "seguranca";
  priority: "alta" | "media" | "baixa";
  status: "planejamento" | "em-progresso" | "concluida";
  deadline?: string;
  progress?: number;
}

export const tasks: Task[] = [
  // Tarefas do João (Inovação)
  {
    id: "task-1",
    title: "Estruturar processo comercial",
    description: "Formalizar metodologias de inovação e governança de IA para padronização interna",
    mestre: "joao",
    ala: "pesquisa",
    priority: "alta",
    status: "em-progresso",
    deadline: "2026-04-30",
    progress: 45
  },
  {
    id: "task-2",
    title: "Ampliar presença em eventos",
    description: "Desenvolver ações para fortalecer networking e captação em eventos do setor",
    mestre: "joao",
    ala: "experimentos",
    priority: "alta",
    status: "planejamento",
    deadline: "2026-05-15",
    progress: 0
  },
  {
    id: "task-3",
    title: "Estruturar newsletter",
    description: "Definir conteúdo e periodicidade para newsletter, coordenando com Design e IA",
    mestre: "joao",
    ala: "experimentos",
    priority: "media",
    status: "planejamento",
    deadline: "2026-04-15",
    progress: 20
  },
  // Tarefas do Guilherme Roennau (Engenharia)
  {
    id: "task-4",
    title: "Implementar controle financeiro",
    description: "Ferramentas e processos para gestão de custos, pro-labore e previsibilidade",
    mestre: "guilherme-r",
    ala: "engenharia",
    priority: "alta",
    status: "em-progresso",
    deadline: "2026-04-30",
    progress: 60
  },
  {
    id: "task-5",
    title: "Otimizar stack tecnológico",
    description: "Melhorias e automações para aumentar eficiência em entregas de sistemas web",
    mestre: "guilherme-r",
    ala: "engenharia",
    priority: "media",
    status: "em-progresso",
    deadline: "2026-05-31",
    progress: 35
  },
  {
    id: "task-6",
    title: "Criar modelos de contratos",
    description: "Propostas comerciais alinhadas aos diferentes serviços (PoC, squads, projetos)",
    mestre: "guilherme-r",
    ala: "seguranca",
    priority: "media",
    status: "planejamento",
    deadline: "2026-05-15",
    progress: 0
  },
  // Tarefas do Denis (IA)
  {
    id: "task-7",
    title: "Implantar governança de IA",
    description: "Frameworks para compliance, segurança e qualidade nas soluções entregues",
    mestre: "denis",
    ala: "pesquisa",
    priority: "alta",
    status: "em-progresso",
    deadline: "2026-04-30",
    progress: 50
  },
  {
    id: "task-8",
    title: "Criar catálogo de produtos IA",
    description: "Produtos e PoCs de IA padronizados para rápida adaptação a múltiplos clientes",
    mestre: "denis",
    ala: "pesquisa",
    priority: "alta",
    status: "planejamento",
    deadline: "2026-05-31",
    progress: 25
  },
  {
    id: "task-9",
    title: "Integrar IA em squads",
    description: "Colaboração com Design e Engenharia para ampliar oferta de soluções inovadoras",
    mestre: "denis",
    ala: "engenharia",
    priority: "media",
    status: "planejamento",
    deadline: "2026-06-15",
    progress: 0
  },
  // Tarefas do Guilherme Stacke (Design)
  {
    id: "task-10",
    title: "Desenvolver canais digitais",
    description: "Visual e UX dos canais (site, Instagram, newsletter) para melhor conversão",
    mestre: "guilherme-s",
    ala: "experimentos",
    priority: "alta",
    status: "em-progresso",
    deadline: "2026-05-15",
    progress: 40
  },
  {
    id: "task-11",
    title: "Implementar Squad as a Service",
    description: "Modelo com entregas visuais consistentes, processos ágeis e alto engajamento",
    mestre: "guilherme-s",
    ala: "experimentos",
    priority: "alta",
    status: "em-progresso",
    deadline: "2026-06-30",
    progress: 30
  },
  {
    id: "task-12",
    title: "Criar assets de marketing",
    description: "Gráficos e apresentações que reforçam proposta de valor para segmentos",
    mestre: "guilherme-s",
    ala: "experimentos",
    priority: "media",
    status: "planejamento",
    deadline: "2026-05-31",
    progress: 15
  }
];

export const mestres = [
  {
    id: "joao",
    name: "João",
    role: "Mestre da Inovação",
    color: "from-emerald-500 to-teal-600",
    icon: "🧠"
  },
  {
    id: "guilherme-r",
    name: "Guilherme Roennau",
    role: "Mestre da Engenharia",
    color: "from-cyan-500 to-blue-600",
    icon: "⚙️"
  },
  {
    id: "denis",
    name: "Denis",
    role: "Mestre da IA",
    color: "from-purple-500 to-indigo-600",
    icon: "🤖"
  },
  {
    id: "guilherme-s",
    name: "Guilherme Stacke",
    role: "Mestre do Design",
    color: "from-pink-500 to-rose-600",
    icon: "🎨"
  }
];

export const getTasksByMestre = (mestreId: string) => {
  return tasks.filter(task => task.mestre === mestreId);
};

export const getTasksByStatus = (status: string) => {
  return tasks.filter(task => task.status === status);
};

export const getHighPriorityTasks = () => {
  return tasks.filter(task => task.priority === "alta").slice(0, 5);
};
