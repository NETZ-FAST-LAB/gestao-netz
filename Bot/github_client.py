import os
import json
from github import Github
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_NAME = os.getenv("GITHUB_REPO")

if not GITHUB_TOKEN or not REPO_NAME:
    raise ValueError("Missing GITHUB_TOKEN or GITHUB_REPO in environment variables.")

g = Github(GITHUB_TOKEN)
repo = g.get_repo(REPO_NAME)

def get_file_content(filepath: str) -> dict:
    """Reads a JSON file from the GitHub repository."""
    try:
        file_content = repo.get_contents(filepath)
        decoded_content = file_content.decoded_content.decode('utf-8')
        return json.loads(decoded_content), file_content.sha
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None, None

def update_file_content(filepath: str, data: dict, sha: str, commit_message: str):
    """Updates a JSON file in the GitHub repository."""
    try:
        new_content = json.dumps(data, indent=2, ensure_ascii=False)
        repo.update_file(
            path=filepath,
            message=commit_message,
            content=new_content,
            sha=sha
        )
        return True
    except Exception as e:
        print(f"Error updating {filepath}: {e}")
        return False

def get_projetos():
    data, _ = get_file_content("Operacional/Kanban/projetos.json")
    return data

def get_iniciativas():
    data, _ = get_file_content("Operacional/Kanban/iniciativas.json")
    return data

def get_organizacao():
    data, _ = get_file_content("Operacional/organizacao.json")
    return data
def get_all_tarefas():
    """Busca todos os arquivos tarefas.json dentro de subpastas de Operacional/ usando a árvore do Git para não dar Rate Limit."""
    projetos = []
    try:
        branch = repo.get_branch("master")
        tree = repo.get_git_tree(branch.commit.sha, recursive=True)
        for element in tree.tree:
            # Procurar por Operacional/NOME_DO_PROJETO/tarefas.json
            if element.path.startswith("Operacional/") and element.path.endswith("/tarefas.json"):
                data, _ = get_file_content(element.path)
                if data:
                    projetos.append(data)
    except Exception as e:
        print(f"Erro buscando tarefas.json recursivos: {e}")
    return projetos
