import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOT_DIR = ROOT / "Bot"
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import mintzie_persona


class MintziePersonaTests(unittest.TestCase):
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
