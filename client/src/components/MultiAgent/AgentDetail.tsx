import { KeyboardEvent } from "react";
import { FlaskConical, Send } from "lucide-react";

import { AgentMemory } from "@/components/MultiAgent/AgentMemory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAgent } from "@/data/agents";
import type { AgentDetail as AgentDetailModel } from "@/services/agentService";

interface AgentDetailProps {
  agent: AgentDetailModel | null;
  draft: string;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}

export function AgentDetail({ agent, draft, isSending, onDraftChange, onSend }: AgentDetailProps) {
  if (!agent) {
    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardContent className="flex min-h-[640px] items-center justify-center text-slate-400">
          Selecione um agente para abrir a estação dele.
        </CardContent>
      </Card>
    );
  }

  const visual = getAgent(agent.id);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

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
                  {agent.role} | {agent.ala}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-5 w-5 text-cyan-200" />
              Estação de trabalho
            </CardTitle>
            <CardDescription>O que este agente está enxergando agora na bancada.</CardDescription>
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
                <p className="mt-2 text-sm text-slate-400">frente(s) com pressão real neste recorte.</p>
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
                    Este agente não está puxando tarefa específica agora.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Conversa operacional</CardTitle>
            <CardDescription>
              O histórico vivo e a conversa atual ficam juntos para o agente responder com contexto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgentMemory entries={agent.memory} />

            <div className="flex flex-col gap-3 lg:flex-row">
              <Input
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Fale com ${agent.name}...`}
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                disabled={isSending}
              />
              <Button
                type="button"
                disabled={isSending || !draft.trim()}
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                onClick={onSend}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
