import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { AgentDetail } from "@/components/MultiAgent/AgentDetail";
import { AgentList } from "@/components/MultiAgent/AgentList";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchAgentDetail,
  fetchAgents,
  sendAgentMessage,
  type AgentDetail as AgentDetailModel,
  type AgentSummary,
} from "@/services/agentService";

function formatActivity(dateString: string) {
  if (!dateString || dateString.startsWith("1970")) return "sem atividade registrada";
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MultiAgentWorkbench() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetailModel | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Falha ao abrir a estação multiagente.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;

    let active = true;
    setError(null);

    void fetchAgentDetail(selectedAgentId)
      .then((agent) => {
        if (!active) return;
        setSelectedAgent(agent);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o agente.");
      });

    return () => {
      active = false;
    };
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
            ? {
                ...agent,
                status: response.agent.status,
                currentTask: response.agent.currentTask,
                lastActivity: response.agent.lastActivity,
                memoryPreview: response.agent.memoryPreview,
              }
            : agent,
        ),
      );
      setDraft("");
    } catch (sendError) {
      console.error(sendError);
      setError(sendError instanceof Error ? sendError.message : "Falha ao enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="flex w-full">
        <AgentDetail
          agent={selectedAgent}
          draft={draft}
          isSending={isSending}
          onDraftChange={setDraft}
          onSend={() => void handleSendMessage()}
        />
      </div>
    </div>
  );
}
