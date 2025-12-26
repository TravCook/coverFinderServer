import re
import numpy as np
from app.helpers.config_helpers.stat_config import reverse_comparison_stats, ignored_stats
import logging
logger = logging.getLogger(__name__)
def parse_stat_value(value):
    """
    Parse stat values that might be strings like '1-2', '32-143', etc.
    Returns a float.
    """
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        # Match patterns like '12-34' or '3/7'
        match = re.match(r"^(\d+)[-/](\d+)$", value.strip())
        if match:
            num, denom = map(float, match.groups())
            # Avoid division by zero
            return num / denom if denom != 0 else 0.0

        # If it’s something like 'W-L' or '3–2'
        match = re.match(r"^(\d+)\s*[-–]\s*(\d+)$", value.strip())
        if match:
            wins, losses = map(float, match.groups())
            total = wins + losses
            return wins / total if total > 0 else 0.0

        # Try to convert simple numeric strings
        try:
            return float(value)
        except ValueError:
            return 0.0

    # Default fallback
    return 0.0


def calculate_base_index(team_stats, feature_importances, stat_means, stat_stds):
    score = 0.0
    total_weight = 0.0


    # Compute team score using scaled values
    for feature in feature_importances:
        name = feature["feature"]
        importance = feature["importance"]

        raw_value = team_stats.get(name)
        value = parse_stat_value(raw_value)

        # Scale the value using league mean/std
        mean = stat_means.get(name, 0)
        std = stat_stds.get(name, 1)
        scaled_value = (value - mean) / std if std != 0 else 0.0

        if name in reverse_comparison_stats:
            score -= scaled_value * importance
        elif name in ignored_stats:
            continue
        else:
            score += scaled_value * importance

        total_weight += importance

    return score / total_weight if total_weight > 0 else 0.0

def scale_team_scores(team_list, team_to_scale, min_scale=0, max_scale=45):
    """
    Scales 'statIndex' values (or another numeric field) across a list of teams
    to a specified range [min_scale, max_scale].

    Args:
        team_list (list[dict]): Each dict must contain a numeric 'statIndex' key.
        min_scale (float): Lower bound of scaled range.
        max_scale (float): Upper bound of scaled range.

    Returns:
        list[dict]: Same list with a new key 'scaledStatIndex' for each team.
    """
    if not team_list:
        return []

    # Extract statIndex values
    values = [team.statIndex for team in team_list]

    min_val = min(values)
    max_val = max(values)
    range_val = (max_val) - (min_val)

    if range_val == 0:
        # All values identical, give them the midpoint
        midpoint = (min_scale + max_scale) / 2
        scaled_index= midpoint
        return team_list

    # Perform linear scaling
    raw_value = team_to_scale.statIndex
    scaled = ((raw_value - min_val) / range_val) * (max_scale - min_scale) + min_scale
    scaled_index = round(scaled, 2)

    return scaled_index


