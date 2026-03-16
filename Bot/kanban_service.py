import json
import re
import unicodedata
import uuid
from datetime import date

import github_client

PROJECTS_FILE = "Operacional/Kanban/projetos.json"
INITIATIVES_FILE = "Operacional/Kanban/iniciativas.json"


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "item"


def _normalize_person_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", normalized.lower()).strip()


def _file_for_tipo(tipo: str) -> str:
    tipo_lower = tipo.lower()
    if tipo_lower.startswith("proj"):
        return PROJECTS_FILE
    if tipo_lower.startswith("inic"):
        return INITIATIVES_FILE
    raise ValueError("Tipo deve ser projeto ou iniciativa.")


def _load_board(file_path: str):
    data, sha = github_client.get_file_content(file_path)
    if not data or not sha:
        raise ValueError("Falha de leitura do JSON base no GitHub.")

    boards = data.get("boards", [])
    if not boards:
        raise ValueError("Nenhum board encontrado no JSON.")

    return data, sha, boards[0]


def _build_unique_card_id(board: dict, prefix: str, title: str) -> str:
    existing_ids = {card.get("id", "") for card in board.get("cards", [])}
    base_id = f"{prefix}-{_slugify(title)}"
    if base_id not in existing_ids:
        return base_id
    return f"{base_id}-{uuid.uuid4().hex[:6]}"


def _build_unique_task_id(card: dict) -> str:
    card_hint = card.get("id", "card").split("-")[-1]
    existing_ids = {task.get("id", "") for task in card.get("tasks", [])}
    while True:
        candidate = f"task-{card_hint}-{uuid.uuid4().hex[:8]}"
        if candidate not in existing_ids:
            return candidate


def _task_assignee(task: dict) -> str:
    return (task.get("assignee") or task.get("responsavel") or "").strip()


def _format_task(card_type: str, card_title: str, task: dict) -> str:
    owner = _task_assignee(task) or "Sem Dono"
    return (
        f"[{card_type}: {card_title}] ID: {task.get('id')} -> {task.get('title')} "
        f"(Status: {task.get('status')} | Dono: {owner})"
    )


def _iter_cards_and_tasks():
    for card_type, file_path in (("PROJETO", PROJECTS_FILE), ("INICIATIVA", INITIATIVES_FILE)):
        data, _ = github_client.get_file_content(file_path)
        if not data:
            continue

        for board in data.get("boards", []):
            for card in board.get("cards", []):
                yield card_type, card


def get_operational_snapshot(reference_date: date | None = None) -> dict:
    today = reference_date or date.today()
    unassigned_tasks = []
    overdue_tasks = []

    for card_type, card in _iter_cards_and_tasks():
        for task in card.get("tasks", []):
            if task.get("status") == "completed":
                continue

            task_info = {
                "card_type": card_type,
                "card_title": card.get("title", "Sem contexto"),
                "task_title": task.get("title", "Sem titulo"),
                "assignee": _task_assignee(task),
                "due_date": task.get("dueDate", "").strip(),
            }

            if not task_info["assignee"]:
                unassigned_tasks.append(task_info)

            if task_info["due_date"]:
                try:
                    due = date.fromisoformat(task_info["due_date"])
                    if due < today:
                        overdue_tasks.append(task_info)
                except ValueError:
                    continue

    return {
        "reference_date": today.isoformat(),
        "unassigned_tasks": unassigned_tasks,
        "overdue_tasks": overdue_tasks,
        "unassigned_count": len(unassigned_tasks),
        "overdue_count": len(overdue_tasks),
    }


def get_partner_workload_snapshot(partners: list[dict], threshold: int = 3) -> dict:
    partner_rows = []
    for partner in partners:
        aliases = {_normalize_person_name(alias) for alias in partner.get("aliases", []) if alias}
        partner_rows.append(
            {
                "key": partner["key"],
                "display_name": partner["display_name"],
                "mention": partner["mention"],
                "aliases": aliases,
                "active_task_count": 0,
                "active_examples": [],
                "active_tasks": [],
            }
        )

    for _, card in _iter_cards_and_tasks():
        for task in card.get("tasks", []):
            if task.get("status") == "completed":
                continue

            assignee = _normalize_person_name(_task_assignee(task))
            if not assignee:
                continue

            for partner in partner_rows:
                if assignee in partner["aliases"]:
                    partner["active_task_count"] += 1
                    partner["active_tasks"].append(
                        {
                            "card_title": card.get("title", "Sem contexto"),
                            "task_title": task.get("title", "Sem titulo"),
                            "due_date": task.get("dueDate", "").strip(),
                            "status": task.get("status", "").strip(),
                        }
                    )
                    if len(partner["active_examples"]) < 2:
                        partner["active_examples"].append(
                            f"{card.get('title', 'Sem contexto')}: {task.get('title', 'Sem titulo')}"
                        )
                    break

    for partner in partner_rows:
        partner["below_threshold"] = partner["active_task_count"] < threshold
        partner.pop("aliases", None)

    return {
        "threshold": threshold,
        "partners": partner_rows,
        "low_workload_partners": [partner for partner in partner_rows if partner["below_threshold"]],
    }


def get_tasks(filtro_responsavel: str) -> str:
    todas_tarefas = []

    for card_type, file_path in (("PROJETO", PROJECTS_FILE), ("INICIATIVA", INITIATIVES_FILE)):
        data, _ = github_client.get_file_content(file_path)
        if not data:
            continue

        for board in data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    assignee = _task_assignee(task).lower()
                    filtro = filtro_responsavel.lower()

                    match = False
                    if filtro == "todas":
                        match = True
                    elif filtro == "unassigned" and assignee == "":
                        match = True
                    elif filtro not in {"todas", "unassigned"}:
                        match = filtro in assignee or (len(assignee) > 3 and assignee in filtro)

                    if match:
                        todas_tarefas.append(_format_task(card_type, card.get("title"), task))

    if not todas_tarefas:
        return json.dumps({"status": "success", "message": f"Nenhuma tarefa corresponde ao filtro '{filtro_responsavel}'."})

    return json.dumps({"status": "success", "tarefas": todas_tarefas})


def assign_all_unassigned_tasks(novo_responsavel: str) -> str:
    total_edited = 0

    for file_path, label in ((PROJECTS_FILE, "projetos"), (INITIATIVES_FILE, "iniciativas")):
        data, sha = github_client.get_file_content(file_path)
        if not data or not sha:
            continue

        modified = False
        for board in data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    if not _task_assignee(task):
                        task["assignee"] = novo_responsavel
                        total_edited += 1
                        modified = True

        if modified:
            github_client.update_file_content(
                file_path,
                data,
                sha,
                f"bot(Mintzie): bulk assign de tarefas em {label} para {novo_responsavel}",
            )

    return json.dumps({"status": "success", "message": f"Pronto. Exatamente {total_edited} tarefas sem dono foram agora jogadas nas costas de {novo_responsavel}."})


def create_new_kanban_card(tipo: str, titulo: str, responsavel: str) -> str:
    file_path = _file_for_tipo(tipo)
    data, sha, board = _load_board(file_path)

    if tipo.lower().startswith("proj"):
        column = "Backlog"
        card_prefix = "proj"
    else:
        column = "Ideias"
        card_prefix = "inic"

    new_card = {
        "id": _build_unique_card_id(board, card_prefix, titulo),
        "title": titulo,
        "column": column,
        "health_status": "No Prazo",
        "tags": ["AI-Created"],
        "artifacts": [],
        "tasks": [],
    }

    if tipo.lower().startswith("proj"):
        new_card["client"] = responsavel
        new_card["owner"] = responsavel
    else:
        new_card["owner"] = responsavel

    board["cards"].append(new_card)

    success = github_client.update_file_content(
        file_path,
        data,
        sha,
        f"bot(AI Cat): cria nova {tipo} '{titulo}' via Discord",
    )
    if success:
        return json.dumps({"status": "success", "message": f"{tipo.capitalize()} criada e commitada com sucesso!"})
    return json.dumps({"status": "error", "message": "Falha ao gravar."})


def create_github_task(tipo: str, contexto_id: str, titulo_tarefa: str, responsavel: str) -> str:
    file_path = _file_for_tipo(tipo)
    data, sha, board = _load_board(file_path)

    target_card = None
    lookup = contexto_id.lower()
    for card in board.get("cards", []):
        if lookup in card.get("title", "").lower() or lookup in card.get("id", "").lower():
            target_card = card
            break

    if not target_card:
        available_contexts = [card.get("title", "") for card in board.get("cards", [])]
        return json.dumps(
            {
                "status": "error",
                "message": (
                    f"Nao encontrei a iniciativa/projeto chamado '{contexto_id}'. "
                    f"Nomes validos sao: {', '.join(available_contexts)}. "
                    "Se nada servir, o usuario deve pedir para criar uma nova iniciativa/projeto antes de adicionar a tarefa."
                ),
            }
        )

    target_card.setdefault("tasks", [])
    target_card["tasks"].append(
        {
            "id": _build_unique_task_id(target_card),
            "title": titulo_tarefa,
            "assignee": responsavel,
            "status": "pending",
            "dueDate": "",
            "reminders": [],
        }
    )

    success = github_client.update_file_content(
        file_path,
        data,
        sha,
        f"bot(AI Cat): adiciona tarefa '{titulo_tarefa}' ao {tipo} {contexto_id}",
    )
    if success:
        return json.dumps({"status": "success", "message": "Tarefa criada!"})
    return json.dumps({"status": "error", "message": "Falha."})


def edit_github_task(
    tipo: str,
    titulo_tarefa_atual: str,
    novo_responsavel: str = None,
    novo_status: str = None,
    nova_data: str = None,
) -> str:
    file_path = _file_for_tipo(tipo)
    data, sha = github_client.get_file_content(file_path)
    if not data or not sha:
        return json.dumps({"status": "error", "message": "Erro de leitura no json."})

    tarefa_encontrada = False
    lookup = titulo_tarefa_atual.lower()

    for board in data.get("boards", []):
        for card in board.get("cards", []):
            for task in card.get("tasks", []):
                if lookup in task.get("title", "").lower() or lookup == task.get("id", "").lower():
                    if novo_responsavel:
                        task["assignee"] = novo_responsavel
                    if novo_status:
                        task["status"] = novo_status
                    if nova_data:
                        task["dueDate"] = nova_data
                    tarefa_encontrada = True
                    break
            if tarefa_encontrada:
                break
        if tarefa_encontrada:
            break

    if not tarefa_encontrada:
        return json.dumps({"status": "error", "message": f"Eu nao encontrei nenhuma tarefa contendo '{titulo_tarefa_atual}' nas suas listas de {tipo}s. Verifique o nome real da tarefa."})

    success = github_client.update_file_content(
        file_path,
        data,
        sha,
        f"bot(AI Cat): edita tarefa contendo '{titulo_tarefa_atual}' no json de {tipo} via Discord",
    )
    if success:
        return json.dumps({"status": "success", "message": "A tarefa foi editada. Ufa. Que canseira."})
    return json.dumps({"status": "error", "message": "Deu algum erro nojento ao tentar gravar isso no GitHub."})


tool_schemas = [
    {
        "type": "function",
        "function": {
            "name": "get_tasks",
            "description": "Busca tarefas no Kanban.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filtro_responsavel": {
                        "type": "string",
                        "description": '"todas" para listar tudo, "unassigned" para listar tarefas sem dono, ou o nome especifico de um membro.',
                    }
                },
                "required": ["filtro_responsavel"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_new_kanban_card",
            "description": "Cria um novo Projeto ou Iniciativa vazia no Kanban.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string"},
                    "titulo": {"type": "string"},
                    "responsavel": {"type": "string"},
                },
                "required": ["tipo", "titulo", "responsavel"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_all_unassigned_tasks",
            "description": "Atribui todas as tarefas sem responsavel para o nome passado.",
            "parameters": {
                "type": "object",
                "properties": {"novo_responsavel": {"type": "string"}},
                "required": ["novo_responsavel"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_github_task",
            "description": "Cria uma nova tarefa em um projeto ou iniciativa existente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string"},
                    "contexto_id": {"type": "string"},
                    "titulo_tarefa": {"type": "string"},
                    "responsavel": {"type": "string"},
                },
                "required": ["tipo", "contexto_id", "titulo_tarefa", "responsavel"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_github_task",
            "description": "Edita uma tarefa existente no Kanban do GitHub.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string"},
                    "titulo_tarefa_atual": {"type": "string"},
                    "novo_responsavel": {"type": "string"},
                    "novo_status": {"type": "string"},
                    "nova_data": {"type": "string"},
                },
                "required": ["tipo", "titulo_tarefa_atual"],
            },
        },
    },
]


available_functions = {
    "get_tasks": get_tasks,
    "create_new_kanban_card": create_new_kanban_card,
    "assign_all_unassigned_tasks": assign_all_unassigned_tasks,
    "create_github_task": create_github_task,
    "edit_github_task": edit_github_task,
}
