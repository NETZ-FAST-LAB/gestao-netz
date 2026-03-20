import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AgentMemoryEntry } from "@/services/agentService";

interface AgentMemoryProps {
  entries: AgentMemoryEntry[];
}

const ROLE_LABEL: Record<AgentMemoryEntry["role"], string> = {
  user: "Você",
  agent: "Agente",
  system: "Sistema",
};

export function AgentMemory({ entries }: AgentMemoryProps) {
  return (
    <ScrollArea className="h-[360px] rounded-2xl border border-white/10 bg-black/20">
      <div className="space-y-3 p-4">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            Ainda não há memória viva deste agente.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "rounded-2xl px-4 py-3",
                entry.role === "user"
                  ? "bg-cyan-400/10 text-cyan-50"
                  : entry.role === "agent"
                    ? "border border-white/10 bg-white/5 text-slate-100"
                    : "border border-amber-300/15 bg-amber-400/10 text-amber-50",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] opacity-75">
                <span>{ROLE_LABEL[entry.role]}</span>
                <span>{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{entry.content}</p>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
