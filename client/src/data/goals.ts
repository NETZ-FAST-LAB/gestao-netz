// Dados das metas trimestrais da NETZ

export interface Goal {
  id: string;
  month: number;
  monthName: string;
  targetRevenue: number;
  targetCosts: number;
  targetNetRevenue: number;
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

export interface TrimestreProjection {
  label: string;
  targetRevenue: number;
  targetCosts: number;
  cumulativeRevenue: number;
  cumulativeCosts: number;
}

export interface TrimestreTotals {
  targetRevenue: number;
  targetCosts: number;
  targetNetRevenue: number;
  currentRevenue: number;
  currentCosts: number;
  currentNetRevenue: number;
  progressPercentage: number;
  expectedProgressPercentage: number;
  gapToPacePercentage: number;
  statusLabel: string;
  statusTone: "emerald" | "cyan" | "amber" | "rose";
  daysRemaining: number;
  remainingRevenue: number;
  requiredDailyRevenue: number;
  requiredMonthlyRevenue: number;
  cycleLabel: string;
  forecastQuarters: TrimestreProjection[];
}

const QUARTER_TARGET = 192_000;
const QUARTER_MONTHS = 3;
const MONTHLY_TARGET = Math.round(QUARTER_TARGET / QUARTER_MONTHS);
const COST_PERCENTAGE = 0.15;
const FORECAST_QUARTERS = 3;

export const goals: Goal[] = [
  {
    id: "goal-1",
    month: 1,
    monthName: "Janeiro",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 32_000,
    currentCosts: Math.round(32_000 * COST_PERCENTAGE),
    status: "em-progresso",
  },
  {
    id: "goal-2",
    month: 2,
    monthName: "Fevereiro",
    targetRevenue: MONTHLY_TARGET,
    targetCosts: Math.round(MONTHLY_TARGET * COST_PERCENTAGE),
    targetNetRevenue: Math.round(MONTHLY_TARGET * (1 - COST_PERCENTAGE)),
    currentRevenue: 28_000,
    currentCosts: Math.round(28_000 * COST_PERCENTAGE),
    status: "em-progresso",
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
    status: "planejamento",
  },
];

export const milestones: Milestone[] = [
  {
    id: "milestone-1",
    title: "LanÃ§amento SEBRAE Unio",
    description: "Parceria oficial com SEBRAE para programas de inovaÃ§Ã£o",
    date: "2026-03-31",
    type: "sebrae",
    status: "em-progresso",
  },
  {
    id: "milestone-2",
    title: "SubmissÃ£o FINEP",
    description: "Envio de propostas para o programa FINEP (R$300M)",
    date: "2026-04-15",
    type: "finep",
    status: "planejado",
  },
  {
    id: "milestone-3",
    title: "Projeto CORSAN/AEGEA",
    description: "ImplementaÃ§Ã£o de IA para gestÃ£o de infraestrutura",
    date: "2026-05-31",
    type: "projeto",
    status: "em-progresso",
  },
  {
    id: "milestone-4",
    title: "LanÃ§amento Squad as a Service",
    description: "FormalizaÃ§Ã£o do modelo de squads dedicados",
    date: "2026-06-15",
    type: "interno",
    status: "planejado",
  },
  {
    id: "milestone-5",
    title: "Resultado FINEP",
    description: "DivulgaÃ§Ã£o dos resultados da submissÃ£o FINEP",
    date: "2026-08-31",
    type: "finep",
    status: "planejado",
  },
];

function getQuarterName(quarter: number) {
  return `${quarter}Âº trimestre`;
}

function getCycleDates(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const firstMonth = goals[0]?.month ? goals[0].month - 1 : 0;
  const lastMonth = goals[goals.length - 1]?.month ? goals[goals.length - 1].month - 1 : 3;

  const startDate = new Date(year, firstMonth, 1);
  const endDate = new Date(year, lastMonth + 1, 0);

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
}

function getRemainingCycleMonths(referenceDate: Date, endDate: Date) {
  const yearDiff = endDate.getFullYear() - referenceDate.getFullYear();
  const monthDiff = endDate.getMonth() - referenceDate.getMonth() + yearDiff * 12;

  return Math.max(1, monthDiff + 1);
}

function getExpectedProgressPercentage(referenceDate: Date, startDate: Date, endDate: Date) {
  if (referenceDate <= startDate) return 0;
  if (referenceDate >= endDate) return 100;

  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = referenceDate.getTime() - startDate.getTime();

  return Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
}

function getStatusByPace(progressPercentage: number, expectedProgressPercentage: number) {
  const gap = progressPercentage - expectedProgressPercentage;

  if (gap >= 8) {
    return { label: "Acima do ritmo", tone: "emerald" as const };
  }

  if (gap >= -4) {
    return { label: "No ritmo", tone: "cyan" as const };
  }

  if (gap >= -12) {
    return { label: "Atenção", tone: "amber" as const };
  }

  return { label: "Crítico", tone: "rose" as const };
}

function buildForecastQuarters(targetRevenue: number, targetCosts: number, referenceDate: Date): TrimestreProjection[] {
  const currentQuarter = Math.floor(referenceDate.getMonth() / 3) + 1;
  const currentYear = referenceDate.getFullYear();

  return Array.from({ length: FORECAST_QUARTERS }, (_, index) => {
    const absoluteQuarterIndex = currentQuarter + index + 1;
    const quarter = ((absoluteQuarterIndex - 1) % 4) + 1;
    const yearOffset = Math.floor((absoluteQuarterIndex - 1) / 4);
    const year = currentYear + yearOffset;
    const cumulativeFactor = index + 1;

    return {
      label: `${getQuarterName(quarter)} ${year}`,
      targetRevenue,
      targetCosts,
      cumulativeRevenue: targetRevenue * cumulativeFactor,
      cumulativeCosts: targetCosts * cumulativeFactor,
    };
  });
}

export const getTrimestreTotals = (referenceDate = new Date()): TrimestreTotals => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetRevenue, 0);
  const totalCosts = goals.reduce((sum, goal) => sum + goal.targetCosts, 0);
  const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentRevenue, 0);
  const totalCurrentCosts = goals.reduce((sum, goal) => sum + goal.currentCosts, 0);

  const progressPercentage = Math.round((totalCurrent / totalTarget) * 100);
  const { startDate, endDate } = getCycleDates(today);
  const expectedProgressPercentage = getExpectedProgressPercentage(today, startDate, endDate);
  const gapToPacePercentage = progressPercentage - expectedProgressPercentage;
  const { label: statusLabel, tone: statusTone } = getStatusByPace(progressPercentage, expectedProgressPercentage);

  const msRemaining = Math.max(0, endDate.getTime() - today.getTime());
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const remainingRevenue = Math.max(0, totalTarget - totalCurrent);
  const remainingMonths = getRemainingCycleMonths(today, endDate);

  return {
    targetRevenue: totalTarget,
    targetCosts: totalCosts,
    targetNetRevenue: totalTarget - totalCosts,
    currentRevenue: totalCurrent,
    currentCosts: totalCurrentCosts,
    currentNetRevenue: totalCurrent - totalCurrentCosts,
    progressPercentage,
    expectedProgressPercentage,
    gapToPacePercentage,
    statusLabel,
    statusTone,
    daysRemaining,
    remainingRevenue,
    requiredDailyRevenue: daysRemaining > 0 ? Math.round(remainingRevenue / daysRemaining) : remainingRevenue,
    requiredMonthlyRevenue: Math.round(remainingRevenue / remainingMonths),
    cycleLabel: `${goals[0]?.monthName || "Janeiro"} a ${goals[goals.length - 1]?.monthName || "Março"} ${today.getFullYear()}`,
    forecastQuarters: buildForecastQuarters(totalTarget, totalCosts, today),
  };
};

export const getMonthProgress = (monthId: string) => {
  const goal = goals.find((goal) => goal.id === monthId);
  if (!goal) return 0;
  return Math.round((goal.currentRevenue / goal.targetRevenue) * 100);
};

