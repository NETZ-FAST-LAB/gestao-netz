import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, FolderKanban, RefreshCcw, Siren, Users } from "lucide-react";

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
  if (card.progress >= 80) return "text-emerald-400";
  if (card.progress >= 40) return "text-cyan-400";
  return "text-amber-400";
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
      setError("Não consegui carregar os dados reais do dashboard agora.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const topTasks = useMemo(() => data?.tasks.slice(0, 6) || [], [data]);
  const topCards = useMemo(() => data?.cards.slice(0, 6) || [], [data]);
  const topMilestones = useMemo(() => data?.milestones.slice(0, 6) || [], [data]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_26%),linear-gradient(160deg,_#06131c_0%,_#0a1c22_38%,_#101418_100%)] text-white">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">NETZ Lab Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">Painel vivo da operação</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Interface conectada ao Kanban real da NETZ, com foco em carga de trabalho, tarefas em aberto, marcos e fricções operacionais.
            </p>
          </div>
          <div className="text-right">
            <Button
              onClick={() => void loadDashboard()}
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {data && (
              <p className="mt-3 text-xs text-slate-400">
                Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
              </p>
            )}
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
                <FolderKanban className="h-5 w-5 text-cyan-400" />
                {isLoading || !data ? "..." : data.summary.totalProjects + data.summary.totalInitiatives}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Lendo o Kanban..." : `${data.summary.totalProjects} projetos e ${data.summary.totalInitiatives} iniciativas.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Tarefas abertas</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="h-5 w-5 text-emerald-400" />
                {isLoading || !data ? "..." : data.summary.openTasks}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Calculando carga..." : `${data.summary.unassignedTasks} sem dono e ${data.summary.completedTasks} concluídas.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Risco de prazo</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Siren className="h-5 w-5 text-amber-400" />
                {isLoading || !data ? "..." : data.summary.overdueTasks}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Varrendo datas..." : `${data.summary.dueSoonTasks} tarefas vencem nos próximos 7 dias.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Marcos monitorados</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CalendarClock className="h-5 w-5 text-fuchsia-400" />
                {isLoading || !data ? "..." : data.milestones.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Separando lembretes..." : "Checkpoints, alinhamentos, fechamentos e upsells."}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="visao-geral" className="mt-8">
          <TabsList className="grid w-full grid-cols-5 border border-white/10 bg-white/5">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="socios">Sócios</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="marcos">Marcos</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>O que está pedindo ação agora</CardTitle>
                  <CardDescription>Tarefas vencidas, urgentes ou com data próxima.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
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
                        {task.overdue && <Badge variant="destructive">Atrasada</Badge>}
                        {!task.overdue && task.dueSoon && <Badge variant="secondary">Prazo próximo</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Resumo do radar Mintzie</CardTitle>
                  <CardDescription>Uma leitura rápida do estado da operação.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-300">
                  <p>
                    <span className="font-medium text-white">{data?.organization.name || "NETZ"}</span> está com{" "}
                    <span className="font-medium text-cyan-300">{data?.summary.openTasks || 0}</span> tarefas abertas,
                    sendo <span className="font-medium text-amber-300">{data?.summary.overdueTasks || 0}</span> atrasadas.
                  </p>
                  <p>
                    Existem <span className="font-medium text-fuchsia-300">{data?.milestones.length || 0}</span> marcos monitorados e{" "}
                    <span className="font-medium text-emerald-300">{data?.summary.completedTasks || 0}</span> entregas já concluídas no ciclo atual.
                  </p>
                  <p>
                    A maior fricção visível agora está na combinação de tarefas sem dono, prazos próximos e cards com muita coisa em aberto.
                  </p>
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
                    <CardDescription>Carga operacional atual</CardDescription>
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
                <CardTitle>Fila operacional</CardTitle>
                <CardDescription>Leitura viva das tarefas abertas no Kanban.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.tasks || []).map((task: DashboardTask) => (
                  <div key={task.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
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

          <TabsContent value="projetos" className="mt-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {topCards.map((card: DashboardCard) => (
                <Card key={card.id} className="border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>
                          {card.type === "projeto" ? "Projeto" : "Iniciativa"} · {card.client}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{card.column}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-slate-400">Responsável</p>
                        <p className="font-medium text-white">{card.owner}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Abertas</p>
                        <p className="font-medium text-white">{card.openTasks}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Concluídas</p>
                        <p className="font-medium text-white">{card.completedTasks}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Progresso</span>
                        <span className={`font-semibold ${cardTone(card)}`}>{card.progress}%</span>
                      </div>
                      <Progress value={card.progress} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{card.healthStatus}</Badge>
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
                <CardTitle>Marcos e checkpoints</CardTitle>
                <CardDescription>Eventos e lembretes extraídos dos projetos monitorados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topMilestones.map((milestone: DashboardMilestone) => (
                  <div key={milestone.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
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
