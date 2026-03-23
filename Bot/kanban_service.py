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


def _normalize_task_title(value: str) -> str:
    return _normalize_person_name(value)


def _canonical_task_title(value: str) -> str:
    normalized = _normalize_task_title(value)
    normalized = re.sub(r"\[[^\]]+\]", " ", normalized)
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _status_to_github(status_value: str) -> str:
    normalized = _normalize_person_name(status_value)
    if normalized in {"concluido", "concluida", "completed", "done"}:
        return "completed"
    if normalized in {"em andamento", "in progress", "in_progress", "doing"}:
        return "in_progress"
    if normalized in {"em revisao", "review"}:
        return "review"
    return "pending"


def _parse_brazilian_due_date(value: str | None) -> str:
    if not value:
        return ""

    cleaned = value.strip()
    match = re.match(r"^(?P<day>\d{1,2})[/-](?P<month>\d{1,2})(?:[/-](?P<year>\d{2,4}))?$", cleaned)
    if not match:
        return ""

    day = int(match.group("day"))
    month = int(match.group("month"))
    year_raw = match.group("year")
    year = date.today().year if not year_raw else int(year_raw)
    if year < 100:
        year += 2000

    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def _find_best_task_matches(tasks: list[dict], requested_title: str) -> list[dict]:
    normalized_lookup = _normalize_task_title(requested_title)
    canonical_lookup = _canonical_task_title(requested_title)

    exact_matches = []
    canonical_matches = []
    partial_matches = []

    for task in tasks:
        task_title = task.get("title", "")
        normalized_title = _normalize_task_title(task_title)
        canonical_title = _canonical_task_title(task_title)

        if normalized_title == normalized_lookup:
            exact_matches.append(task)
            continue

        if canonical_title == canonical_lookup:
            canonical_matches.append(task)
            continue

        if canonical_lookup and (canonical_lookup in canonical_title or canonical_title in canonical_lookup):
            partial_matches.append(task)

    return exact_matches or canonical_matches or partial_matches


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

    normalized_lookup = _normalize_task_title(titulo_tarefa_atual)
    exact_matches = []
    partial_matches = []

    for board in data.get("boards", []):
        for card in board.get("cards", []):
            for task in card.get("tasks", []):
                task_title = task.get("title", "")
                normalized_title = _normalize_task_title(task_title)
                if normalized_lookup == task.get("id", "").lower() or normalized_title == normalized_lookup:
                    exact_matches.append((card, task))
                elif normalized_lookup and normalized_lookup in normalized_title:
                    partial_matches.append((card, task))

    candidates = exact_matches or partial_matches
    if not candidates:
        return json.dumps(
            {
                "status": "error",
                "message": f"Eu nao encontrei nenhuma tarefa correspondente a '{titulo_tarefa_atual}' nas suas listas de {tipo}s. Verifique o nome real da tarefa.",
            }
        )

    if len(candidates) > 1:
        options = [
            f"{card.get('title', 'Sem contexto')}: {task.get('title', 'Sem titulo')}"
            for card, task in candidates[:5]
        ]
        return json.dumps(
            {
                "status": "error",
                "message": (
                    "Achei mais de uma tarefa parecida com esse nome. "
                    f"Seja mais especifico. Exemplos: {'; '.join(options)}"
                ),
            }
        )

    _, task = candidates[0]
    if novo_responsavel:
        task["assignee"] = novo_responsavel
    if novo_status:
        task["status"] = _status_to_github(novo_status)
    if nova_data:
        task["dueDate"] = nova_data

    success = github_client.update_file_content(
        file_path,
        data,
        sha,
        f"bot(AI Cat): edita tarefa contendo '{titulo_tarefa_atual}' no json de {tipo} via Discord",
    )
    if success:
        return json.dumps({"status": "success", "message": "A tarefa foi editada. Ufa. Que canseira."})
    return json.dumps({"status": "error", "message": "Deu algum erro nojento ao tentar gravar isso no GitHub."})


def bulk_update_tasks_from_message(mensagem_status: str) -> str:
    sections = []
    current_tipo = None
    current_context = None
    current_tasks = []

    for raw_line in mensagem_status.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match_context = re.match(r"^(Iniciativa|Projeto)\s*:\s*(.+)$", line, re.IGNORECASE)
        if match_context:
            if current_tipo and current_context and current_tasks:
                sections.append((current_tipo, current_context, current_tasks))
            current_tipo = "iniciativa" if match_context.group(1).lower().startswith("inici") else "projeto"
            current_context = match_context.group(2).strip()
            current_tasks = []
            continue

        match_task = re.match(
            r"^\[(?P<status>[^\]]+)\]\s*(?P<title>.+?)(?:\s*\(Respons[aá]vel:\s*(?P<owner>[^)]+)\))?$",
            line,
            re.IGNORECASE,
        )
        if match_task and current_tipo and current_context:
            current_tasks.append(
                {
                    "status": match_task.group("status").strip(),
                    "title": match_task.group("title").strip(),
                    "owner": (match_task.group("owner") or "").strip(),
                }
            )

    if current_tipo and current_context and current_tasks:
        sections.append((current_tipo, current_context, current_tasks))

    if not sections:
        return json.dumps(
            {
                "status": "error",
                "message": (
                    "Nao encontrei uma lista estruturada de status. "
                    "Use blocos como 'Iniciativa: Nome' e linhas '[Pendente] Tarefa (...)'."
                ),
            }
        )

    total_updates = 0
    touched_files = {}

    for tipo, contexto, tasks in sections:
        file_path = _file_for_tipo(tipo)
        if file_path not in touched_files:
            data, sha = github_client.get_file_content(file_path)
            if not data or not sha:
                return json.dumps({"status": "error", "message": f"Falha ao ler o arquivo de {tipo}s."})
            touched_files[file_path] = {"data": data, "sha": sha}

        data = touched_files[file_path]["data"]
        normalized_context = _normalize_person_name(contexto)
        target_card = None
        for board in data.get("boards", []):
            for card in board.get("cards", []):
                card_name = _normalize_person_name(card.get("title", ""))
                if card_name == normalized_context:
                    target_card = card
                    break
            if target_card:
                break

        if not target_card:
            return json.dumps(
                {
                    "status": "error",
                    "message": f"Nao encontrei o contexto '{contexto}' entre os {tipo}s.",
                }
            )

        for task_update in tasks:
            normalized_title = _normalize_task_title(task_update["title"])
            matches = [
                task
                for task in target_card.get("tasks", [])
                if _normalize_task_title(task.get("title", "")) == normalized_title
            ]
            if len(matches) != 1:
                return json.dumps(
                    {
                        "status": "error",
                        "message": (
                            f"Encontrei {len(matches)} correspondencia(s) para '{task_update['title']}' em '{contexto}'. "
                            "Mande o nome exato da tarefa para eu não sair derramando reagente no laboratório."
                        ),
                    }
                )

            task = matches[0]
            task["status"] = _status_to_github(task_update["status"])
            if task_update["owner"]:
                task["assignee"] = task_update["owner"]
            total_updates += 1

    for file_path, payload in touched_files.items():
        success = github_client.update_file_content(
            file_path,
            payload["data"],
            payload["sha"],
            "bot(Mintzie): atualiza tarefas em lote via lista estruturada no Discord",
        )
        if not success:
            return json.dumps({"status": "error", "message": f"Falhei ao gravar atualizacoes em {file_path}."})

    return json.dumps(
        {
            "status": "success",
            "message": f"Atualizei {total_updates} tarefa(s) a partir da lista estruturada.",
        }
    )


def bulk_update_tasks_from_message_v2(mensagem_status: str) -> str:
    sections = []
    current_tipo = None
    current_context = None
    current_tasks = []

    for raw_line in mensagem_status.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match_context = re.match(r"^(Iniciativa|Projeto)\s*:\s*(.+)$", line, re.IGNORECASE)
        if match_context:
            if current_tipo and current_context and current_tasks:
                sections.append((current_tipo, current_context, current_tasks))
            current_tipo = "iniciativa" if match_context.group(1).lower().startswith("inici") else "projeto"
            current_context = match_context.group(2).strip()
            current_tasks = []
            continue

        match_task = re.match(
            (
                r"^\[(?P<status>[^\]]+)\]\s*"
                r"(?P<title>.+?)"
                r"(?:\s*\(Respons[a-zA-ZÀ-ÿ]*:\s*(?P<owner>[^)]+)\))?"
                r"(?:\s+nova\s+data\s*:\s*(?P<due_date>\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))?$"
            ),
            line,
            re.IGNORECASE,
        )
        if match_task and current_tipo and current_context:
            current_tasks.append(
                {
                    "status": match_task.group("status").strip(),
                    "title": match_task.group("title").strip(),
                    "owner": (match_task.group("owner") or "").strip(),
                    "due_date": _parse_brazilian_due_date(match_task.group("due_date")),
                }
            )

    if current_tipo and current_context and current_tasks:
        sections.append((current_tipo, current_context, current_tasks))

    if not sections:
        return json.dumps(
            {
                "status": "error",
                "message": (
                    "Nao encontrei uma lista estruturada de status. "
                    "Use blocos como 'Iniciativa: Nome' e linhas '[Pendente] Tarefa (...)'."
                ),
            }
        )

    total_updates = 0
    touched_files = {}

    for tipo, contexto, tasks in sections:
        file_path = _file_for_tipo(tipo)
        if file_path not in touched_files:
            data, sha = github_client.get_file_content(file_path)
            if not data or not sha:
                return json.dumps({"status": "error", "message": f"Falha ao ler o arquivo de {tipo}s."})
            touched_files[file_path] = {"data": data, "sha": sha}

        data = touched_files[file_path]["data"]
        normalized_context = _normalize_person_name(contexto)
        target_card = None
        for board in data.get("boards", []):
            for card in board.get("cards", []):
                card_name = _normalize_person_name(card.get("title", ""))
                if card_name == normalized_context:
                    target_card = card
                    break
            if target_card:
                break

        if not target_card:
            return json.dumps(
                {
                    "status": "error",
                    "message": f"Nao encontrei o contexto '{contexto}' entre os {tipo}s.",
                }
            )

        for task_update in tasks:
            matches = _find_best_task_matches(target_card.get("tasks", []), task_update["title"])
            if len(matches) != 1:
                return json.dumps(
                    {
                        "status": "error",
                        "message": (
                            f"Encontrei {len(matches)} correspondencia(s) para '{task_update['title']}' em '{contexto}'. "
                            "Mande o nome exato da tarefa para eu nao sair derramando reagente no laboratorio."
                        ),
                    }
                )

            task = matches[0]
            task["status"] = _status_to_github(task_update["status"])
            if task_update["owner"]:
                task["assignee"] = task_update["owner"]
            if task_update["due_date"]:
                task["dueDate"] = task_update["due_date"]
            total_updates += 1

    for file_path, payload in touched_files.items():
        success = github_client.update_file_content(
            file_path,
            payload["data"],
            payload["sha"],
            "bot(Mintzie): atualiza tarefas em lote via lista estruturada no Discord",
        )
        if not success:
            return json.dumps({"status": "error", "message": f"Falhei ao gravar atualizacoes em {file_path}."})

    return json.dumps(
        {
            "status": "success",
            "message": f"Atualizei {total_updates} tarefa(s) a partir da lista estruturada.",
        }
    )


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
            "description": "Edita UMA tarefa existente no Kanban do GitHub. Use apenas para tarefa individual e claramente identificada.",
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
    {
        "type": "function",
        "function": {
            "name": "bulk_update_tasks_from_message",
            "description": (
                "Atualiza varias tarefas de uma vez APENAS quando o usuario enviar uma lista estruturada "
                "com blocos como 'Iniciativa: Nome' ou 'Projeto: Nome' e linhas '[Status] Tarefa (Responsavel: X)'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "mensagem_status": {"type": "string"},
                },
                "required": ["mensagem_status"],
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
    "bulk_update_tasks_from_message": bulk_update_tasks_from_message_v2,
}
