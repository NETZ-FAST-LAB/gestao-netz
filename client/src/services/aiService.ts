import type { Agent } from "@/data/agents";

export async function getAgentResponse(agent: Agent, userMessage: string): Promise<string> {
  const response = await fetch(`/api/agents/${agent.id}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: userMessage,
    }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorPayload?.message || "Falha ao conversar com o agente.");
  }

  const payload = (await response.json()) as { reply?: string };
  if (!payload.reply) {
    throw new Error("O agente voltou sem resposta.");
  }

  return payload.reply;
}
