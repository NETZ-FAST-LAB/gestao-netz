import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOT_DIR = ROOT / "Bot"
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import mintzie_persona


class MintziePersonaTests(unittest.TestCase):
    def test_operational_provocation_prefers_unassigned_signal(self):
        message = mintzie_persona.build_operational_provocation_message(
            {
                "unassigned_count": 2,
                "overdue_count": 0,
                "unassigned_tasks": [
                    {"card_title": "Projeto X", "task_title": "Definir proposta"},
                    {"card_title": "Projeto Y", "task_title": "Responder cliente"},
                ],
                "overdue_tasks": [],
            }
        )

        self.assertIn("2 tarefa(s) sem dono", message)
        self.assertIn("Projeto X", message)

    def test_weekly_bottleneck_prefers_overdue_signal(self):
        message = mintzie_persona.build_weekly_bottleneck_message(
            {
                "unassigned_count": 1,
                "overdue_count": 3,
                "unassigned_tasks": [],
                "overdue_tasks": [
                    {"card_title": "Projeto Z", "task_title": "Fechar escopo"},
                ],
            }
        )

        self.assertIn("3 tarefa(s) vencida(s)", message)
        self.assertIn("Projeto Z", message)

    def test_low_workload_nudge_mentions_partner_and_goal(self):
        message = mintzie_persona.build_low_workload_nudge_message(
            {
                "mention": "@joao",
                "active_task_count": 1,
                "active_examples": ["Projeto X: Definir proposta"],
            },
            threshold=3,
        )

        self.assertIn("@joao", message)
        self.assertIn("1 tarefa(s) ativa(s)", message)
        self.assertIn("Temos uma meta para bater", message)

    def test_open_tasks_checkin_mentions_partner_and_deadlines(self):
        message = mintzie_persona.build_open_tasks_checkin_message(
            {
                "mention": "@gui",
                "active_task_count": 2,
                "active_tasks": [
                    {"card_title": "Projeto X", "task_title": "Fechar escopo", "due_date": "2026-03-20", "status": "pending"},
                    {"card_title": "Projeto Y", "task_title": "Mandar proposta", "due_date": "", "status": "pending"},
                ],
            }
        )

        self.assertIn("@gui", message)
        self.assertIn("2 tarefa(s) em aberto", message)
        self.assertIn("Projeto X: Fechar escopo", message)
        self.assertIn("Atualize datas", message)

    def test_deploy_message_summarizes_recent_commits(self):
        message = mintzie_persona.build_deploy_message(
            [
                "feat(bot): adiciona alerta de deploy",
                "fix(bot): corrige ritual de fim de semana",
                "chore: limpa logs",
            ]
        )

        self.assertIn("adiciona alerta de deploy", message)
        self.assertIn("corrige ritual de fim de semana", message)
        self.assertIn("limpa logs", message)
        self.assertNotIn("feat(bot):", message)

    def test_night_watch_templates_accept_mention(self):
        rendered = [
            template.format(mention="@joao")
            for template in mintzie_persona.NIGHT_WATCH_MESSAGES
        ]

        for message in rendered:
            self.assertIn("@joao", message)

    def test_gossip_messages_are_present(self):
        self.assertGreaterEqual(len(mintzie_persona.GOSSIP_MESSAGES), 2)
        for message in mintzie_persona.GOSSIP_MESSAGES:
            self.assertTrue(message.strip())


if __name__ == "__main__":
    unittest.main()
