import json
import time

from github import Github
from github.GithubException import GithubException

from config import settings

MAX_RETRIES = 3

g = Github(settings.github_token)
repo = g.get_repo(settings.github_repo)


def get_file_content(filepath: str) -> dict:
    """Reads a JSON file from the GitHub repository."""
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            file_content = repo.get_contents(filepath, ref=settings.github_branch or repo.default_branch)
            decoded_content = file_content.decoded_content.decode("utf-8")
            return json.loads(decoded_content), file_content.sha
        except Exception as e:
            last_error = e
            print(f"Error reading {filepath} (attempt {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(0.5 * attempt)

    print(f"Giving up reading {filepath}: {last_error}")
    return None, None


def update_file_content(filepath: str, data: dict, sha: str, commit_message: str):
    """Updates a JSON file in the GitHub repository."""
    new_content = json.dumps(data, indent=2, ensure_ascii=False)
    current_sha = sha

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            repo.update_file(
                path=filepath,
                message=commit_message,
                content=new_content,
                sha=current_sha,
                branch=settings.github_branch or repo.default_branch,
            )
            return True
        except GithubException as e:
            print(f"Error updating {filepath} (attempt {attempt}/{MAX_RETRIES}): {e}")
            if e.status == 409 and attempt < MAX_RETRIES:
                _, refreshed_sha = get_file_content(filepath)
                if refreshed_sha:
                    current_sha = refreshed_sha
                    continue
            time.sleep(0.5 * attempt)
        except Exception as e:
            print(f"Error updating {filepath} (attempt {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(0.5 * attempt)

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
    """Busca todos os arquivos tarefas.json dentro de subpastas de Operacional/."""
    projetos = []
    try:
        branch = repo.get_branch(settings.github_branch or repo.default_branch)
        tree = repo.get_git_tree(branch.commit.sha, recursive=True)
        for element in tree.tree:
            if element.path.startswith("Operacional/") and element.path.endswith("/tarefas.json"):
                data, _ = get_file_content(element.path)
                if data:
                    projetos.append(data)
    except Exception as e:
        print(f"Erro buscando tarefas.json recursivos: {e}")
    return projetos


def get_recent_commit_subjects(limit: int = 3):
    try:
        commits = repo.get_commits(sha=settings.github_branch or repo.default_branch)
        subjects = []
        for commit in commits[:limit]:
            message = commit.commit.message or ""
            subject = message.splitlines()[0].strip()
            if subject:
                subjects.append(subject)
        return subjects
    except Exception as e:
        print(f"Erro buscando commits recentes no GitHub: {e}")
        return []
