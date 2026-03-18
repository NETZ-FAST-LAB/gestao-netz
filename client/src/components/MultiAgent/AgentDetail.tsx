import { ArrowRight, FlaskConical, Orbit, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgent } from "@/data/agents";
import type { AgentDetail as AgentDetailModel } from "@/services/agentService";
import { AgentMemory } from "@/components/MultiAgent/AgentMemory";
import { AgentTools } from "@/components/MultiAgent/AgentTools";

interface AgentDetailProps {
  agent: AgentDetailModel | null;
  onSelectCollaborator: (agentId: string) => void;
  onUseAction: (action: string) => void;
}

export function AgentDetail({ agent, onSelectCollaborator, onUseAction }: AgentDetailProps) {
  if (!agent) {
    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardContent className="flex min-h-[640px] items-center justify-center text-slate-400">
          Selecione um agente para abrir a estacao dele.
        </CardContent>
      </Card>
    );
  }

  const visual = getAgent(agent.id);

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-4xl">
                {visual?.emoji || "🧪"}
              </div>
              <div>
                <CardTitle className="text-2xl">{agent.name}</CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  {agent.role} · {agent.ala}
                </CardDescription>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{agent.workspace.headline}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {agent.expertise.map((item) => (
                <Badge key={item} variant="outline" className="border-white/10 text-slate-300">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-5 w-5 text-cyan-200" />
              Estacao de trabalho
            </CardTitle>
            <CardDescription>O que este agente enxerga agora na bancada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Focos ativos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.workspace.focus.map((item) => (
                  <Badge key={item} className="bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contextos relevantes</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {agent.workspace.relatedContexts.length > 0 ? (
                    agent.workspace.relatedContexts.map((context) => <p key={context}>{context}</p>)
                  ) : (
                    <p>Nenhum contexto puxando este agente agora.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Risco quente</p>
                <p className="mt-3 text-3xl font-semibold text-white">{agent.workspace.riskCount}</p>
                <p className="mt-2 text-sm text-slate-400">frente(s) com pressao real dentro do recorte deste agente.</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tarefas puxadas para a mesa</p>
              <div className="mt-3 space-y-3">
                {agent.workspace.relevantTasks.length > 0 ? (
                  agent.workspace.relevantTasks.map((task) => (
                    <div key={task} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                      {task}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                    Este agente nao esta puxando tarefa especifica agora.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Orbit className="h-5 w-5 text-emerald-200" />
              Colaboracoes sugeridas
            </CardTitle>
            <CardDescription>Quem este agente acionaria para nao trabalhar como ilha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agent.collaborators.map((collaborator) => (
              <div key={collaborator.agentId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{collaborator.agentName}</p>
                    <p className="text-sm text-slate-400">{collaborator.role}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{collaborator.reason}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-slate-300">
                    {collaborator.mode}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => onSelectCollaborator(collaborator.agentId)}
                >
                  Abrir agente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-200" />
              Ferramentas e acoes
            </CardTitle>
            <CardDescription>Capacidades declaradas para operar a bancada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <AgentTools tools={agent.tools} />

            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Acoes que vale pedir</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.availableActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10"
                    onClick={() => onUseAction(action)}
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Memoria operacional</CardTitle>
            <CardDescription>Historico vivo da conversa e dos sinais deste agente.</CardDescription>
          </CardHeader>
          <CardContent>
            <AgentMemory entries={agent.memory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
