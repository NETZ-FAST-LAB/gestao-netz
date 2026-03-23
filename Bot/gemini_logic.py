import json

from openai import APIStatusError, OpenAI

from config import settings
from kanban_service import available_functions, tool_schemas
from mintzie_persona import SYSTEM_INSTRUCTION

client = OpenAI(
    base_url=settings.llm_base_url,
    api_key=settings.llm_api_key,
)

sessions = {}

MAX_HISTORY_MESSAGES = 14
MAX_RECOVERY_MESSAGES = 4
MAX_USER_MESSAGE_CHARS = 3500
MAX_ASSISTANT_MESSAGE_CHARS = 2500
MAX_TOOL_MESSAGE_CHARS = 1800
MAX_TOOL_ARGUMENT_CHARS = 1200


def get_chat_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = ChatSession(session_id)
    return sessions[session_id]


class ChatSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

    def send_message(self, text: str):
        self._append_message({"role": "user", "content": text})

        while True:
            response = self._create_completion()

            response_message = response.choices[0].message
            self._append_message(response_message)

            if response_message.tool_calls:
                for tool_call in response_message.tool_calls:
                    function_name = tool_call.function.name
                    function_to_call = available_functions.get(function_name)

                    try:
                        function_args = json.loads(tool_call.function.arguments)
                        print(f"Executando ferramenta '{function_name}' com argumentos: {function_args}")
                        function_response = function_to_call(**function_args)
                    except Exception as e:
                        print(f"Erro ao executar a ferramenta {function_name}: {e}")
                        function_response = json.dumps({"status": "error", "message": str(e)})

                    self._append_message(
                        {
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": self._ensure_text(function_response),
                        }
                    )
            else:
                class LegacyResponseWrapper:
                    def __init__(self, text):
                        self.text = text

                return LegacyResponseWrapper(response_message.content)

    def _create_completion(self):
        self._compact_history()
        try:
            return client.chat.completions.create(
                model=settings.llm_model,
                messages=self.messages,
                tools=tool_schemas,
                tool_choice="auto",
            )
        except APIStatusError as exc:
            if not self._is_context_limit_error(exc):
                raise

            print(
                f"Contexto da sessao '{self.session_id}' excedeu o limite do modelo. "
                "Tentando novamente com historico reduzido."
            )
            self._compact_history(max_non_system_messages=MAX_RECOVERY_MESSAGES, aggressive=True)

            return client.chat.completions.create(
                model=settings.llm_model,
                messages=self.messages,
                tools=tool_schemas,
                tool_choice="auto",
            )

    def _append_message(self, message):
        self.messages.append(self._normalize_message(message))
        self._compact_history()

    def _compact_history(self, max_non_system_messages=MAX_HISTORY_MESSAGES, aggressive=False):
        if not self.messages:
            self.messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
            return

        system_message = self.messages[0]
        normalized_messages = [self._normalize_message(message, aggressive=aggressive) for message in self.messages[1:]]
        grouped_messages = self._group_messages(normalized_messages)
        trimmed_messages = self._trim_message_groups(grouped_messages, max_non_system_messages)
        self.messages = [system_message, *trimmed_messages]

    def _normalize_message(self, message, aggressive=False):
        if isinstance(message, dict):
            normalized = dict(message)
        elif hasattr(message, "model_dump"):
            normalized = message.model_dump(exclude_none=True)
        else:
            normalized = {
                "role": getattr(message, "role", "assistant"),
                "content": getattr(message, "content", None),
            }
            tool_calls = getattr(message, "tool_calls", None)
            if tool_calls:
                normalized["tool_calls"] = [
                    tool_call.model_dump(exclude_none=True) if hasattr(tool_call, "model_dump") else tool_call
                    for tool_call in tool_calls
                ]

        role = normalized.get("role", "assistant")
        content = self._ensure_text(normalized.get("content"))
        limit = self._get_content_limit(role, aggressive)

        if content is not None:
            normalized["content"] = self._truncate_text(content, limit)

        if normalized.get("tool_calls"):
            normalized["tool_calls"] = [self._normalize_tool_call(tool_call, aggressive) for tool_call in normalized["tool_calls"]]

        allowed_keys = {"role", "content", "tool_call_id", "name", "tool_calls"}
        return {key: value for key, value in normalized.items() if key in allowed_keys and value is not None}

    def _normalize_tool_call(self, tool_call, aggressive=False):
        if hasattr(tool_call, "model_dump"):
            normalized = tool_call.model_dump(exclude_none=True)
        else:
            normalized = dict(tool_call)

        function_data = normalized.get("function")
        if isinstance(function_data, dict) and function_data.get("arguments"):
            argument_limit = MAX_TOOL_ARGUMENT_CHARS // 2 if aggressive else MAX_TOOL_ARGUMENT_CHARS
            function_data["arguments"] = self._truncate_text(self._ensure_text(function_data["arguments"]), argument_limit)

        return normalized

    def _group_messages(self, messages):
        groups = []
        pending_group = None
        pending_tool_ids = set()

        for message in messages:
            role = message.get("role")

            if role == "tool":
                tool_call_id = message.get("tool_call_id")
                if pending_group and tool_call_id and tool_call_id in pending_tool_ids:
                    pending_group.append(message)
                    pending_tool_ids.discard(tool_call_id)
                continue

            if pending_group:
                groups.append(pending_group)
                pending_group = None
                pending_tool_ids = set()

            if role == "assistant" and message.get("tool_calls"):
                pending_group = [message]
                pending_tool_ids = {
                    tool_call.get("id")
                    for tool_call in message.get("tool_calls", [])
                    if isinstance(tool_call, dict) and tool_call.get("id")
                }
                if not pending_tool_ids:
                    groups.append(pending_group)
                    pending_group = None
                continue

            groups.append([message])

        if pending_group:
            groups.append(pending_group)

        return groups

    def _trim_message_groups(self, groups, max_non_system_messages):
        if not groups:
            return []

        selected_groups = []
        selected_count = 0

        for group in reversed(groups):
            group_size = len(group)
            if selected_groups and selected_count + group_size > max_non_system_messages:
                break

            selected_groups.append(group)
            selected_count += group_size

            if selected_count >= max_non_system_messages:
                break

        trimmed_groups = list(reversed(selected_groups))
        return [message for group in trimmed_groups for message in group]

    def _get_content_limit(self, role, aggressive=False):
        if role == "user":
            base_limit = MAX_USER_MESSAGE_CHARS
        elif role == "tool":
            base_limit = MAX_TOOL_MESSAGE_CHARS
        elif role == "system":
            return len(SYSTEM_INSTRUCTION)
        else:
            base_limit = MAX_ASSISTANT_MESSAGE_CHARS

        return max(500, base_limit // 2) if aggressive else base_limit

    def _truncate_text(self, text, limit):
        if text is None or len(text) <= limit:
            return text

        truncated_chars = len(text) - limit
        return f"{text[:limit]}\n\n[conteudo truncado para caber no contexto: {truncated_chars} caracteres removidos]"

    def _ensure_text(self, content):
        if content is None:
            return None
        if isinstance(content, str):
            return content
        if isinstance(content, (dict, list)):
            return json.dumps(content, ensure_ascii=False)
        return str(content)

    def _is_context_limit_error(self, exc):
        if getattr(exc, "status_code", None) == 413:
            return True
        error_text = str(exc).lower()
        return "tokens_limit_reached" in error_text or "request body too large" in error_text
