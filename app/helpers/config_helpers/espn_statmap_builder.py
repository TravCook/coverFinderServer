# stat_frequency = Counter()
# team_presence = defaultdict(set)
# stat_categories = defaultdict(lambda: {"categories": []})
# tracked_stats = set(stat_config_map[sport.name]['default'])
# stat_categories = {
#     stat: {"categories": []}
#     for stat in tracked_stats
# }

# no_stat_teams = 0
# for team in sport_teams:
#     team_stat_request_url = (
#             f"https://sports.core.api.espn.com/v2/sports/{sport.espnSport}/leagues/{sport.league}"
#             f"/seasons/{sport.statYear}/types/2/teams/{team.espnID}/statistics?lang=en&region=us"
#         )
#     team_stat_response = await fetch_data(team_stat_request_url, session)

#     if "splits" not in team_stat_response:
#         # logger.warning(f"No 'splits' found in stats response for team {team.espnDisplayName} {team_stat_request_url}.")
#         no_stat_teams += 1
#         continue
#     for category in team_stat_response["splits"]["categories"]:
#         seen_stats = set()
#         for stat in category.get("stats", []):
#             stat_name = stat.get("name")
#             stat_value = stat.get("value")


#             # Only process stats in your known map
#             if stat_name in tracked_stats and stat_value is not None:
#                 if stat_name not in seen_stats:
#                     stat_frequency[stat_name] += 1
#                     team_presence[stat_name].add(team.espnID)
#                     seen_stats.add(stat_name)

#                 # Record which categories the stat appears in
#                 cat_name = category.get("name")
#                 if cat_name and cat_name not in stat_categories[stat_name]["categories"]:
#                     stat_categories[stat_name]["categories"].append(cat_name)

# # after all teams processed
# num_teams = len(sport_teams)
# common_stats = [
#     stat for stat, teams in team_presence.items()
#     # if len(teams) == (num_teams - no_stat_teams)
# ]

# # Sort stats by the first category they appear in
# sorted_common_stats = sorted(
#     common_stats,
#     key=lambda stat: (stat_categories[stat]["categories"][0] 
#                     if stat_categories[stat]["categories"] else "zzz")  # fallback
# )

# logger.info("=== ESPN Stat Frequency Report ===")
# for stat_name in sorted_common_stats:
#     cats = stat_categories[stat_name]["categories"]
#     logger.info(f"{stat_name}: appears for all {num_teams} teams — Categories: {cats}")

# #compare stat map to common stats and log missing stats
# missing_stats = [stat for stat in tracked_stats if stat not in common_stats]
# if missing_stats:
#     logger.info("=== MISSING STATS REPORT ===")
#     for stat in missing_stats:
#         logger.info(f"Stat '{stat}' is missing for some teams.")