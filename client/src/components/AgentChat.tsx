import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, X } from "lucide-react";
import { Agent } from "@/data/agents";
import { getAgentResponse } from "@/services/aiService";

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
      id: "1",
      role: "agent",
      content: `Olá! Sou ${agent.name}, ${agent.role} da Ala de ${agent.ala}. Como posso ajudar você hoje? Minha expertise é em ${agent.expertise.join(", ")}.`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const responseContent = await getAgentResponse(agent, input);
      
      const agentResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: responseContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentResponse]);
    } catch (error) {
      console.error("Error getting agent response:", error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: "Desculpe, tive um problema ao processar sua mensagem. Tente novamente.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] border-white/10 bg-white/5 backdrop-blur-xl flex flex-col shadow-2xl z-50">
      <CardHeader className="border-b border-white/10 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.emoji}</span>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription className="text-xs">{agent.role}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                  : "bg-white/10 border border-white/20 text-gray-100"
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <form onSubmit={handleSendMessage} className="border-t border-white/10 p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua pergunta..."
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !input.trim()}
          className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
}
