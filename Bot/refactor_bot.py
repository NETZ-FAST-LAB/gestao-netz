import sys

bot_file = "Bot/bot.py"
with open(bot_file, "r", encoding="utf-8") as f:
    orig = f.read()

# 1. Substitute the module import
text = orig.replace("import kanban_service", "import kanban_db_service as kanban_service")

# 2. Add await to rituals that call get_operational_snapshot / get_partner_workload_snapshot
text = text.replace("kanban_service.get_operational_snapshot(reference_date=now.date())", "await kanban_service.get_operational_snapshot(reference_date=now.date())")
text = text.replace("kanban_service.get_operational_snapshot(reference_date=brasilia_now().date())", "await kanban_service.get_operational_snapshot(reference_date=brasilia_now().date())")
text = text.replace("kanban_service.get_partner_workload_snapshot(", "await kanban_service.get_partner_workload_snapshot(")

# 3. Add await to chat_session.send_message
text = text.replace("response = chat_session.send_message(prompt_enriquecido)", "response = await chat_session.send_message(prompt_enriquecido)")

# 4. Remove all the manual parser stuff up to on_message? No, regex is safer for block removal.
import re

# Remove pending task state checks from on_message
pattern1 = re.compile(r"    if _has_fresh_pending_task_update\(message\):.*?        return\n\n", re.DOTALL)
text = pattern1.sub("", text)

# Remove the 'looks_like_task_update' intercept
pattern2 = re.compile(r"        if _looks_like_task_update_request\(clean_prompt\):.*?                return\n\n", re.DOTALL)
text = pattern2.sub("", text)

with open(bot_file, "w", encoding="utf-8") as f:
    f.write(text)
    
print("Replaced!")
