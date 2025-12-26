from datetime import datetime

def sport_in_season(sport):
    """
    Determines if a sport is currently in season.

    Args:
        sport (dict): A dictionary with keys 'start_month' (int, 1-12), 
                      'end_month' (int, 1-12), and 'multiYear' (bool).

    Returns:
        bool: True if the sport is in season, False otherwise.
    """
    current_month = datetime.now().month
    start = sport.startMonth
    end = sport.endMonth
    multi_year = sport.multiYear

    if start is None or end is None:
        return False

    if multi_year:
        # Season spans over the year boundary (e.g., Nov to Feb)
        return current_month >= start or current_month <= end
    else:
        # Season within the same year (e.g., Mar to Aug)
        return start <= current_month <= end