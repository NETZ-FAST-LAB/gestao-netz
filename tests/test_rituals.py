import datetime
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOT_DIR = ROOT / "Bot"
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import rituals


class RitualRulesTests(unittest.TestCase):
    def test_general_ritual_is_blocked_on_weekend(self):
        saturday = datetime.datetime(2026, 3, 21, 10, 0)
        self.assertFalse(rituals.should_run_general_ritual(saturday))

    def test_catnip_only_runs_on_tuesday_and_thursday(self):
        tuesday = datetime.datetime(2026, 3, 17, 16, 20)
        thursday = datetime.datetime(2026, 3, 19, 16, 20)
        monday = datetime.datetime(2026, 3, 16, 16, 20)

        self.assertTrue(rituals.should_run_catnip_ritual(tuesday))
        self.assertTrue(rituals.should_run_catnip_ritual(thursday))
        self.assertFalse(rituals.should_run_catnip_ritual(monday))

    def test_night_watch_is_blocked_on_weekend_even_at_night(self):
        sunday_night = datetime.datetime(2026, 3, 22, 23, 15)
        self.assertFalse(rituals.should_run_night_watch_ritual(sunday_night))

    def test_employee_of_week_runs_only_on_friday(self):
        friday = datetime.datetime(2026, 3, 20, 17, 0)
        wednesday = datetime.datetime(2026, 3, 18, 17, 0)

        self.assertTrue(rituals.should_run_employee_of_week_ritual(friday))
        self.assertFalse(rituals.should_run_employee_of_week_ritual(wednesday))

    def test_weekly_provocation_runs_on_monday_only(self):
        monday = datetime.datetime(2026, 3, 16, 11, 11)
        tuesday = datetime.datetime(2026, 3, 17, 11, 11)

        self.assertTrue(rituals.should_run_weekly_provocation_ritual(monday))
        self.assertFalse(rituals.should_run_weekly_provocation_ritual(tuesday))

    def test_weekly_bottleneck_runs_on_wednesday_only(self):
        wednesday = datetime.datetime(2026, 3, 18, 15, 30)
        thursday = datetime.datetime(2026, 3, 19, 15, 30)

        self.assertTrue(rituals.should_run_weekly_bottleneck_ritual(wednesday))
        self.assertFalse(rituals.should_run_weekly_bottleneck_ritual(thursday))

    def test_partner_workload_nudge_runs_on_tuesday_only(self):
        tuesday = datetime.datetime(2026, 3, 17, 9, 30)
        monday = datetime.datetime(2026, 3, 16, 9, 30)

        self.assertTrue(rituals.should_run_partner_workload_nudge_ritual(tuesday))
        self.assertFalse(rituals.should_run_partner_workload_nudge_ritual(monday))

    def test_partner_open_tasks_checkin_runs_on_thursday_only(self):
        thursday = datetime.datetime(2026, 3, 19, 15, 45)
        friday = datetime.datetime(2026, 3, 20, 15, 45)

        self.assertTrue(rituals.should_run_partner_open_tasks_checkin_ritual(thursday))
        self.assertFalse(rituals.should_run_partner_open_tasks_checkin_ritual(friday))


if __name__ == "__main__":
    unittest.main()
