import { useEffect, useMemo, useState } from "react";
import { AlertCircle, FolderKanban, Pencil, RefreshCcw, Rocket, Siren, Users } from "lucide-react";

import { KanbanBoard } from "@/components/Kanban/Board";
import { KanbanFilterPanel } from "@/components/Kanban/FilterPanel";
import { MultiAgentWorkbench } from "@/components/MultiAgent/MultiAgentWorkbench";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTrimestreTotals } from "@/data/goals";
import {
  createDashboardTask,
  fetchDashboard,
  updateDashboardTask,
  type DashboardCard,
  type DashboardPayload,
  type DashboardTask,
} from "@/services/dashboardService";
import {
  applyKanbanFilters,
  canonicalizeAssigneeLabel,
  DEFAULT_KANBAN_FILTERS,
  getTaskAssigneeOptions,
  type KanbanFilterQuery,
} from "@/services/filterService";

type TaskDialogMode = "edit" | "create";

type TaskFormState = {
  title: string;
  assignee: string;
  dueDate: string;
  status: string;
  contextType: "projeto" | "iniciativa";
  contextId: string;
};

const TASK_STATUS_OPTIONS = ["Pendente", "Em andamento", "Em revisão", "Concluída"];

function formatDate(date: string) {
  if (!date) return "Sem prazo";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatCurrency(value?: number | null) {
  const safeValue = Number.isFinite(value) ? (value as number) : 0;
  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function taskFormFromState(cards: DashboardCard[], task?: DashboardTask | null, status = "Pendente"): TaskFormState {
  if (task) {
    return {
      title: task.title,
      assignee: canonicalizeAssigneeLabel(task.assignee),
      dueDate: task.dueDate,
      status: task.status,
      contextType: task.contextType,
      contextId: task.contextId,
    };
  }

  const defaultCard = cards.find((card) => card.type === "iniciativa") || cards[0];

  return {
    title: "",
    assignee: "Sem dono",
    dueDate: "",
    status,
    contextType: defaultCard?.type || "iniciativa",
    contextId: defaultCard?.id || "",
  };
}

export default function Home() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<DashboardTask | null>(null);
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>("edit");
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: "",
    assignee: "Sem dono",
    dueDate: "",
    status: "Pendente",
    contextType: "iniciativa",
    contextId: "",
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [kanbanFilters, setKanbanFilters] = useState<KanbanFilterQuery>(DEFAULT_KANBAN_FILTERS);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchDashboard();
      setData(payload);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os dados do laboratório.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const trimestre = useMemo(() => getTrimestreTotals(new Date()), []);
  const tasks = data?.tasks || [];
  const cards = data?.cards || [];
  const filteredTasks = useMemo(() => applyKanbanFilters(tasks, kanbanFilters), [tasks, kanbanFilters]);
  const assigneeOptions = useMemo(() => getTaskAssigneeOptions(tasks), [tasks]);
  const criticalTasks = useMemo(() => tasks.filter((task) => task.overdue || task.dueSoon), [tasks]);
  const projectCards = useMemo(() => cards.filter((card) => card.type === "projeto"), [cards]);
  const initiativeCards = useMemo(() => cards.filter((card) => card.type === "iniciativa"), [cards]);
  const contextCards = useMemo(
    () => cards.filter((card) => card.type === taskForm.contextType),
    [cards, taskForm.contextType],
  );

  function openEditor(task: DashboardTask) {
    setTaskDialogMode("edit");
    setEditingTask(task);
    setTaskForm(taskFormFromState(cards, task));
    setSaveMessage(null);
  }

  function openCreator(status: DashboardTask["status"]) {
    setTaskDialogMode("create");
    setEditingTask(null);
    setTaskForm(taskFormFromState(cards, null, status));
    setSaveMessage(null);
  }

  function closeDialog() {
    setEditingTask(null);
    setTaskDialogMode("edit");
    setSaveMessage(null);
  }

  async function handleMoveTask(task: DashboardTask, status: DashboardTask["status"]) {
    try {
      const response = await updateDashboardTask(task.id, {
        status,
        contextId: task.contextId,
        contextType: task.contextType,
      });
      setData(response.payload);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Falha ao mover a tarefa.");
    }
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim() || !taskForm.contextId) {
      setSaveMessage("Preencha título e contexto antes de salvar.");
      return;
    }

    setIsSavingTask(true);

    try {
      const payload = {
        title: taskForm.title.trim(),
        assignee: taskForm.assignee,
        dueDate: taskForm.dueDate,
        status: taskForm.status,
        contextType: taskForm.contextType,
        contextId: taskForm.contextId,
      } as const;

      const response =
        taskDialogMode === "edit" && editingTask
          ? await updateDashboardTask(editingTask.id, payload)
          : await createDashboardTask(payload);

      setData(response.payload);
      setSaveMessage(response.message);
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Falha ao salvar a tarefa.");
    } finally {
      setIsSavingTask(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07111a] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <section className="rounded-[2rem] border border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_42%),linear-gradient(90deg,rgba(10,34,45,0.95),rgba(12,14,18,0.92))] p-8 lg:p-10">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-5xl font-black tracking-tight text-white">netz</div>
              <Badge className="bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">Laboratório NETZ</Badge>
              <Badge variant="outline" className="border-emerald-300/20 text-emerald-100">
                Painel operacional vivo
              </Badge>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Bancada central</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white lg:text-6xl">
                Sala de controle do laboratório
              </h1>
              <p className="mt-5 max-w-4xl text-lg leading-9 text-slate-300">
                Agora o CopilotX já opera a bancada: conversa com agentes, edita tarefas, move a fila e mantém o
                laboratório em fluxo sem depender de planilhas espalhadas ou lembretes perdidos.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-cyan-300/15 bg-cyan-400/10">
                <CardContent className="py-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Projetos vivos</p>
                  <p className="mt-2 text-4xl font-semibold text-white">{data ? data.summary.totalProjects : "..."}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {data
                      ? `${data.summary.totalProjects} projetos e ${data.summary.totalInitiatives} experimentos.`
                      : "Carregando frentes..."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardContent className="py-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fila viva</p>
                  <p className="mt-2 text-4xl font-semibold text-white">{data ? data.summary.openTasks : "..."}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {data
                      ? `${data.summary.unassignedTasks} sem dono e ${data.summary.overdueTasks} em risco.`
                      : "Contando reagentes..."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardContent className="py-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status do ciclo</p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="text-4xl font-semibold text-white">{trimestre.progressPercentage}%</p>
                    <Badge variant="outline" className="border-rose-300/15 text-rose-100">
                      {trimestre.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{trimestre.daysRemaining} dias até o fim do trimestre atual.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-8">
          {error && (
            <Alert variant="destructive" className="border-red-400/20 bg-red-500/10 text-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-4 py-6">
                <p className="text-sm text-slate-400">Projetos + experimentos internos</p>
                <div className="flex items-center gap-3 text-cyan-300">
                  <FolderKanban className="h-5 w-5" />
                  <span className="text-4xl font-semibold text-white">
                    {data ? data.summary.totalProjects + data.summary.totalInitiatives : "..."}
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  {data ? `${data.summary.openTasks} tarefas abertas.` : "Lendo o laboratório..."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-4 py-6">
                <p className="text-sm text-slate-400">Fila viva</p>
                <div className="flex items-center gap-3 text-emerald-300">
                  <Users className="h-5 w-5" />
                  <span className="text-4xl font-semibold text-white">{data ? data.summary.openTasks : "..."}</span>
                </div>
                <p className="text-sm text-slate-300">
                  {data ? `${data.summary.unassignedTasks} sem dono.` : "Contando reagentes..."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-4 py-6">
                <p className="text-sm text-slate-400">Risco de explosão</p>
                <div className="flex items-center gap-3 text-amber-300">
                  <Siren className="h-5 w-5" />
                  <span className="text-4xl font-semibold text-white">{data ? data.summary.overdueTasks : "..."}</span>
                </div>
                <p className="text-sm text-slate-300">
                  {data ? `${data.summary.dueSoonTasks} vencem nos próximos 7 dias.` : "Varrendo prazos..."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardContent className="space-y-4 py-6">
                <p className="text-sm text-slate-400">Tesouraria</p>
                <p className="text-4xl font-semibold text-white">{formatCurrency(trimestre.targetCosts)}</p>
                <p className="text-sm text-slate-300">15% do trimestre reservados para custos.</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="visao-geral" className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 md:grid-cols-3 xl:grid-cols-6">
              <TabsTrigger value="visao-geral" className="rounded-xl">
                Visão geral
              </TabsTrigger>
              <TabsTrigger value="tarefas" className="rounded-xl">
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="projetos" className="rounded-xl">
                Projetos
              </TabsTrigger>
              <TabsTrigger value="iniciativas" className="rounded-xl">
                Iniciativas
              </TabsTrigger>
              <TabsTrigger value="socios" className="rounded-xl">
                Sócios
              </TabsTrigger>
              <TabsTrigger value="agentes" className="rounded-xl">
                Mintzie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle>Risco de explosão</CardTitle>
                  <CardDescription>Tarefas vencidas ou prestes a explodir.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {criticalTasks.length > 0 ? (
                    criticalTasks.slice(0, 5).map((task) => (
                      <div key={`${task.contextId}-${task.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-lg font-medium text-white">{task.title}</p>
                            <p className="mt-2 text-sm text-slate-400">
                              {task.contextTitle} | {canonicalizeAssigneeLabel(task.assignee)}
                            </p>
                            <p className="mt-2 text-sm text-slate-300">
                              {task.contextType === "projeto" ? "Projeto" : "Experimento interno"} | Prazo {formatDate(task.dueDate)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="border-white/10 bg-transparent text-white"
                            onClick={() => openEditor(task)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-slate-400">
                      Nada com pressão crítica no momento.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Reator de receita</p>
                        <CardTitle className="mt-3 text-5xl">{formatCurrency(trimestre.targetRevenue)}</CardTitle>
                        <CardDescription className="mt-2">{trimestre.cycleLabel}</CardDescription>
                      </div>
                      <Rocket className="h-10 w-10 text-cyan-300" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-lg leading-8 text-slate-300">
                      Meta trimestral com tesouraria-alvo de {formatCurrency(trimestre.targetCosts)} e leitura comparada contra o ritmo esperado do ciclo.
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Progresso do trimestre</span>
                        <span>
                          {trimestre.progressPercentage}% real vs {trimestre.expectedProgressPercentage}% esperado
                        </span>
                      </div>
                      <Progress value={trimestre.progressPercentage} className="h-3 bg-white/10" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tempo restante</p>
                        <p className="mt-3 text-4xl font-semibold text-white">{trimestre.daysRemaining} dias</p>
                        <p className="mt-2 text-sm text-slate-400">até o fim do ciclo atual.</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ritmo mínimo</p>
                        <p className="mt-3 text-4xl font-semibold text-white">{formatCurrency(trimestre.requiredDailyRevenue)}/dia</p>
                        <p className="mt-2 text-sm text-slate-400">{formatCurrency(trimestre.requiredMonthlyRevenue)}/mês restante.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle>Radar do laboratório</CardTitle>
                    <CardDescription>Leitura rápida do estado operacional.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-slate-300">
                    <p>
                      Há {data ? data.summary.totalInitiatives : 0} experimentos internos visíveis e {data ? data.summary.totalProjects : 0} projetos ativos.
                    </p>
                    <p>A bancada agora aceita conversa com agentes, criação de tarefa e movimentação visual por status.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tarefas" className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Tarefas da bancada</h2>
                  <p className="mt-2 text-slate-400">Kanban e lista unificados na mesma página.</p>
                </div>
                <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={() => void loadDashboard()}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>

              <KanbanFilterPanel filters={kanbanFilters} assigneeOptions={assigneeOptions} onChange={setKanbanFilters} />
              <KanbanBoard tasks={filteredTasks} onEditTask={openEditor} onCreateTask={openCreator} onMoveTask={(task, status) => void handleMoveTask(task, status)} />
            </TabsContent>

            <TabsContent value="projetos" className="grid gap-4 xl:grid-cols-2">
              {projectCards.map((card) => (
                <Card key={card.id} className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription>{card.client}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-300">Dono: {canonicalizeAssigneeLabel(card.owner)}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Progresso</span>
                        <span>{card.progress}%</span>
                      </div>
                      <Progress value={card.progress} className="h-2 bg-white/10" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="iniciativas" className="grid gap-4 xl:grid-cols-2">
              {initiativeCards.map((card) => (
                <Card key={card.id} className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription>{card.client}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-300">Dono: {canonicalizeAssigneeLabel(card.owner)}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Progresso</span>
                        <span>{card.progress}%</span>
                      </div>
                      <Progress value={card.progress} className="h-2 bg-white/10" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="socios" className="grid gap-4 xl:grid-cols-2">
              {(data?.partners || []).map((partner) => (
                <Card key={partner.id} className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle>{partner.name}</CardTitle>
                    <CardDescription>{partner.activeTaskCount} tarefas abertas nesta leitura.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>Meta pessoal</span>
                        <span>{formatCurrency(partner.quarterTarget)}</span>
                      </div>
                      <Progress value={Math.min(partner.achievedPercentage, 100)} className="h-2 bg-white/10" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Realizado</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(partner.realizedAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Provisionado</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(partner.provisionedAmount)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Atingido</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(partner.achievedAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="agentes">
              <MultiAgentWorkbench />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={editingTask !== null || taskDialogMode === "create"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="border-white/10 bg-[#0b1020] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{taskDialogMode === "edit" ? "Editar tarefa" : "Criar tarefa"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Ajuste título, responsável, status e prazo sem sair da sala de controle.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Título</label>
              <Input
                value={taskForm.title}
                onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Responsável</label>
                <Select value={taskForm.assignee} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignee: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sem dono">Sem dono</SelectItem>
                    {assigneeOptions
                      .filter((option) => option !== "todos")
                      .map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Prazo</label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Status</label>
                <Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Tipo</label>
                <Select
                  value={taskForm.contextType}
                  onValueChange={(value: "projeto" | "iniciativa") => {
                    const nextCards = cards.filter((card) => card.type === value);
                    setTaskForm((current) => ({
                      ...current,
                      contextType: value,
                      contextId: nextCards[0]?.id || "",
                    }));
                  }}
                >
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciativa">Experimento interno</SelectItem>
                    <SelectItem value="projeto">Projeto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-200">Contexto</label>
                <Select value={taskForm.contextId} onValueChange={(value) => setTaskForm((current) => ({ ...current, contextId: value }))}>
                  <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Selecione o contexto" />
                  </SelectTrigger>
                  <SelectContent>
                    {contextCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {saveMessage && (
              <Alert className="border-white/10 bg-white/5 text-slate-100">
                <AlertDescription>{saveMessage}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={closeDialog}>
              Fechar
            </Button>
            <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => void handleSaveTask()} disabled={isSavingTask}>
              {isSavingTask ? "Salvando..." : taskDialogMode === "edit" ? "Salvar alterações" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
