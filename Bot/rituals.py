import datetime


def is_weekday(moment: datetime.datetime) -> bool:
    return moment.weekday() < 5


def should_run_general_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment)


def should_run_employee_of_week_ritual(moment: datetime.datetime) -> bool:
    return moment.weekday() == 4


def should_run_night_watch_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and (moment.hour >= 22 or moment.hour < 6)


def should_run_surprise_purr_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and 14 <= moment.hour < 17


def should_run_weekly_provocation_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and moment.weekday() == 0


def should_run_weekly_bottleneck_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and moment.weekday() == 2


def should_run_partner_workload_nudge_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and moment.weekday() == 1


def should_run_partner_open_tasks_checkin_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and moment.weekday() in {1, 3}
