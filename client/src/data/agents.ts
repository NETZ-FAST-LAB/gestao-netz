// Dados dos 15 agentes do Laboratório Maluco da NETZ

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
    id: "picles",
    name: "Picles",
    role: "Cientista-Chefe",
    ala: "pesquisa",
    emoji: "🥒",
    color: "from-green-400 to-emerald-600",
    description: "Orquestrador que conecta pesquisas e engenharia, garantindo que toda hipótese cause impacto real.",
    expertise: ["Orquestração", "Síntese", "Pragmatismo"]
  },
  {
    id: "arquimedes",
    name: "Arquimedes",
    role: "Analista de Dados",
    ala: "pesquisa",
    emoji: "🏛️",
    color: "from-blue-400 to-cyan-600",
    description: "Guardião dos fatos e números frios, alquimista dos dados que filtra ruído e extrai ouro.",
    expertise: ["Análise", "Padrões", "Alquimia de Dados"]
  },
  {
    id: "veritas",
    name: "Veritas",
    role: "Pesquisador Verdadeiro",
    ala: "pesquisa",
    emoji: "🔍",
    color: "from-indigo-400 to-purple-600",
    description: "Microscópio que escarafuncha cada dado, determinando se algo é ciência ou apenas um truque.",
    expertise: ["Pesquisa", "Verificação", "Ceticismo Científico"]
  },
  {
    id: "zola",
    name: "Zola",
    role: "Visionário Temporal",
    ala: "pesquisa",
    emoji: "🔮",
    color: "from-violet-400 to-pink-600",
    description: "Explorador de hipóteses futuras, materializa futuros possíveis em provetas laboratoriais.",
    expertise: ["Visão Futura", "Prototipagem", "Inovação"]
  },
  {
    id: "barnum",
    name: "Dr. Show",
    role: "Vendarketing",
    ala: "experimentos",
    emoji: "🎪",
    color: "from-orange-400 to-red-600",
    description: "Transforma dados e testes em histórias cativantes, mostrando resultados tangíveis sem fumaça.",
    expertise: ["Vendas", "Marketing", "Storytelling"]
  },
  {
    id: "zuzu",
    name: "Zuzu",
    role: "Antropóloga de Campo",
    ala: "experimentos",
    emoji: "👩‍🔬",
    color: "from-rose-400 to-pink-600",
    description: "Empatia aguçada, estuda quem usa e traduz complexidade humana para cientistas ensandecidos.",
    expertise: ["Empatia", "UX Research", "Comportamento"]
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Designer Experimental",
    ala: "experimentos",
    emoji: "🎨",
    color: "from-cyan-400 to-blue-600",
    description: "Cria protótipos visuais que conectam ciência e arte, tornando inovação palpável e intuitiva.",
    expertise: ["Design", "UX/UI", "Prototipagem Visual"]
  },
  {
    id: "lola",
    name: "Lola",
    role: "Narradora Científica",
    ala: "experimentos",
    emoji: "📖",
    color: "from-amber-400 to-yellow-600",
    description: "Costura narrativas que explicam descobertas, ponte entre dados frios e corações humanos.",
    expertise: ["Narrativa", "Comunicação", "Documentação"]
  },
  {
    id: "pipo",
    name: "Pipo",
    role: "Gerente de Processos",
    ala: "engenharia",
    emoji: "🗂️",
    color: "from-lime-400 to-green-600",
    description: "Harmoniza fluxo de experimentos e projetos, transformando caos criativo em protocolos confiáveis.",
    expertise: ["Gestão", "Processos", "Organização"]
  },
  {
    id: "spark",
    name: "Spark",
    role: "Arquiteto do Código",
    ala: "engenharia",
    emoji: "💻",
    color: "from-teal-400 to-cyan-600",
    description: "Arquiteto da infraestrutura invisível que possibilita testes, simulações e protótipos digitais.",
    expertise: ["Arquitetura", "Backend", "Infraestrutura"]
  },
  {
    id: "gigi",
    name: "Gigi (Gigabyte)",
    role: "DevOps Silenciosa",
    ala: "engenharia",
    emoji: "🛠️",
    color: "from-slate-400 to-gray-600",
    description: "Motor silencioso do laboratório, mantém infraestrutura estável e capaz para caos controlado.",
    expertise: ["DevOps", "Infraestrutura", "Estabilidade"]
  },
  {
    id: "mintz",
    name: "Mintzie",
    role: "Guardião Cultural",
    ala: "seguranca",
    emoji: "🐱",
    color: "from-orange-400 to-amber-600",
    description: "Oráculo Felino que preserva DNA da NETZ, alerta para riscos invisíveis e promove harmonia.",
    expertise: ["Cultura", "Valores", "Sensibilidade"]
  },
  {
    id: "cautela",
    name: "Dr. Cautela",
    role: "Advogado da Ética",
    ala: "seguranca",
    emoji: "⚖️",
    color: "from-red-400 to-rose-600",
    description: "Mestre da Segurança e Ética, assegura que cada experimento respeita protocolos e humanidade.",
    expertise: ["Ética", "Compliance", "Segurança"]
  },
  {
    id: "tiopatinhas",
    name: "Professor ROI",
    role: "Gerente Financeiro",
    ala: "seguranca",
    emoji: "💰",
    color: "from-yellow-400 to-amber-600",
    description: "Aplica fórmulas rigorosas para garantir que invenções malucas fazem sentido nos números.",
    expertise: ["Finanças", "ROI", "Pragmatismo"]
  },
  {
    id: "calculin",
    name: "Calculín",
    role: "Contador Preciso",
    ala: "seguranca",
    emoji: "🔢",
    color: "from-green-400 to-lime-600",
    description: "Tradutor fiel e minucioso, monitora custos e investimentos com precisão cirúrgica.",
    expertise: ["Contabilidade", "Precisão", "Controle"]
  }
];

export const alas = [
  {
    id: "pesquisa",
    name: "Ala de Pesquisa",
    description: "Inteligência, análise e visão futura",
    color: "from-blue-500 to-purple-600",
    icon: "🔬"
  },
  {
    id: "experimentos",
    name: "Ala de Experimentos de Campo",
    description: "Criação, design e narrativa",
    color: "from-orange-500 to-pink-600",
    icon: "🧪"
  },
  {
    id: "engenharia",
    name: "Ala de Engenharia",
    description: "Código, infraestrutura e operação",
    color: "from-teal-500 to-cyan-600",
    icon: "⚙️"
  },
  {
    id: "seguranca",
    name: "Ala de Segurança e Ética",
    description: "Cultura, compliance e finanças",
    color: "from-red-500 to-yellow-600",
    icon: "🛡️"
  }
];

export const getAgentsByAla = (alaId: string) => {
  return agents.filter(agent => agent.ala === alaId);
};

export const getAgent = (agentId: string) => {
  return agents.find(agent => agent.id === agentId);
};
