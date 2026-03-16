import datetime


def is_weekday(moment: datetime.datetime) -> bool:
    return moment.weekday() < 5


def should_run_general_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment)


def should_run_catnip_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and moment.weekday() in {1, 3}


def should_run_employee_of_week_ritual(moment: datetime.datetime) -> bool:
    return moment.weekday() == 4


def should_run_night_watch_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and (moment.hour >= 22 or moment.hour < 6)


def should_run_surprise_purr_ritual(moment: datetime.datetime) -> bool:
    return is_weekday(moment) and 14 <= moment.hour < 17
