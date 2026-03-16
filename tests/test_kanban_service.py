import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
BOT_DIR = ROOT / "Bot"
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import kanban_service


class KanbanServiceTests(unittest.TestCase):
    def test_unique_task_id_avoids_existing_ids(self):
        card = {
            "id": "proj-demo-card",
            "tasks": [
                {"id": "task-card-aaaaaaaa"},
                {"id": "task-card-bbbbbbbb"},
            ],
        }

        task_id = kanban_service._build_unique_task_id(card)

        self.assertTrue(task_id.startswith("task-card-"))
        self.assertNotIn(task_id, {task["id"] for task in card["tasks"]})

    @patch("kanban_service.github_client.get_file_content")
    def test_get_tasks_filters_unassigned(self, mock_get_file_content):
        mock_get_file_content.side_effect = [
            (
                {
                    "boards": [
                        {
                            "cards": [
                                {
                                    "title": "Projeto X",
                                    "tasks": [
                                        {"id": "1", "title": "Com dono", "assignee": "Joao", "status": "pending"},
                                        {"id": "2", "title": "Sem dono", "assignee": "", "status": "pending"},
                                    ],
                                }
                            ]
                        }
                    ]
                },
                "sha-1",
            ),
            ({"boards": []}, "sha-2"),
        ]

        payload = kanban_service.get_tasks("unassigned")

        self.assertIn("Sem dono", payload)
        self.assertNotIn("Com dono", payload)

    @patch("kanban_service.github_client.get_file_content")
    def test_partner_workload_snapshot_counts_active_tasks_by_alias(self, mock_get_file_content):
        mock_get_file_content.side_effect = [
            (
                {
                    "boards": [
                        {
                            "cards": [
                                {
                                    "title": "Projeto X",
                                    "tasks": [
                                        {"id": "1", "title": "Definir proposta", "assignee": "João", "status": "pending"},
                                        {"id": "2", "title": "Responder cliente", "assignee": "Gui R", "status": "in_progress"},
                                        {"id": "3", "title": "Arquivada", "assignee": "João", "status": "completed"},
                                    ],
                                }
                            ]
                        }
                    ]
                },
                "sha-1",
            ),
            (
                {
                    "boards": [
                        {
                            "cards": [
                                {
                                    "title": "Iniciativa Y",
                                    "tasks": [
                                        {"id": "4", "title": "Planejar follow-up", "responsavel": "Dênis", "status": "pending"},
                                        {"id": "5", "title": "Pente fino", "assignee": "Joãozíssimo", "status": "pending"},
                                    ],
                                }
                            ]
                        }
                    ]
                },
                "sha-2",
            ),
        ]

        snapshot = kanban_service.get_partner_workload_snapshot(
            [
                {"key": "joao", "display_name": "Joao", "mention": "<@1>", "aliases": ["Joao", "Joãozíssimo"]},
                {"key": "gui", "display_name": "Gui", "mention": "<@2>", "aliases": ["Gui", "Gui R"]},
                {"key": "denis", "display_name": "Denis", "mention": "<@3>", "aliases": ["Denis", "Dênis"]},
            ],
            threshold=3,
        )

        counts = {partner["key"]: partner["active_task_count"] for partner in snapshot["partners"]}

        self.assertEqual(counts["joao"], 2)
        self.assertEqual(counts["gui"], 1)
        self.assertEqual(counts["denis"], 1)
        self.assertEqual(len(snapshot["low_workload_partners"]), 3)


if __name__ == "__main__":
    unittest.main()
