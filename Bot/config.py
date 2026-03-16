import json
import os
from dataclasses import dataclass
from typing import Dict

from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    return int(raw)


def _get_member_mentions() -> Dict[str, str]:
    members_json = os.getenv("MINTZIE_MEMBER_MENTIONS_JSON")
    if members_json:
        return json.loads(members_json)

    return {
        "joao": os.getenv("MINTZIE_JOAO_MENTION", "<@1033423714902646875>"),
        "gui_r": os.getenv("MINTZIE_GUI_R_MENTION", "<@882649060010041375>"),
        "denis": os.getenv("MINTZIE_DENIS_MENTION", "<@945722363108614234>"),
        "stacke": os.getenv("MINTZIE_STACKE_MENTION", "<@630230266005880852>"),
    }


@dataclass(frozen=True)
class Settings:
    discord_token: str
    github_token: str
    github_repo: str
    github_branch: str | None
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    management_channel_id: int
    deploy_channel_id: int
    member_mentions: Dict[str, str]


settings = Settings(
    discord_token=os.getenv("DISCORD_TOKEN", ""),
    github_token=_require_env("GITHUB_TOKEN"),
    github_repo=_require_env("GITHUB_REPO"),
    github_branch=os.getenv("GITHUB_BRANCH"),
    llm_api_key=os.getenv("LLM_API_KEY") or _require_env("GITHUB_TOKEN"),
    llm_base_url=os.getenv("LLM_BASE_URL", "https://models.inference.ai.azure.com"),
    llm_model=os.getenv("LLM_MODEL", "gpt-4o"),
    management_channel_id=_get_int("MINTZIE_MANAGEMENT_CHANNEL_ID", 1479226481782554634),
    deploy_channel_id=_get_int("MINTZIE_DEPLOY_CHANNEL_ID", 1481644523913482472),
    member_mentions=_get_member_mentions(),
)
