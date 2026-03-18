import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

import type { Agent } from "@/data/agents";
import { getAgentResponse } from "@/services/aiService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

interface AgentChatProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentChat({ agent, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content: `Olá. Sou ${agent.name}, ${agent.role} da ${agent.ala}. Posso te ajudar a pensar, organizar ou destravar uma ação no laboratório.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const responseContent = await getAgentResponse(agent, userMessage.content);
      const agentMessage: ChatMessage = {
        id: `${Date.now()}-agent`,
        role: "agent",
        content: responseContent,
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, agentMessage]);
    } catch (error) {
      console.error("Error getting agent response:", error);
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-error`,
          role: "agent",
          content: "Tive um problema para responder agora. Me cutuca de novo em alguns segundos.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="fixed right-4 bottom-4 z-50 flex h-[640px] w-[420px] max-w-[calc(100vw-2rem)] flex-col border-cyan-300/15 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl">
      <CardHeader className="border-b border-white/10 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.emoji}</span>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription className="text-xs text-slate-400">{agent.role}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-cyan-500 text-slate-950"
                  : "border border-white/10 bg-white/5 text-slate-100"
              }`}
            >
              <p className="text-sm leading-6">{message.content}</p>
              <p className="mt-2 text-[11px] opacity-60">
                {message.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex gap-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-white/10 p-4">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Fale com ${agent.name}...`}
          className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !input.trim()}
          className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
