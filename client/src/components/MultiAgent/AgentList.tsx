import { Bot, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAgent } from "@/data/agents";
import type { AgentSummary, AgentStatus } from "@/services/agentService";

interface AgentListProps {
  agents: AgentSummary[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Em espera",
  thinking: "Pensando",
  executing: "Executando",
  waiting: "Aguardando",
  error: "Instavel",
};

const STATUS_TONE: Record<AgentStatus, string> = {
  idle: "text-emerald-200",
  thinking: "text-cyan-200",
  executing: "text-amber-200",
  waiting: "text-slate-300",
  error: "text-rose-200",
};

export function AgentList({ agents, selectedAgentId, onSelect }: AgentListProps) {
  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const visual = getAgent(agent.id);
        const isActive = selectedAgentId === agent.id;

        return (
          <Button
            key={agent.id}
            type="button"
            variant="ghost"
            onClick={() => onSelect(agent.id)}
            className={cn(
              "h-auto w-full justify-start rounded-2xl border p-0 text-left hover:bg-white/5",
              isActive ? "border-cyan-300/35 bg-cyan-400/10" : "border-white/10 bg-black/10",
            )}
          >
            <div className="w-full p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                    {visual?.emoji || <Bot className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{agent.name}</p>
                    <p className="truncate text-sm text-slate-400">{agent.role}</p>
                  </div>
                </div>

                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {agent.tools.length} tools
                </Badge>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <div className={cn("flex items-center gap-2", STATUS_TONE[agent.status])}>
                  <CircleDot className="h-3.5 w-3.5" />
                  <span>{STATUS_LABELS[agent.status]}</span>
                </div>
                <span className="text-slate-500">{agent.ala}</span>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
