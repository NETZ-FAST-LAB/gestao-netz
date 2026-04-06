export interface Agent {
  id: string;
  name: string;
  role: string;
  ala: "pesquisa" | "experimentos" | "engenharia" | "seguranca";
  emoji: string;
  color: string;
  description: string;
  expertise: string[];
}

export const agents: Agent[] = [
  {
    id: "mintz",
    name: "Mintzie",
    role: "Guardião Cultural e Operacional",
    ala: "seguranca",
    emoji: "🐱",
    color: "from-orange-400 to-amber-600",
    description: "Fareja desalinhamento, protege o tom da casa e cobra sem perder a elegância felina.",
    expertise: ["Cultura", "Tom", "Alinhamento", "Gestão de Tarefas"],
  },
];

export const alas = [
  {
    id: "pesquisa",
    name: "Ala de Pesquisa",
    description: "Intelig\u00eancia, an\u00e1lise e vis\u00e3o futura",
    color: "from-blue-500 to-purple-600",
    icon: "\ud83d\udd2c",
  },
  {
    id: "experimentos",
    name: "Ala de Experimentos de Campo",
    description: "Cria\u00e7\u00e3o, design e narrativa",
    color: "from-orange-500 to-pink-600",
    icon: "\ud83e\uddea",
  },
  {
    id: "engenharia",
    name: "Ala de Engenharia",
    description: "C\u00f3digo, infraestrutura e opera\u00e7\u00e3o",
    color: "from-teal-500 to-cyan-600",
    icon: "\u2699\ufe0f",
  },
  {
    id: "seguranca",
    name: "Ala de Seguran\u00e7a e \u00c9tica",
    description: "Cultura, compliance e finan\u00e7as",
    color: "from-red-500 to-yellow-600",
    icon: "\ud83d\udee1\ufe0f",
  },
];

export const getAgentsByAla = (alaId: string) => agents.filter((agent) => agent.ala === alaId);

export const getAgent = (agentId: string) => agents.find((agent) => agent.id === agentId);
