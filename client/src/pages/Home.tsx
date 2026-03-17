import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  FlaskConical,
  FolderKanban,
  RefreshCcw,
  Rocket,
  Siren,
  Users,
} from "lucide-react";

import { goals, getTrimestreTotals } from "@/data/goals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DashboardCard,
  type DashboardMilestone,
  type DashboardPartner,
  type DashboardPayload,
  type DashboardTask,
  fetchDashboard,
} from "@/services/dashboardService";

function formatDate(date: string) {
  if (!date) return "Sem data";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function statusTone(task: DashboardTask) {
  if (task.overdue) return "destructive" as const;
  if (task.dueSoon) return "secondary" as const;
  return "outline" as const;
}

function milestoneTone(milestone: DashboardMilestone) {
  if (milestone.type === "upsell") return "default" as const;
  if (milestone.type === "fechamento") return "secondary" as const;
  return "outline" as const;
}

function cardTone(card: DashboardCard) {
  if (card.progress >= 80) return "text-emerald-300";
  if (card.progress >= 40) return "text-cyan-300";
  return "text-amber-300";
}

function monthlyStatusTone(progress: number) {
  if (progress >= 85) return "text-emerald-300";
  if (progress >= 50) return "text-cyan-300";
  return "text-amber-300";
}

export default function Home() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchDashboard();
      setData(payload);
    } catch (loadError) {
      console.error(loadError);
      setError("Não consegui carregar os dados reais do laboratório agora.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const trimestre = useMemo(() => getTrimestreTotals(), []);
  const initiativeCards = useMemo(
    () => (data?.cards || []).filter((card) => card.type === "iniciativa"),
    [data],
  );
  const projectCards = useMemo(
    () => (data?.cards || []).filter((card) => card.type === "projeto"),
    [data],
  );
  const criticalTasks = useMemo(
    () => (data?.tasks || []).filter((task) => task.overdue || task.dueSoon).slice(0, 8),
    [data],
  );
  const activeLabCards = useMemo(() => (data?.cards || []).slice(0, 4), [data]);
  const topMilestones = useMemo(() => (data?.milestones || []).slice(0, 6), [data]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_28%),radial-gradient(circle_at_15%_20%,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_85%_12%,_rgba(251,191,36,0.12),_transparent_22%),linear-gradient(155deg,_#06131c_0%,_#091018_40%,_#120d14_100%)] text-white">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/15">Laboratório NETZ</Badge>
              <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">
                Painel operacional vivo
              </Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
              Sala de controle do laboratório maluco da NETZ
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Aqui ficam os experimentos internos, a pressão comercial, os projetos em incubação e as
              tarefas que ninguém mais pode fingir que não viu.
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-white/5 p-5 backdrop-blur-xl lg:w-[360px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Reator de Receita</p>
                <p className="mt-2 text-3xl font-semibold">{formatCurrency(trimestre.targetRevenue)}</p>
              </div>
              <Rocket className="h-8 w-8 text-cyan-300" />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Meta trimestral com teto de custos em {formatCurrency(trimestre.targetCosts)} e receita líquida-alvo de{" "}
              {formatCurrency(trimestre.targetNetRevenue)}.
            </p>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Progresso do trimestre</span>
                <span>{trimestre.progressPercentage}%</span>
              </div>
              <Progress value={trimestre.progressPercentage} className="h-2.5" />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <Card className="mb-6 border-red-400/30 bg-red-500/10 text-red-50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Projetos + iniciativas</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FolderKanban className="h-5 w-5 text-cyan-300" />
                {isLoading || !data ? "..." : data.summary.totalProjects + data.summary.totalInitiatives}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data
                ? "Lendo os experimentos..."
                : `${data.summary.totalProjects} projetos externos e ${data.summary.totalInitiatives} iniciativas internas.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Fila viva</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="h-5 w-5 text-emerald-300" />
                {isLoading || !data ? "..." : data.summary.openTasks}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data
                ? "Contando reagentes..."
                : `${data.summary.unassignedTasks} sem dono e ${data.summary.completedTasks} já concluídas.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Pressão de prazo</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Siren className="h-5 w-5 text-amber-300" />
                {isLoading || !data ? "..." : data.summary.overdueTasks}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data
                ? "Varrendo o laboratório..."
                : `${data.summary.dueSoonTasks} tarefas vencem nos próximos 7 dias.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Marcos monitorados</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CalendarClock className="h-5 w-5 text-fuchsia-300" />
                {isLoading || !data ? "..." : data.milestones.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data
                ? "Ajustando cronômetros..."
                : "Checkpoints, alinhamentos, fechamentos e oportunidades de upsell."}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="visao-geral" className="mt-8">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 border border-white/10 bg-white/5 p-2 lg:grid-cols-6">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="socios">Sócios</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="iniciativas">Iniciativas</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="marcos">Marcos</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-cyan-300/15 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <FlaskConical className="h-5 w-5 text-cyan-300" />
                    <div>
                      <CardTitle>Meta trimestral sob observação</CardTitle>
                      <CardDescription>
                        Meta de receita de {formatCurrency(192000)} com custos controlados em 15%.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Receita-alvo</p>
                      <p className="mt-2 text-2xl font-semibold">{formatCurrency(192000)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Custos máximos</p>
                      <p className="mt-2 text-2xl font-semibold">{formatCurrency(28800)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Receita líquida-alvo</p>
                      <p className="mt-2 text-2xl font-semibold">{formatCurrency(163200)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {goals.map((goal) => {
                      const monthProgress = Math.round((goal.currentRevenue / goal.targetRevenue) * 100);
                      return (
                        <div key={goal.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{goal.monthName}</p>
                              <p className="text-sm text-slate-400">
                                {formatCurrency(goal.currentRevenue)} de {formatCurrency(goal.targetRevenue)}
                              </p>
                            </div>
                            <span className={`text-sm font-semibold ${monthlyStatusTone(monthProgress)}`}>
                              {monthProgress}%
                            </span>
                          </div>
                          <Progress value={monthProgress} className="h-2.5" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Diagnóstico do laboratório</CardTitle>
                  <CardDescription>O que está pedindo intervenção humana agora.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <p>
                    A bancada está com <span className="font-semibold text-white">{data?.summary.openTasks || 0}</span> tarefas abertas,
                    incluindo <span className="font-semibold text-amber-300">{data?.summary.overdueTasks || 0}</span> atrasadas.
                  </p>
                  <p>
                    O motor interno tem <span className="font-semibold text-cyan-300">{initiativeCards.length}</span> iniciativas visíveis e{" "}
                    <span className="font-semibold text-emerald-300">{projectCards.length}</span> projetos em curso.
                  </p>
                  <p>
                    Se algo parecer perdido, agora existe uma aba exclusiva de iniciativas para ninguém alegar neblina operacional.
                  </p>
                  <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-400/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Hipótese de melhoria</p>
                    <p className="mt-2">
                      O próximo salto de produtividade aqui é unir pressão comercial, calendário de marcos e saúde de tarefas numa só leitura.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Fila crítica</CardTitle>
                  <CardDescription>Tarefas vencidas ou prestes a explodir.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {criticalTasks.length > 0 ? (
                    criticalTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {task.contextTitle} · {task.assignee}
                            </p>
                          </div>
                          <Badge variant={statusTone(task)}>{task.status}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span>{task.contextType === "projeto" ? "Projeto" : "Iniciativa"}</span>
                          <span>•</span>
                          <span>{task.dueDate ? `Prazo ${formatDate(task.dueDate)}` : "Sem prazo definido"}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-400">
                      Nenhum experimento prestes a explodir agora. Aproveitem enquanto dura.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Experimentos em destaque</CardTitle>
                  <CardDescription>Os cards com maior volume de trabalho aberto.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeLabCards.map((card) => (
                    <div key={card.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{card.title}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {card.type === "projeto" ? "Projeto" : "Iniciativa"} · {card.owner}
                          </p>
                        </div>
                        <Badge variant="outline">{card.column}</Badge>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>Progresso</span>
                          <span className={cardTone(card)}>{card.progress}%</span>
                        </div>
                        <Progress value={card.progress} className="h-2" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="socios" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
              {(data?.partners || []).map((partner: DashboardPartner) => (
                <Card key={partner.id} className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">{partner.name}</CardTitle>
                    <CardDescription>Pressão operacional atual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Tarefas ativas</span>
                        <span className="font-semibold text-white">{partner.activeTaskCount}</span>
                      </div>
                      <Progress value={Math.min(partner.activeTaskCount * 20, 100)} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{partner.overdueTaskCount} atrasadas</Badge>
                      <Badge variant="outline">{partner.dueSoonTaskCount} com prazo próximo</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      {partner.examples.length > 0 ? (
                        partner.examples.map((example) => (
                          <div key={example} className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                            {example}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-slate-400">
                          Sem tarefas abertas mapeadas agora.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tarefas" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Fila operacional completa</CardTitle>
                <CardDescription>Leitura viva das tarefas abertas no Kanban.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.tasks || []).map((task: DashboardTask) => (
                  <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {task.contextTitle} · {task.assignee}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusTone(task)}>{task.status}</Badge>
                        <Badge variant="outline">{task.contextType}</Badge>
                        <Badge variant="outline">{task.dueDate ? formatDate(task.dueDate) : "Sem prazo"}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="iniciativas" className="mt-6">
            <Card className="border-cyan-300/15 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Incubadora de iniciativas</CardTitle>
                <CardDescription>
                  Todas as iniciativas internas do laboratório, incluindo a recém-criada Gestão Netz.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {initiativeCards.map((card) => (
                  <Card key={card.id} className="border-white/10 bg-black/20">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{card.title}</CardTitle>
                          <CardDescription>{card.owner}</CardDescription>
                        </div>
                        <Badge variant="outline">{card.column}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-slate-400">Abertas</p>
                          <p className="font-medium text-white">{card.openTasks}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Concluídas</p>
                          <p className="font-medium text-white">{card.completedTasks}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Saúde</p>
                          <p className="font-medium text-white">{card.healthStatus}</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-slate-400">Progresso</span>
                          <span className={cardTone(card)}>{card.progress}%</span>
                        </div>
                        <Progress value={card.progress} className="h-2" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {card.tags.map((tag) => (
                          <Badge key={`${card.id}-${tag}`} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projetos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {projectCards.map((card) => (
                <Card key={card.id} className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>
                          Cliente: {card.client} · Dono operacional: {card.owner}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{card.column}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-slate-400">Abertas</p>
                        <p className="font-medium text-white">{card.openTasks}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Concluídas</p>
                        <p className="font-medium text-white">{card.completedTasks}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Saúde</p>
                        <p className="font-medium text-white">{card.healthStatus}</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Progresso</span>
                        <span className={cardTone(card)}>{card.progress}%</span>
                      </div>
                      <Progress value={card.progress} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <Badge key={`${card.id}-${tag}`} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="marcos" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Cronômetros e checkpoints</CardTitle>
                <CardDescription>Os marcos que o laboratório não pode perder de vista.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topMilestones.map((milestone: DashboardMilestone) => (
                  <div key={milestone.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium">{milestone.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{milestone.contextTitle}</p>
                        {milestone.description && (
                          <p className="mt-2 text-sm text-slate-300">{milestone.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={milestoneTone(milestone)}>{milestone.type}</Badge>
                        <Badge variant="outline">{formatDate(milestone.date)}</Badge>
                        {milestone.responsible && <Badge variant="outline">{milestone.responsible}</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
