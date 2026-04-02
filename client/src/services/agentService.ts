export type AgentStatus = "idle" | "thinking" | "executing" | "waiting" | "error";

export interface AgentToolDescriptor {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export interface AgentMemoryEntry {
  id: string;
  role: "user" | "agent" | "system";
  kind: "chat" | "insight" | "handoff";
  content: string;
  createdAt: string;
}

export interface AgentCollaboration {
  agentId: string;
  agentName: string;
  role: string;
  mode: "consultar" | "delegar" | "revisar";
  reason: string;
}

export interface AgentWorkspace {
  headline: string;
  focus: string[];
  relevantTasks: string[];
  relatedContexts: string[];
  riskCount: number;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  ala: string;
  expertise: string[];
  personality: string;
  status: AgentStatus;
  currentTask: string | null;
  lastActivity: string;
  tools: AgentToolDescriptor[];
  memoryPreview: AgentMemoryEntry[];
}

export interface AgentDetail extends AgentSummary {
  memory: AgentMemoryEntry[];
  workspace: AgentWorkspace;
}

export interface AgentChatResponse {
  reply: string;
  agent: AgentDetail;
  suggestions: {
    nextActions: string[];
    suggestedCollaborators: AgentCollaboration[];
  };
}

export async function fetchAgents(): Promise<AgentSummary[]> {
  const response = await fetch("/api/agents");
  if (!response.ok) {
    throw new Error("Falha ao carregar os agentes.");
  }

  const payload = (await response.json()) as { agents?: AgentSummary[] };
  return payload.agents || [];
}

export async function fetchAgentDetail(agentId: string): Promise<AgentDetail> {
  const response = await fetch(`/api/agents/${agentId}`);
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorPayload?.message || "Falha ao carregar o detalhe do agente.");
  }

  const payload = (await response.json()) as { agent?: AgentDetail };
  if (!payload.agent) {
    throw new Error("O agente voltou sem detalhe.");
  }

  return payload.agent;
}

export async function sendAgentMessage(agentId: string, message: string): Promise<AgentChatResponse> {
  const response = await fetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorPayload?.message || "Falha ao conversar com o agente.");
  }

  return (await response.json()) as AgentChatResponse;
}
