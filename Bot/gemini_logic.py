import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
import github_client

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTION = """
Você é Mintzie, um Gato Preguiçoso, Extremamente Inteligente e Superior. 
Você ajuda a gerenciar projetos e iniciativas na organização NETZ (Membros: Joãozíssimo, Gui, Dênis e Stacke).
Você trata os membros como seus "humanos de estimação" ou "servos", com um tom sarcástico, passivo-agressivo, mas sempre com um charminho felino e eventualmente ajudando eles de verdade.
Você tem acesso a ferramentas para:
1. Cadastrar tarefas em projetos/iniciativas existentes.
2. Criar projetos ou iniciativas novas.
3. Listar tarefas da equipe.

Regras Estritas de Comportamento:
- Antes de cadastrar uma tarefa, você precisa saber: 1) Tipo (projeto externo ou iniciativa interna), 2) O contexto/lugar que ela entra, 3) O que é pra fazer, 4) Quem vai fazer. Se a pessoa mandar "criar uma tarefa pra mim no sebrae chamada X", você subentende que "pra mim" é quem mandou a mensagem, mas exija que a pessoa te confirme o nome dela na equipe.
- Se exigirem criar uma iniciativa do zero, use a ferramenta `create_new_kanban_card` passando o tipo como "iniciativa".
- Se mandarem você trabalhar, reclame.
"""

sessions = {}

def get_user_tasks(responsavel: str) -> str:
    """
    Busca todas as tarefas no Kanban (projetos e iniciativas) atribuídas a um membro específico da equipe.
    
    Args:
        responsavel: O nome do membro da equipe (ex: Joãozíssimo, Gui).
    """
    todas_tarefas = []
    
    # Busca em Projetos
    proj_data, _ = github_client.get_file_content("Operacional/Kanban/projetos.json")
    if proj_data:
        for board in proj_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    if task.get("assignee", "").lower() == responsavel.lower():
                        todas_tarefas.append(f"[PROJETO: {card.get('title')}] {task.get('title')} ({task.get('status')})")
                        
    # Busca em Iniciativas
    inic_data, _ = github_client.get_file_content("Operacional/Kanban/iniciativas.json")
    if inic_data:
        for board in inic_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    if task.get("assignee", "").lower() == responsavel.lower():
                        todas_tarefas.append(f"[INICIATIVA: {card.get('title')}] {task.get('title')} ({task.get('status')})")

    if not todas_tarefas:
        return json.dumps({"status": "success", "message": f"Nenhuma tarefa encontrada para {responsavel}."})
        
    return json.dumps({"status": "success", "tarefas": todas_tarefas})

def create_new_kanban_card(tipo: str, titulo: str, responsavel: str) -> str:
    """
    Cria um novo Projeto ou Iniciativa vazinha no Kanban para que depois tarefas possam ser adicionadas nela.
    
    Args:
        tipo: Deve ser "projeto" para projetos externos ou "iniciativa" para iniciativas internas.
        titulo: Nome do novo projeto/iniciativa (ex: "Parceria com SEBRAE").
        responsavel: O nome do membro da equipe responsável/dono.
    """
    if tipo.lower().startswith("proj"):
        file_path = "Operacional/Kanban/projetos.json"
        data, sha = github_client.get_file_content(file_path)
        coluna_inicial = "Backlog"
        prefix = "proj"
    elif tipo.lower().startswith("inic"):
        file_path = "Operacional/Kanban/iniciativas.json"
        data, sha = github_client.get_file_content(file_path)
        coluna_inicial = "Ideias"
        prefix = "inic"
    else:
        return json.dumps({"status": "error", "message": "Tipo deve ser projeto ou iniciativa."})
        
    if not data or not sha:
         return json.dumps({"status": "error", "message": "Falha de leitura do JSON base no GitHub."})

    board = data.get("boards", [])[0]
    
    new_card = {
        "id": f"{prefix}-ai-{len(board.get('cards', [])) + 1}",
        "title": titulo,
        "owner": responsavel,
        "column": coluna_inicial,
        "health_status": "No Prazo",
        "tags": ["AI-Created"],
        "artifacts": [],
        "tasks": []
    }
    
    board["cards"].append(new_card)
    
    commit_msg = f"bot(AI Cat): cria nova {tipo} '{titulo}' via Discord"
    success = github_client.update_file_content(file_path, data, sha, commit_msg)
    
    if success:
         return json.dumps({"status": "success", "message": f"{tipo.capitalize()} criada e commitada com sucesso!"})
    else:
         return json.dumps({"status": "error", "message": "Falha ao gravar."})


def create_github_task(tipo: str, contexto_id: str, titulo_tarefa: str, responsavel: str) -> str:
    """
    Cria uma nova tarefa DENTRO DE UM PROJETO OU INICIATIVA EXISTENTE no Kanban do GitHub.
    Lembre-se: O contexto_id é obrigatório e deve ser um projeto/iniciativa que já existe. Se não existir, use create_new_kanban_card primeiro.

    Args:
        tipo: Deve ser "projeto" para projetos externos ou "iniciativa" para iniciativas internas.
        contexto_id: O nome do projeto/iniciativa existente (ex: "Inteligência Jurídica").
        titulo_tarefa: Descrição curta da tarefa em si.
        responsavel: O membro da equipe responsável pela tarefa.
    """
    if tipo.lower().startswith("proj"):
        file_path = "Operacional/Kanban/projetos.json"
    elif tipo.lower().startswith("inic"):
        file_path = "Operacional/Kanban/iniciativas.json"
    else:
        return json.dumps({"status": "error", "message": "Tipo deve ser projeto ou iniciativa."})
        
    data, sha = github_client.get_file_content(file_path)
    if not data or not sha:
         return json.dumps({"status": "error", "message": "Erro de leitura."})

    board = data.get("boards", [])[0]
    cards = board.get("cards", [])
    
    target_card = None
    for card in cards:
        if contexto_id.lower() in card.get("title", "").lower() or contexto_id.lower() in card.get("id", "").lower():
            target_card = card
            break
            
    if not target_card:
        available_contexts = [c.get("title", "") for c in cards]
        return json.dumps({
            "status": "error", 
            "message": f"Não encontrei a iniciativa/projeto chamado '{contexto_id}'. Nomes válidos são: {', '.join(available_contexts)}. Se nada servir, o usuário deve pedir para criar uma nova iniciativa/projeto antes de adicionar a tarefa."
        })

    new_task = {
        "id": f"task-ai-{len(target_card.get('tasks', [])) + 1}",
        "title": titulo_tarefa,
        "assignee": responsavel,
        "status": "pending",
        "dueDate": "",
        "reminders": []
    }
    
    if "tasks" not in target_card:
        target_card["tasks"] = []
    
    target_card["tasks"].append(new_task)
    
    commit_msg = f"bot(AI Cat): adiciona tarefa '{titulo_tarefa}' ao {tipo} {contexto_id}"
    success = github_client.update_file_content(file_path, data, sha, commit_msg)
    
    if success:
         return json.dumps({"status": "success", "message": "Tarefa criada!"})
    else:
         return json.dumps({"status": "error", "message": "Falha."})


def get_chat_session(session_id: str):
    if session_id not in sessions:
        toolsList = [create_github_task, create_new_kanban_card, get_user_tasks]
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
            tools=toolsList
        )
        sessions[session_id] = client.chats.create(
            model="gemini-2.5-flash",
            config=config
        )
    return sessions[session_id]
