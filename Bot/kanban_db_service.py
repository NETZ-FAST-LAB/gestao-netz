import json
import re
import unicodedata
import uuid
from datetime import date, datetime
from database import get_db_session
from sqlalchemy import text


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "item"


def _normalize_person_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", normalized.lower()).strip()


def _canonical_task_title(value: str) -> str:
    normalized = _normalize_person_name(value)
    normalized = re.sub(r"\[[^\]]+\]", " ", normalized)
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _status_to_display(status_value: str) -> str:
    mapping = {
        "pending": "Pendente",
        "in_progress": "Em andamento",
        "review": "Em revisão",
        "completed": "Concluído",
    }
    return mapping.get((status_value or "").strip(), status_value or "Pendente")


def _status_to_db(status_value: str) -> str:
    normalized = _normalize_person_name(status_value)
    if normalized in {"concluido", "concluida", "completed", "done"}:
        return "completed"
    if normalized in {"em andamento", "in progress", "in_progress", "doing"}:
        return "in_progress"
    if normalized in {"em revisao", "review"}:
        return "review"
    return "pending"


def _parse_brazilian_due_date(value: str | None) -> str:
    if not value: return ""
    cleaned = value.strip()
    match = re.match(r"^(?P<day>\d{1,2})[/-](?P<month>\d{1,2})(?:[/-](?P<year>\d{2,4}))?$", cleaned)
    if not match: return ""
    day, month = int(match.group("day")), int(match.group("month"))
    year_raw = match.group("year")
    year = date.today().year if not year_raw else int(year_raw)
    if year < 100: year += 2000
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def _iso_to_display_date(value: str) -> str:
    if not value:
        return "sem data"
    try:
        parsed = date.fromisoformat(value)
        return parsed.strftime("%d/%m/%Y")
    except ValueError:
        return value


async def get_tasks(filtro_responsavel: str) -> str:
    async with get_db_session() as session:
        filtro = filtro_responsavel.lower()
        if filtro == "todas":
            res = await session.execute(text("SELECT p.title as ptitle, p.id as pid, t.id as tid, t.title as ttitle, t.status, t.assignee FROM tasks t JOIN projects p ON p.id = t.project_id"))
        elif filtro == "unassigned":
            res = await session.execute(text("SELECT p.title as ptitle, p.id as pid, t.id as tid, t.title as ttitle, t.status, t.assignee FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.assignee IS NULL OR t.assignee = ''"))
        else:
            res = await session.execute(text("SELECT p.title as ptitle, p.id as pid, t.id as tid, t.title as ttitle, t.status, t.assignee FROM tasks t JOIN projects p ON p.id = t.project_id WHERE LOWER(t.assignee) LIKE :f"), {"f": f"%{filtro}%"})
        
        todas_tarefas = []
        for r in res.fetchall():
            owner = r.assignee or "Sem Dono"
            card_type = "PROJETO" if "proj" in (r.pid or "").lower() else "INICIATIVA"
            todas_tarefas.append(f"[{card_type}: {r.ptitle}] ID: {r.tid} -> {r.ttitle} (Status: {r.status} | Dono: {owner})")
            
        if not todas_tarefas:
            return json.dumps({"status": "success", "message": f"Nenhuma tarefa corresponde ao filtro '{filtro_responsavel}'."})
        return json.dumps({"status": "success", "tarefas": todas_tarefas})


async def assign_all_unassigned_tasks(novo_responsavel: str) -> str:
    async with get_db_session() as session:
        res = await session.execute(text("UPDATE tasks SET assignee = :n WHERE assignee IS NULL OR assignee = ''"), {"n": novo_responsavel})
        await session.commit()
        return json.dumps({"status": "success", "message": f"Pronto. Exatamente {res.rowcount} tarefas sem dono foram agora jogadas nas costas de {novo_responsavel}."})


async def create_new_kanban_card(tipo: str, titulo: str, responsavel: str) -> str:
    async with get_db_session() as session:
        card_prefix = "proj" if tipo.lower().startswith("proj") else "inic"
        base_id = f"{card_prefix}-{_slugify(titulo)}-{uuid.uuid4().hex[:6]}"
        column = "Backlog" if card_prefix == "proj" else "Ideias"
        
        await session.execute(
            text("INSERT INTO projects (id, title, client, owner, column_status, tags, meta) VALUES (:id, :title, :client, :owner, :col, :tags, :meta)"),
            {
                "id": base_id, "title": titulo, "client": responsavel if card_prefix=="proj" else "",
                "owner": responsavel, "col": column, "tags": '["AI-Created"]', "meta": '{"health": "No Prazo"}'
            }
        )
        await session.commit()
        return json.dumps({"status": "success", "message": f"{tipo.capitalize()} criada com sucesso!"})


async def create_github_task(tipo: str, contexto_id: str, titulo_tarefa: str, responsavel: str) -> str:
    async with get_db_session() as session:
        res = await session.execute(text("SELECT id FROM projects WHERE LOWER(title) LIKE :ctx OR LOWER(id) LIKE :ctx LIMIT 1"), {"ctx": f"%{contexto_id.lower()}%"})
        project = res.fetchone()
        
        if not project:
            return json.dumps({"status": "error", "message": f"Nao encontrei a iniciativa/projeto chamado '{contexto_id}'."})
            
        task_id = f"task-{uuid.uuid4().hex[:8]}"
        await session.execute(
            text("INSERT INTO tasks (id, project_id, title, assignee, status, due_date) VALUES (:id, :pid, :title, :assignee, 'pending', '')"),
            {"id": task_id, "pid": project.id, "title": titulo_tarefa, "assignee": responsavel}
        )
        await session.commit()
        return json.dumps({"status": "success", "message": "Tarefa criada!"})


async def edit_github_task(tipo: str, titulo_tarefa_atual: str, novo_responsavel: str = None, novo_status: str = None, nova_data: str = None) -> str:
    async with get_db_session() as session:
        n_title = _normalize_person_name(titulo_tarefa_atual)
        res = await session.execute(text("SELECT id FROM tasks WHERE LOWER(title) = :nt OR id = :nt"), {"nt": n_title})
        tasks = res.fetchall()
        
        if not tasks:
            res = await session.execute(text("SELECT id FROM tasks WHERE LOWER(title) LIKE :nt"), {"nt": f"%{n_title}%"})
            tasks = res.fetchall()
            
        if not tasks:
            return json.dumps({"status": "error", "message": "Tarefa nao encontrada."})
        if len(tasks) > 1:
            return json.dumps({"status": "error", "message": f"Achei {len(tasks)} tarefas parecidas. Seja mais específico."})
            
        task_id = tasks[0].id
        updates = []
        params = {"tid": task_id}
        
        if novo_responsavel is not None:
            updates.append("assignee = :assignee")
            params["assignee"] = novo_responsavel
        if novo_status is not None:
            updates.append("status = :status")
            params["status"] = _status_to_db(novo_status)
        if nova_data is not None:
            updates.append("due_date = :due")
            params["due"] = nova_data
            
        if updates:
            query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = :tid"
            await session.execute(text(query), params)
            await session.commit()
            return json.dumps({"status": "success", "message": "Uma tarefa editada."})
            
        return json.dumps({"status": "error", "message": "Nenhuma mudanca pedida."})

        
async def get_operational_snapshot(reference_date: date | None = None) -> dict:
    today = reference_date or date.today()
    unassigned_count = 0
    overdue_count = 0
    
    async with get_db_session() as session:
        res = await session.execute(text("SELECT p.title as ptitle, p.id as pid, t.title as ttitle, t.assignee, t.due_date, t.status FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.status != 'completed'"))
        
        for r in res.fetchall():
            if not r.assignee:
                unassigned_count += 1
            if r.due_date:
                try:
                    if date.fromisoformat(r.due_date) < today:
                        overdue_count += 1
                except ValueError:
                    pass

    return {
        "reference_date": today.isoformat(),
        "unassigned_count": unassigned_count,
        "overdue_count": overdue_count,
    }


async def build_task_catalog_prompt_snippet() -> str:
    async with get_db_session() as session:
        res = await session.execute(text("SELECT p.id as pid, p.title as ptitle, t.id as tid, t.title as ttitle, t.status, t.assignee FROM projects p LEFT JOIN tasks t ON p.id = t.project_id"))
        
        catalog = {}
        for r in res.fetchall():
            if r.pid not in catalog:
                catalog[r.pid] = {"title": r.ptitle, "tasks": []}
            if r.tid:
                catalog[r.pid]["tasks"].append(f"{r.ttitle} [{_status_to_display(r.status)}; {r.assignee or 'Sem dono'}]")
        
        lines = []
        for pid, data in catalog.items():
            t_tipo = "Projeto" if "proj" in pid.lower() else "Iniciativa"
            tasks_str = "; ".join(data["tasks"]) if data["tasks"] else "Sem tarefas"
            lines.append(f"{t_tipo}: {data['title']} -> {tasks_str}")
        return "\n".join(lines)


tool_schemas = [
    {
        "type": "function",
        "function": {
            "name": "get_tasks",
            "description": "Busca tarefas no banco de dados.",
            "parameters": {"type": "object", "properties": {"filtro_responsavel": {"type": "string"}}, "required": ["filtro_responsavel"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_all_unassigned_tasks",
            "description": "Atribui tarefas sem dono.",
            "parameters": {"type": "object", "properties": {"novo_responsavel": {"type": "string"}}, "required": ["novo_responsavel"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_new_kanban_card",
            "description": "Cria um novo Projeto ou Iniciativa.",
            "parameters": {"type": "object", "properties": {"tipo": {"type": "string"}, "titulo": {"type": "string"}, "responsavel": {"type": "string"}}, "required": ["tipo", "titulo", "responsavel"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_github_task",
            "description": "Cria nova tarefa.",
            "parameters": {"type": "object", "properties": {"tipo": {"type": "string"}, "contexto_id": {"type": "string"}, "titulo_tarefa": {"type": "string"}, "responsavel": {"type": "string"}}, "required": ["tipo", "contexto_id", "titulo_tarefa", "responsavel"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_github_task",
            "description": "Edita tarefa.",
            "parameters": {"type": "object", "properties": {"tipo": {"type": "string"}, "titulo_tarefa_atual": {"type": "string"}, "novo_responsavel": {"type": "string"}, "novo_status": {"type": "string"}, "nova_data": {"type": "string"}}, "required": ["tipo", "titulo_tarefa_atual"]},
        },
    }
]

available_functions = {
    "get_tasks": get_tasks,
    "assign_all_unassigned_tasks": assign_all_unassigned_tasks,
    "create_new_kanban_card": create_new_kanban_card,
    "create_github_task": create_github_task,
    "edit_github_task": edit_github_task,
}

async def get_partner_workload_snapshot(partners: list[dict], threshold: int = 3) -> dict:
    partner_rows = []
    for partner in partners:
        aliases = {_normalize_person_name(alias) for alias in partner.get("aliases", []) if alias}
        partner_rows.append({"key": partner["key"], "display_name": partner["display_name"], "mention": partner["mention"], "aliases": aliases, "active_task_count": 0, "active_examples": [], "active_tasks": []})
    async with get_db_session() as session:
        res = await session.execute(text("SELECT p.title as ptitle, t.title as ttitle, t.assignee, t.due_date, t.status FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.status != 'completed'"))
        for r in res.fetchall():
            if not r.assignee: continue
            assignee = _normalize_person_name(r.assignee)
            for provider in partner_rows:
                if assignee in provider["aliases"]:
                    provider["active_task_count"] += 1
                    provider["active_tasks"].append({"card_title": r.ptitle or "Sem contexto", "task_title": r.ttitle or "Sem titulo", "due_date": r.due_date or "", "status": r.status or "pending"})
                    if len(provider["active_examples"]) < 2:
                        provider["active_examples"].append(f"{r.ptitle}: {r.ttitle}")
                    break
    for p in partner_rows:
        p["below_threshold"] = p["active_task_count"] < threshold
        p.pop("aliases", None)
    return {"threshold": threshold, "partners": partner_rows, "low_workload_partners": [p for p in partner_rows if p["below_threshold"]]}
