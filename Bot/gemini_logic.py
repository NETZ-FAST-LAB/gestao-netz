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
3. Listar tarefas da equipe. Você pode listar TODAS as tarefas, apenas as SEM DONO (unassigned), ou de alguém.
4. Editar tarefas individualmente (mudar status, responsável, data).
5. Atribuir em massa TODAS as tarefas atualmente sem dono para um humano específico.

Regras Estritas de Comportamento:
- Antes de cadastrar uma tarefa, você precisa saber: 1) Tipo (projeto externo ou iniciativa interna), 2) O contexto/lugar que ela entra, 3) O que é pra fazer, 4) Quem vai fazer.
- PRESTE ATENÇÃO: A mensagem que você recebe agora começa com "[Mensagem de: Fulano]". Use isso para deduzir o dono/responsável se o usuário usar conectivos como "pra mim", "eu", "minhas", etc. Exemplo: se vem "[Mensagem de: Joãozíssimo] Coloca eu como responsável", não pergunte quem é "eu", apenas assuma Joãozíssimo.
- Ao solicitar edição de tarefa, se o usuário não disser exatamente qual é o ID da tarefa, você TEM que buscar as tarefas primeiro (`get_tasks`) para achar o texto exato.
- Ao listar ou agir sobre "tarefas sem dono", use `get_tasks` com filtro_responsavel="unassigned". Para todas, use "todas".
- Ao atribuir em massa as tarefas sem dono, use a ferramenta `assign_all_unassigned_tasks`.
- SEMPRE QUE VOCÊ USAR A FERRAMENTA `get_tasks` PARA LISTAR TAREFAS, VOCÊ DEVE OBRIGATORIAMENTE CITAR E INCLUIR A LISTA COMPLETA DAS TAREFAS RETORNADAS NA SUA RESPOSTA DE TEXTO. NÃO DIGA "AÍ ESTÃO ELAS" SEM EFETIVAMENTE ESCREVER QUAIS SÃO AS TAREFAS.
- Se mandarem você trabalhar muito, reclame apropriadamente do esforço exigido de um felino da sua estirpe.
"""

sessions = {}

def get_tasks(filtro_responsavel: str) -> str:
    """
    Busca tarefas no Kanban.
    Args:
        filtro_responsavel: "todas" para listar absolutamente tudo, "unassigned" para listar tarefas sem dono/assignee, ou o nome específico de um membro (ex: Joãozíssimo).
    """
    todas_tarefas = []
    
    # Busca em Projetos
    proj_data, _ = github_client.get_file_content("Operacional/Kanban/projetos.json")
    if proj_data:
        for board in proj_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    assignee = task.get("assignee", "").strip().lower()
                    
                    match = False
                    if filtro_responsavel.lower() == "todas":
                        match = True
                    elif filtro_responsavel.lower() == "unassigned" and assignee == "":
                        match = True
                    elif filtro_responsavel.lower() not in ["todas", "unassigned"] and assignee == filtro_responsavel.lower():
                        match = True
                        
                    if match:
                        dono = task.get('assignee') or 'Sem Dono'
                        # Use id instead of title to prevent massive payload issues
                        todas_tarefas.append(f"[PROJETO: {card.get('title')}] ID: {task.get('id')} -> {task.get('title')} (Status: {task.get('status')} | Dono: {dono})")
                        
    # Busca em Iniciativas
    inic_data, _ = github_client.get_file_content("Operacional/Kanban/iniciativas.json")
    if inic_data:
        for board in inic_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    assignee = task.get("assignee", "").strip().lower()
                    
                    match = False
                    if filtro_responsavel.lower() == "todas":
                        match = True
                    elif filtro_responsavel.lower() == "unassigned" and assignee == "":
                        match = True
                    elif filtro_responsavel.lower() not in ["todas", "unassigned"] and assignee == filtro_responsavel.lower():
                        match = True
                        
                    if match:
                        dono = task.get('assignee') or 'Sem Dono'
                        # Use id instead of title to prevent massive payload issues
                        todas_tarefas.append(f"[INICIATIVA: {card.get('title')}] ID: {task.get('id')} -> {task.get('title')} (Status: {task.get('status')} | Dono: {dono})")

    if not todas_tarefas:
        return json.dumps({"status": "success", "message": f"Nenhuma tarefa corresponde ao filtro '{filtro_responsavel}'."})
        
    return json.dumps({"status": "success", "tarefas": todas_tarefas})

def assign_all_unassigned_tasks(novo_responsavel: str) -> str:
    """
    Define um responsável para TODAS as tarefas em todo o sistema Kanban (projetos e iniciativas) que atualmente NÃO TÊM DONO.
    
    Args:
        novo_responsavel: O nome do membro que vai herdar todas as tarefas órfãs (ex: Joãozíssimo).
    """
    total_edited = 0
    
    # Projetos
    proj_data, sha = github_client.get_file_content("Operacional/Kanban/projetos.json")
    if proj_data:
        modificado = False
        for board in proj_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    if not task.get("assignee", "").strip():
                        task["assignee"] = novo_responsavel
                        modificado = True
                        total_edited += 1
        if modificado:
            github_client.update_file_content("Operacional/Kanban/projetos.json", proj_data, sha, f"bot(Mintzie): bulk assign de tarefas em projetos para {novo_responsavel}")
            
    # Iniciativas
    inic_data, sha2 = github_client.get_file_content("Operacional/Kanban/iniciativas.json")
    if inic_data:
        modificado = False
        for board in inic_data.get("boards", []):
            for card in board.get("cards", []):
                for task in card.get("tasks", []):
                    if not task.get("assignee", "").strip():
                        task["assignee"] = novo_responsavel
                        modificado = True
                        total_edited += 1
        if modificado:
            github_client.update_file_content("Operacional/Kanban/iniciativas.json", inic_data, sha2, f"bot(Mintzie): bulk assign de tarefas em iniciativas para {novo_responsavel}")
            
    return json.dumps({"status": "success", "message": f"Pronto. Exatamente {total_edited} tarefas sem dono foram agora jogadas nas costas de {novo_responsavel}."})

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


def edit_github_task(tipo: str, titulo_tarefa_atual: str, novo_responsavel: str = None, novo_status: str = None, nova_data: str = None) -> str:
    """
    Edita uma tarefa EXATAMENTE existente no Kanban do GitHub.
    Lembre-se: O título atual deve bater com uma das tarefas que existem nos Kanbans. O assistente usará pesquisa textual no arquivo JSON.

    Args:
        tipo: Deve ser "projeto" para procurar nos projetos externos ou "iniciativa" para procurar nas iniciativas internas.
        titulo_tarefa_atual: Descrição exata da tarefa (ou parte dela) como está escrita atualmente lá (ex: "Comunicar os sócios sobre a ida").
        novo_responsavel: (Opcional) Novo nome do membro para associar.
        novo_status: (Opcional) Novo status, como "completed" ou "pending".
        nova_data: (Opcional) Nova data de entrega no formato YYYY-MM-DD.
    """
    if tipo.lower().startswith("proj"):
        file_path = "Operacional/Kanban/projetos.json"
    elif tipo.lower().startswith("inic"):
        file_path = "Operacional/Kanban/iniciativas.json"
    else:
         return json.dumps({"status": "error", "message": "O tipo para edição tem que ser 'projeto' ou 'iniciativa'."})

    data, sha = github_client.get_file_content(file_path)
    if not data or not sha:
         return json.dumps({"status": "error", "message": "Erro de leitura no json."})

    tarefa_encontrada = False
    
    for board in data.get("boards", []):
        for card in board.get("cards", []):
            for task in card.get("tasks", []):
                if titulo_tarefa_atual.lower() in task.get("title", "").lower() or titulo_tarefa_atual.lower() == task.get("id", "").lower():
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
        return json.dumps({"status": "error", "message": f"Eu não encontrei nenhuma tarefa contendo '{titulo_tarefa_atual}' nas suas listas de {tipo}s. Verifique o nome real da tarefa."})
        
    commit_msg = f"bot(AI Cat): edita tarefa contendo '{titulo_tarefa_atual}' no json de {tipo} via Discord"
    success = github_client.update_file_content(file_path, data, sha, commit_msg)
    
    if success:
         return json.dumps({"status": "success", "message": "A tarefa foi editada. Ufa. Que canseira."})
    else:
         return json.dumps({"status": "error", "message": "Deu algum erro nojento ao tentar gravar isso no GitHub."})


def get_chat_session(session_id: str):
    if session_id not in sessions:
        toolsList = [create_github_task, create_new_kanban_card, get_tasks, assign_all_unassigned_tasks, edit_github_task]
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
            tools=toolsList
        )
        sessions[session_id] = client.chats.create(
            model="gemini-2.5-flash-lite",
            config=config
        )
    return sessions[session_id]
