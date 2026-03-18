import { Search, Siren, UserRoundX, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_KANBAN_FILTERS, type KanbanFilterQuery } from "@/services/filterService";

interface KanbanFilterPanelProps {
  filters: KanbanFilterQuery;
  assigneeOptions: string[];
  onChange: (filters: KanbanFilterQuery) => void;
}

const STATUS_OPTIONS = ["Pendente", "Em andamento", "Em revisao", "Concluida"];

export function KanbanFilterPanel({ filters, assigneeOptions, onChange }: KanbanFilterPanelProps) {
  function toggleStatus(status: string, checked: boolean) {
    const nextStatuses = checked
      ? [...filters.statuses, status]
      : filters.statuses.filter((item) => item !== status);

    onChange({ ...filters, statuses: nextStatuses });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Filtros da bancada</h3>
          <p className="mt-1 text-sm text-slate-400">Recorte o Kanban por dono, status, tipo e urgência real.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10"
          onClick={() => onChange(DEFAULT_KANBAN_FILTERS)}
        >
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Busca</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Buscar tarefa, dono ou contexto..."
              className="border-white/10 bg-black/20 pl-9 text-white"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo</label>
          <Select
            value={filters.contextType}
            onValueChange={(value: "todos" | "projeto" | "iniciativa") => onChange({ ...filters, contextType: value })}
          >
            <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="iniciativa">Experimentos internos</SelectItem>
              <SelectItem value="projeto">Projetos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Responsável</label>
          <Select value={filters.assignee} onValueChange={(value) => onChange({ ...filters, assignee: value })}>
            <SelectTrigger className="w-full border-white/10 bg-black/20 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {assigneeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "todos" ? "Todos" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Alertas</label>
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <Checkbox
              checked={filters.onlyCritical}
              onCheckedChange={(checked) => onChange({ ...filters, onlyCritical: checked === true })}
            />
            <Siren className="h-4 w-4 text-amber-300" />
            Só risco de explosão
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <Checkbox
              checked={filters.onlyUnassigned}
              onCheckedChange={(checked) => onChange({ ...filters, onlyUnassigned: checked === true })}
            />
            <UserRoundX className="h-4 w-4 text-slate-300" />
            Só sem dono
          </label>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-4">
        {STATUS_OPTIONS.map((status) => {
          const checked = filters.statuses.includes(status);
          return (
            <label key={status} className="flex items-center gap-3 text-sm text-slate-200">
              <Checkbox checked={checked} onCheckedChange={(value) => toggleStatus(status, value === true)} />
              <span>{status}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
