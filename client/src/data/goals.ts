// Dados das metas trimestrais da NETZ

export interface Goal {
  id: string;
  month: number;
  monthName: string;
  targetRevenue: number; // em reais
  targetCosts: number; // 15% da receita
  targetNetRevenue: number; // receita - custos
  currentRevenue: number;
  currentCosts: number;
  status: "planejamento" | "em-progresso" | "concluida";
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "finep" | "sebrae" | "projeto" | "interno";
  status: "planejado" | "em-progresso" | "concluido";
}

// Meta: R$ 48k por mês x 4 meses = R$ 192k
// Custos: 15% = R$ 28.8k
// Receita líquida: R$ 163.2k

const MONTHLY_TARGET = 48000;
const COST_PERCENTAGE = 0.15;

export const goals: Goal[] = [
  {
    id: "goal-1",
    month: 1,
    monthName: "Janeiro",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 32000,
    currentCosts: Math.round(32000 * COST_PERCENTAGE),
    status: "em-progresso"
  },
  {
    id: "goal-2",
    month: 2,
    monthName: "Fevereiro",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 28000,
    currentCosts: Math.round(28000 * COST_PERCENTAGE),
    status: "em-progresso"
  },
  {
    id: "goal-3",
    month: 3,
    monthName: "Março",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 0,
    currentCosts: 0,
    status: "planejamento"
  },
  {
    id: "goal-4",
    month: 4,
    monthName: "Abril",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 0,
    currentCosts: 0,
    status: "planejamento"
  }
];

export const milestones: Milestone[] = [
  {
    id: "milestone-1",
    title: "Lançamento SEBRAE Unio",
    description: "Parceria oficial com SEBRAE para programas de inovação",
    date: "2026-03-31",
    type: "sebrae",
    status: "em-progresso"
  },
  {
    id: "milestone-2",
    title: "Submissão FINEP",
    description: "Envio de propostas para o programa FINEP (R$300M)",
    date: "2026-04-15",
    type: "finep",
    status: "planejado"
  },
  {
    id: "milestone-3",
    title: "Projeto CORSAN/AEGEA",
    description: "Implementação de IA para gestão de infraestrutura",
    date: "2026-05-31",
    type: "projeto",
    status: "em-progresso"
  },
  {
    id: "milestone-4",
    title: "Lançamento Squad as a Service",
    description: "Formalização do modelo de squads dedicados",
    date: "2026-06-15",
    type: "interno",
    status: "planejado"
  },
  {
    id: "milestone-5",
    title: "Resultado FINEP",
    description: "Divulgação dos resultados da submissão FINEP",
    date: "2026-08-31",
    type: "finep",
    status: "planejado"
  }
];

export const getTrimestreTotals = () => {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetRevenue, 0);
  const totalCosts = goals.reduce((sum, goal) => sum + goal.targetCosts, 0);
  const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentRevenue, 0);
  const totalCurrentCosts = goals.reduce((sum, goal) => sum + goal.currentCosts, 0);

  return {
    targetRevenue: totalTarget,
    targetCosts: totalCosts,
    targetNetRevenue: totalTarget - totalCosts,
    currentRevenue: totalCurrent,
    currentCosts: totalCurrentCosts,
    currentNetRevenue: totalCurrent - totalCurrentCosts,
    progressPercentage: Math.round((totalCurrent / totalTarget) * 100)
  };
};

export const getMonthProgress = (monthId: string) => {
  const goal = goals.find(g => g.id === monthId);
  if (!goal) return 0;
  return Math.round((goal.currentRevenue / goal.targetRevenue) * 100);
};
