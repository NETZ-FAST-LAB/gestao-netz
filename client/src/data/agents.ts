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
    emoji: "\ud83e\udd52",
    color: "from-green-400 to-emerald-600",
    description: "Orquestra a bancada, conecta pesquisa com engenharia e corta a n\u00e9voa at\u00e9 sobrar decis\u00e3o.",
    expertise: ["Orquestra\u00e7\u00e3o", "S\u00edntese", "Pragmatismo"],
  },
  {
    id: "arquimedes",
    name: "Arquimedes",
    role: "Analista de Dados",
    ala: "pesquisa",
    emoji: "\ud83c\udfdb\ufe0f",
    color: "from-blue-400 to-cyan-600",
    description: "Fareja padr\u00e3o, separa ru\u00eddo de sinal e transforma dados soltos em leitura \u00fatil.",
    expertise: ["An\u00e1lise", "Padr\u00f5es", "Alquimia de dados"],
  },
  {
    id: "veritas",
    name: "Veritas",
    role: "Pesquisador Verdadeiro",
    ala: "pesquisa",
    emoji: "\ud83d\udd0d",
    color: "from-indigo-400 to-purple-600",
    description: "Ataca premissas fr\u00e1geis e n\u00e3o deixa truque de palco passar por ci\u00eancia.",
    expertise: ["Pesquisa", "Verifica\u00e7\u00e3o", "Ceticismo cient\u00edfico"],
  },
  {
    id: "zola",
    name: "Zola",
    role: "Vision\u00e1rio Temporal",
    ala: "pesquisa",
    emoji: "\ud83d\udd2e",
    color: "from-violet-400 to-pink-600",
    description: "Puxa hip\u00f3teses do amanh\u00e3 para experimentos pequenos, plaus\u00edveis e acion\u00e1veis hoje.",
    expertise: ["Vis\u00e3o futura", "Prot\u00f3tipos", "Inova\u00e7\u00e3o"],
  },
  {
    id: "barnum",
    name: "Dr. Show",
    role: "Vendarketing",
    ala: "experimentos",
    emoji: "\ud83c\udfaa",
    color: "from-orange-400 to-red-600",
    description: "Transforma resultado em hist\u00f3ria vend\u00e1vel e faz a oferta soar inevit\u00e1vel.",
    expertise: ["Vendas", "Marketing", "Storytelling"],
  },
  {
    id: "zuzu",
    name: "Zuzu",
    role: "Antrop\u00f3loga de Campo",
    ala: "experimentos",
    emoji: "\ud83d\udc69\u200d\ud83d\udd2c",
    color: "from-rose-400 to-pink-600",
    description: "Recoloca o humano no centro da bancada quando a equipe come\u00e7a a falar s\u00f3 com a pr\u00f3pria cabe\u00e7a.",
    expertise: ["Empatia", "Pesquisa de campo", "Comportamento"],
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Designer Experimental",
    ala: "experimentos",
    emoji: "\ud83c\udfa8",
    color: "from-cyan-400 to-blue-600",
    description: "Organiza a interface para que a experi\u00eancia pare\u00e7a clara, intencional e viva.",
    expertise: ["Design", "UX/UI", "Prot\u00f3tipos"],
  },
  {
    id: "lola",
    name: "Lola",
    role: "Narradora Cient\u00edfica",
    ala: "experimentos",
    emoji: "\ud83d\udcd6",
    color: "from-amber-400 to-yellow-600",
    description: "Costura contexto, movimento e mensagem at\u00e9 a descoberta virar narrativa memor\u00e1vel.",
    expertise: ["Narrativa", "Comunica\u00e7\u00e3o", "Documenta\u00e7\u00e3o"],
  },
  {
    id: "pipo",
    name: "Pipo",
    role: "Gerente de Processos",
    ala: "engenharia",
    emoji: "\ud83d\uddc2\ufe0f",
    color: "from-lime-400 to-green-600",
    description: "Transforma caos criativo em rito, dono, prazo e protocolo confi\u00e1vel.",
    expertise: ["Gest\u00e3o", "Processos", "Organiza\u00e7\u00e3o"],
  },
  {
    id: "spark",
    name: "Spark",
    role: "Arquiteto do C\u00f3digo",
    ala: "engenharia",
    emoji: "\ud83d\udcbb",
    color: "from-teal-400 to-cyan-600",
    description: "Encaixa a solu\u00e7\u00e3o na pilha sem prometer magia nem criar passivo t\u00e9cnico.",
    expertise: ["Arquitetura", "Backend", "Integra\u00e7\u00f5es"],
  },
  {
    id: "gigi",
    name: "Gigi",
    role: "DevOps Silenciosa",
    ala: "engenharia",
    emoji: "\ud83d\udee0\ufe0f",
    color: "from-slate-400 to-gray-600",
    description: "Segura deploy, ambiente e estabilidade para o laborat\u00f3rio continuar vivo sem teatro.",
    expertise: ["DevOps", "Infraestrutura", "Estabilidade"],
  },
  {
    id: "mintz",
    name: "Mintzie",
    role: "Guardi\u00e3o Cultural",
    ala: "seguranca",
    emoji: "\ud83d\udc31",
    color: "from-orange-400 to-amber-600",
    description: "Fareja desalinhamento, protege o tom da casa e cobra sem perder a eleg\u00e2ncia felina.",
    expertise: ["Cultura", "Tom", "Alinhamento"],
  },
  {
    id: "cautela",
    name: "Dr. Cautela",
    role: "Advogado da \u00c9tica",
    ala: "seguranca",
    emoji: "\u2696\ufe0f",
    color: "from-red-400 to-rose-600",
    description: "Aponta risco, limite e condi\u00e7\u00e3o de seguran\u00e7a antes da genialidade virar passivo.",
    expertise: ["\u00c9tica", "Compliance", "Risco"],
  },
  {
    id: "tiopatinhas",
    name: "Tio Patinhas",
    role: "Gerente Financeiro",
    ala: "seguranca",
    emoji: "\ud83d\udcb0",
    color: "from-yellow-400 to-amber-600",
    description: "Puxa qualquer iniciativa para retorno, margem, caixa e viabilidade econ\u00f4mica.",
    expertise: ["Finan\u00e7as", "ROI", "Prioriza\u00e7\u00e3o econ\u00f4mica"],
  },
  {
    id: "calculin",
    name: "Calcul\u00edn",
    role: "Contador Preciso",
    ala: "seguranca",
    emoji: "\ud83d\udd22",
    color: "from-green-400 to-lime-600",
    description: "Faz o controle fino de custos e garante que nenhuma vari\u00e1vel escape da conta.",
    expertise: ["Contabilidade", "Precis\u00e3o", "Controle"],
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
