import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock, Power } from "lucide-react";

import { AgentDetail } from "@/components/MultiAgent/AgentDetail";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchAgentDetail,
  fetchAgents,
  sendAgentMessage,
  type AgentDetail as AgentDetailModel,
  type AgentSummary,
} from "@/services/agentService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ritual {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
}

// ─── Ritual Service ───────────────────────────────────────────────────────────

async function fetchRituals(): Promise<Ritual[]> {
  const res = await fetch("/api/rituals");
  if (!res.ok) throw new Error("Falha ao buscar rotinas");
  const data = await res.json() as { rituals: Ritual[] };
  return data.rituals;
}

async function toggleRitual(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`/api/rituals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Falha ao atualizar rotina");
}

// ─── Ritual Toggle Card ────────────────────────────────────────────────────────

function RitualCard({
  ritual,
  onToggle,
}: {
  ritual: Ritual;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${
        ritual.enabled
          ? "border-cyan-400/20 bg-cyan-400/5 hover:border-cyan-400/35"
          : "border-white/8 bg-white/3 opacity-60 hover:opacity-75"
      }`}
    >
      <button
        id={`ritual-toggle-${ritual.id}`}
        aria-label={ritual.enabled ? `Desativar ${ritual.name}` : `Ativar ${ritual.name}`}
        onClick={() => onToggle(ritual.id, !ritual.enabled)}
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
          ritual.enabled
            ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25"
            : "border-white/15 bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
        }`}
      >
        <Power className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`font-medium leading-tight ${ritual.enabled ? "text-white" : "text-white/50"}`}>
            {ritual.name}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              ritual.enabled
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-white/8 text-white/35"
            }`}
          >
            {ritual.enabled ? "Ativa" : "Pausada"}
          </span>
        </div>
        <p className={`mb-2 text-sm leading-relaxed ${ritual.enabled ? "text-white/65" : "text-white/35"}`}>
          {ritual.description}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <Clock className="h-3 w-3" />
          <span>{ritual.schedule}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Format Activity ──────────────────────────────────────────────────────────

function formatActivity(dateString: string) {
  if (!dateString || dateString.startsWith("1970")) return "sem atividade registrada";
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MultiAgentWorkbench() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetailModel | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [ritualsLoading, setRitualsLoading] = useState(true);
  const [ritualError, setRitualError] = useState<string | null>(null);

  // Load agent
  async function loadAgents() {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchAgents();
      setAgents(payload);
      if (!selectedAgentId && payload.length > 0) {
        setSelectedAgentId(payload[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao abrir a estação.");
    } finally {
      setIsLoading(false);
    }
  }

  // Load rituals
  async function loadRituals() {
    setRitualsLoading(true);
    setRitualError(null);
    try {
      const data = await fetchRituals();
      setRituals(data);
    } catch (e) {
      setRitualError(e instanceof Error ? e.message : "Falha ao carregar rotinas.");
    } finally {
      setRitualsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
    void loadRituals();
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    let active = true;
    setError(null);
    void fetchAgentDetail(selectedAgentId)
      .then((agent) => { if (active) setSelectedAgent(agent); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o agente."); });
    return () => { active = false; };
  }, [selectedAgentId]);

  const stationLabel = useMemo(
    () =>
      selectedAgent
        ? `${selectedAgent.name} | última atividade ${formatActivity(selectedAgent.lastActivity)}`
        : "Sem agente aberto",
    [selectedAgent],
  );

  async function handleSendMessage() {
    if (!selectedAgentId || !draft.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const response = await sendAgentMessage(selectedAgentId, draft.trim());
      setSelectedAgent(response.agent);
      setAgents((current) =>
        current.map((agent) =>
          agent.id === response.agent.id
            ? { ...agent, status: response.agent.status, currentTask: response.agent.currentTask, lastActivity: response.agent.lastActivity, memoryPreview: response.agent.memoryPreview }
            : agent,
        ),
      );
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Falha ao enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleToggleRitual(id: string, enabled: boolean) {
    // Optimistic update
    setRituals((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      await toggleRitual(id, enabled);
    } catch {
      // Revert on failure
      setRituals((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)));
      setRitualError("Falha ao salvar configuração da rotina.");
    }
  }

  const activeCount = rituals.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Chat Header */}
      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Chat com Mintzie</CardTitle>
              <CardDescription>
                Converse com o Mintzie para manipular ou extrair informações sobre o laboratório.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-cyan-300/20 text-cyan-100">
              {stationLabel}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-red-400/25 bg-red-500/10 text-red-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Chat */}
      <div className="flex w-full">
        <AgentDetail
          agent={selectedAgent}
          draft={draft}
          isSending={isSending}
          onDraftChange={setDraft}
          onSend={() => void handleSendMessage()}
        />
      </div>

      {/* ─── Routines Panel ─────────────────────────────────────────────────── */}
      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5 text-cyan-400" />
                Rotinas do Mintzie
              </CardTitle>
              <CardDescription>
                Configure quais rotinas automáticas o Mintzie deve executar no Discord.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-medium text-emerald-300">
                {activeCount} ativa{activeCount !== 1 ? "s" : ""}
              </span>
              <span className="text-sm text-white/40">
                de {rituals.length}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {ritualError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {ritualError}
            </div>
          )}

          {ritualsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-xl border border-white/8 bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {rituals.map((ritual) => (
                <RitualCard key={ritual.id} ritual={ritual} onToggle={handleToggleRitual} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
