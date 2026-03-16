import json

from openai import OpenAI

from config import settings
from kanban_service import available_functions, tool_schemas
from mintzie_persona import SYSTEM_INSTRUCTION

client = OpenAI(
    base_url=settings.llm_base_url,
    api_key=settings.llm_api_key,
)

sessions = {}


def get_chat_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = ChatSession(session_id)
    return sessions[session_id]


class ChatSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

    def send_message(self, text: str):
        self.messages.append({"role": "user", "content": text})

        while True:
            response = client.chat.completions.create(
                model=settings.llm_model,
                messages=self.messages,
                tools=tool_schemas,
                tool_choice="auto",
            )

            response_message = response.choices[0].message
            self.messages.append(response_message)

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

                    self.messages.append(
                        {
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": function_response,
                        }
                    )
            else:
                class LegacyResponseWrapper:
                    def __init__(self, text):
                        self.text = text

                return LegacyResponseWrapper(response_message.content)
