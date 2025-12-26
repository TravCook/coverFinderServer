from app.helpers.dataHelpers.calculate_team_index import scale_team_scores
from app.helpers.dataHelpers.db_setters.save_team_async import save_team_async
async def scale_and_save_team(team, sport, sport_teams, AsyncSessionLocal):
    scaled_index = scale_team_scores(sport_teams, team)
    payload = {"scaledStatIndex": scaled_index}
    await save_team_async(team, payload, AsyncSessionLocal)
