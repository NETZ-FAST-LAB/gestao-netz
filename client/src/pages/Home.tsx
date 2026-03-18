import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, FolderKanban, Pencil, RefreshCcw, Rocket, Siren, Users } from "lucide-react";

import { AgentChat } from "@/components/AgentChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agents, type Agent } from "@/data/agents";
import { getTrimestreTotals } from "@/data/goals";
import {
  type DashboardCard,
  type DashboardPartner,
  type DashboardPayload,
  type DashboardTask,
  fetchDashboard,
  updateDashboardTask,
} from "@/services/dashboardService";

type TaskFormState = {
  title: string;
  assignee: string;
  status: string;
  dueDate: string;
};

const TASK_STATUS_OPTIONS = ["Pendente", "Em andamento", "Em revisão", "Concluída"];

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

function buildTaskForm(task: DashboardTask): TaskFormState {
  return {
    title: task.title,
    assignee: task.assignee === "Sem dono" ? "" : task.assignee,
    status: task.status,
    dueDate: task.dueDate,
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [editingTask, setEditingTask] = useState<DashboardTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    assignee: "",
    status: "Pendente",
    dueDate: "",
  });
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
  const experimentCards = useMemo(
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

  function openTaskEditor(task: DashboardTask) {
    setEditingTask(task);
    setTaskForm(buildTaskForm(task));
    setSaveMessage(null);
  }

  function closeTaskEditor() {
    setEditingTask(null);
    setSaveMessage(null);
  }

  async function handleSaveTask() {
    if (!editingTask) return;

    setIsSavingTask(true);
    setSaveMessage(null);

    try {
      const response = await updateDashboardTask(editingTask.id, taskForm);
      setData(response.payload);
      setSaveMessage("Tarefa atualizada com sucesso.");

      if (response.task) {
        setEditingTask(response.task);
        setTaskForm(buildTaskForm(response.task));
      }
    } catch (saveError) {
      console.error(saveError);
      setSaveMessage(saveError instanceof Error ? saveError.message : "Falha ao atualizar a tarefa.");
    } finally {
      setIsSavingTask(false);
    }
  }

  function renderTaskCard(task: DashboardTask) {
    return (
      <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-medium">{task.title}</p>
            <p className="mt-1 text-sm text-slate-400">
              {task.contextTitle} · {task.assignee}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
              <span>{task.contextType === "projeto" ? "Projeto" : "Experimento interno"}</span>
              <span>•</span>
              <span>{task.dueDate ? `Prazo ${formatDate(task.dueDate)}` : "Sem prazo definido"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusTone(task)}>{task.status}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-cyan-300/20 bg-transparent text-cyan-100 hover:bg-cyan-400/10"
              onClick={() => openTaskEditor(task)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_28%),radial-gradient(circle_at_15%_20%,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_85%_12%,_rgba(251,191,36,0.12),_transparent_22%),linear-gradient(155deg,_#06131c_0%,_#091018_40%,_#120d14_100%)] text-white">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/15">Laboratório NETZ</Badge>
              <Badge variant="outline" className="border-emerald-300/30 text-emerald-200">Painel operacional vivo</Badge>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Sala de controle do laboratório</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Agora já dá para abrir conversa com os agentes e editar tarefa, responsável, status e prazo sem sair do painel.
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-white/5 p-5 backdrop-blur-xl lg:w-[360px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Reator de receita</p>
                <p className="mt-2 text-3xl font-semibold">{formatCurrency(trimestre.targetRevenue)}</p>
              </div>
              <Rocket className="h-8 w-8 text-cyan-300" />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Meta trimestral com tesouraria-alvo de {formatCurrency(trimestre.targetCosts)}.
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
              <CardDescription>Projetos + experimentos internos</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FolderKanban className="h-5 w-5 text-cyan-300" />
                {isLoading || !data ? "..." : data.summary.totalProjects + data.summary.totalInitiatives}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Lendo os experimentos..." : `${data.summary.openTasks} tarefas abertas.`}
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
              {isLoading || !data ? "Contando reagentes..." : `${data.summary.unassignedTasks} sem dono.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Risco de explosão</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Siren className="h-5 w-5 text-amber-300" />
                {isLoading || !data ? "..." : data.summary.overdueTasks}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {isLoading || !data ? "Varrendo o laboratório..." : `${data.summary.dueSoonTasks} vencem nos próximos 7 dias.`}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription>Tesouraria</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <RefreshCcw className="h-5 w-5 text-fuchsia-300" />
                {formatCurrency(trimestre.targetCosts)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">15% do trimestre reservados para custos.</CardContent>
          </Card>
        </div>

        <Tabs defaultValue="visao-geral" className="mt-8">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border border-white/10 bg-white/5 p-2 lg:grid-cols-6">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="agentes">Agentes</TabsTrigger>
            <TabsTrigger value="socios">Sócios</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="iniciativas">Experimentos internos</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Risco de explosão</CardTitle>
                  <CardDescription>Tarefas vencidas ou prestes a explodir.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {criticalTasks.length > 0 ? criticalTasks.map((task) => renderTaskCard(task)) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-400">
                      Nenhum experimento prestes a explodir agora.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle>Radar do laboratório</CardTitle>
                  <CardDescription>Leitura rápida do estado operacional.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-300">
                  <p>
                    Há <span className="font-semibold text-white">{experimentCards.length}</span> experimentos internos visíveis e{" "}
                    <span className="font-semibold text-white">{projectCards.length}</span> projetos.
                  </p>
                  <p>
                    A bancada agora já aceita conversa com agentes e edição básica de tarefas.
                  </p>
                  <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-400/5 p-4">
                    O próximo salto é colocar os agentes propondo ações estruturadas e executando com confirmação.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agentes" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Centro de agentes</CardTitle>
                <CardDescription>Converse com os especialistas do laboratório.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-3xl">{agent.emoji}</p>
                        <p className="mt-3 text-lg font-semibold">{agent.name}</p>
                        <p className="text-sm text-slate-400">{agent.role}</p>
                      </div>
                      <Badge variant="outline">{agent.ala}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{agent.description}</p>
                    <Button className="mt-5 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setSelectedAgent(agent)}>
                      <Bot className="mr-2 h-4 w-4" />
                      Conversar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tarefas" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Fila operacional completa</CardTitle>
                <CardDescription>Leitura viva das tarefas abertas no Kanban com edição básica.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.tasks || []).map((task) => renderTaskCard(task))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="iniciativas" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Experimentos internos</CardTitle>
                <CardDescription>Todos os experimentos internos do laboratório.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {experimentCards.map((card: DashboardCard) => (
                  <div key={card.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{card.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{card.owner}</p>
                      </div>
                      <Badge variant="outline">{card.column}</Badge>
                    </div>
                    <div className="mt-4 text-sm text-slate-300">{card.openTasks} abertas · {card.completedTasks} concluídas</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projetos" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Projetos</CardTitle>
                <CardDescription>Projetos ativos monitorados pelo laboratório.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {projectCards.map((card: DashboardCard) => (
                  <div key={card.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{card.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{card.client}</p>
                      </div>
                      <Badge variant="outline">{card.column}</Badge>
                    </div>
                    <div className="mt-4 text-sm text-slate-300">{card.openTasks} abertas · {card.completedTasks} concluídas</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!editingTask} onOpenChange={(open) => (!open ? closeTaskEditor() : undefined)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription className="text-slate-400">
              Ajuste título, responsável, status e prazo sem sair da sala de controle.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Título</label>
              <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Responsável</label>
                <Input value={taskForm.assignee} onChange={(event) => setTaskForm((current) => ({ ...current, assignee: event.target.value }))} placeholder="Sem dono" className="border-white/10 bg-white/5 text-white" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Prazo</label>
                <Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Status</label>
              <Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {saveMessage && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {saveMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTaskEditor} className="border-white/10 bg-transparent text-white hover:bg-white/10">Fechar</Button>
            <Button onClick={() => void handleSaveTask()} disabled={isSavingTask} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {isSavingTask ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedAgent && <AgentChat agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
    </div>
  );
}
