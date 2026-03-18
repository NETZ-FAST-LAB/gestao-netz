import { Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AgentToolDescriptor } from "@/services/agentService";

interface AgentToolsProps {
  tools: AgentToolDescriptor[];
}

export function AgentTools({ tools }: AgentToolsProps) {
  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div key={tool.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-cyan-200">
              <Wrench className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">{tool.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{tool.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tool.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline" className="border-white/10 text-slate-300">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
