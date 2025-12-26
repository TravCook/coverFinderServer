from datetime import datetime
from zoneinfo import ZoneInfo  # Python 3.9+

# Suppose game.commence_time is a timezone-aware datetime or naive UTC
def is_game_today(game_datetime):
    # Define Denver timezone
    denver_tz = ZoneInfo("America/Denver")

    # Convert game_datetime to Denver time
    if game_datetime.tzinfo is None:
        # If naive, assume it's in UTC
        game_datetime = game_datetime.replace(tzinfo=ZoneInfo("UTC"))

    game_in_denver = game_datetime.astimezone(denver_tz)

    # Get Denver today
    today_in_denver = datetime.now(denver_tz).date()

    return game_in_denver.date() == today_in_denver
