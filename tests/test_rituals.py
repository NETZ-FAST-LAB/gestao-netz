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


if __name__ == "__main__":
    unittest.main()
