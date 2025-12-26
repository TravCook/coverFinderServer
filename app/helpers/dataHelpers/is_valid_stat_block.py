import logging
logger = logging.getLogger(__name__)
def is_valid_stat_block(stats_obj, sport, stat_config_map):
    
    """
    Checks if a stats object has all required keys and valid numeric/string values.
    
    stats_obj: dict of stats (e.g., homeStats.data)
    sport: sport identifier
    stat_config_map: dict mapping sport -> required keys
    """
    config = stat_config_map.get(getattr(sport, "espnSport", None))
    if not config or "default" not in config:
        return False
    
    required_keys = config["default"]
    
    # Check all required keys are present
    for key in required_keys:
        if key not in stats_obj:
            return False

    # Check all values are numbers or strings
    for val in stats_obj.values():
        if isinstance(val, str):
            continue
        if not isinstance(val, (int, float)) or val is None:
            return False

    return True
