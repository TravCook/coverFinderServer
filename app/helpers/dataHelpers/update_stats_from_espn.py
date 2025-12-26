import logging
logger = logging.getLogger(__name__)

async def update_stats_from_espn(api_response: dict, stat_map: dict, target_object: dict):
    """
    Updates a target object using a stat map and an API response (like the 'splits' object).

    :param api_response: The API response containing categories and stats (the 'splits' dict)
    :param stat_map: Mapping of stat categories and their model fields (like your example)
    :param target_object: The object to update (e.g., team season stats)
    :return: Updated target object
    """
    # Flatten API stats into a lookup dict: {statName: value}
    api_stats = {}
    for cat in api_response.get('categories', []):
        cat_name = cat.get('name', [])
        for stat in cat.get('stats', []):
            name = stat.get('name')
            value = stat.get('value')
            if name:
                api_stats[f"{name}_{cat_name}"] = value
    # Iterate through each key (like 'assists', 'hits', etc.) in stat_map
    for stat_name, mappings in stat_map.items():
            # Check if the API has the stat name (case-insensitive match)
            if f"{mappings['espn_name']}_{mappings['category']}" in api_stats:
                target_object[stat_name] = api_stats[f"{mappings['espn_name']}_{mappings['category']}"]


    return target_object

async def update_stats_from_espn_past(api_response: dict, stat_map: dict, target_object: dict):
    """
    Updates a target object using a stat map and an API response.

    Supports:
      - additive: cumulative stats
      - snapshot: latest value
      - derived_rate: numerator / denominator
      - derived_average: base_stat / gamesPlayed

    :param api_response: The API response containing categories and stats (like 'splits')
    :param stat_map: Mapping of stat names, categories, iteration types, and optional numerator/denominator/base_stat
    :param target_object: The object to update (e.g., team season stats)
    :return: Updated target object
    """

    # Flatten API stats into a lookup dict: {statName_category: value}
    api_stats = {}
    for cat in api_response.get('categories', []):
        cat_name = cat.get('name', '')
        for stat in cat.get('stats', []):
            name = stat.get('name')
            value = stat.get('value')
            if name is not None:
                api_stats[f"{name}_{cat_name}"] = value

    #THIS LOOP HANDLES RAW / ADDITIVE STATS FIRST
    for stat_name, mappings in stat_map.items():
        key = f"{mappings['espn_name']}_{mappings['category']}"
        if key in api_stats:
            value = api_stats[key]
            if value == None:
                value = 0

            if mappings['stat_iteration_type'] == "additive":
                target_object[stat_name] = target_object.get(stat_name, 0) + value

            elif mappings['stat_iteration_type'] == "snapshot":
                target_object[stat_name] = value

            elif mappings['stat_iteration_type'] == "comparison":
                target_object[stat_name] = max(value, target_object[stat_name])

            else:
                # Default fallback: just store the value
                target_object[stat_name] = value
    


    #THIS LOOP HANDLES DERIVED STATS            
    for stat_name, mappings in stat_map.items():
        key = f"{mappings['espn_name']}_{mappings['category']}"

        if mappings['stat_iteration_type'] == "derived_rate":
            # Use numerator and denominator fields
            numerator_field = mappings.get("numerator")
            denominator_field = mappings.get("denominator")
            if numerator_field and denominator_field:
                numerator = target_object.get(numerator_field, 0)
                denominator = target_object.get(denominator_field, 0)
                target_object[stat_name] = numerator / denominator if denominator else 0

        elif mappings['stat_iteration_type'] == "derived_average":
            # Use base_stat / gamesPlayed
            base_stat_field = mappings.get("base_stat")
            games = target_object.get("gamesPlayed", 1)
            if base_stat_field:
                base_value = target_object.get(base_stat_field, 0)
                target_object[stat_name] = base_value / games if games else 0

        elif mappings['stat_iteration_type'] == 'special_rate':
            if stat_name == 'penaltyKillPct':
                numerator_one_field = mappings.get("numerator_one")
                numerator_two_field = mappings.get("numerator_two")
                denominator_field = mappings.get("denominator")
                numerator_one = target_object.get(numerator_one_field, 0)
                numerator_two = target_object.get(numerator_two_field, 0)
                denominator = target_object.get(denominator_field, 0)
                target_object[stat_name] = ((numerator_one - numerator_two) / denominator)
            elif stat_name == 'runsCreated':
                runs_field = mappings.get("runs")
                runs = target_object.get(runs_field, 0)
                totalBases_field = mappings.get("totalBases")
                totalBases = target_object.get(totalBases_field, 0)
                walks_field = mappings.get("walks")
                walks = target_object.get(walks_field, 0)
                atBats_field = mappings.get("atBats")
                atBats = target_object.get(atBats_field, 0)
                target_object[stat_name] = ((runs + totalBases + walks) / atBats)
            elif stat_name == 'runsCreatedPer27Outs':
                runsCreated_field = mappings.get("runsCreated")
                runsCreated = target_object.get(runsCreated_field, 0)
                outsOnField_field = mappings.get("outsOnField")
                outsOnField = target_object.get(outsOnField_field, 0)
                target_object[stat_name] = ((runsCreated * 27) / outsOnField)
            elif stat_name == 'BIPA':
                hits_field = mappings.get("hits")
                hits = target_object.get(hits_field, 0)
                walks_field = mappings.get("walks")
                walks = target_object.get(walks_field, 0)
                hitByPitch_field = mappings.get("hitByPitch")
                hitByPitch = target_object.get(hitByPitch_field, 0)
                battersFaced_field = mappings.get("battersFaced")
                battersFaced = target_object.get(battersFaced_field, 0)
                target_object[stat_name] = ((hits + walks + hitByPitch) / battersFaced)
            elif stat_name == 'onBasePct':
                hits_field = mappings.get("hits")
                hits = target_object.get(hits_field, 0)
                walks_field = mappings.get("walks")
                walks = target_object.get(walks_field, 0)
                hitByPitch_field = mappings.get("hitByPitch")
                hitByPitch = target_object.get(hitByPitch_field, 0)
                plateAppearances_field = mappings.get("plateAppearances")
                plateAppearances = target_object.get(plateAppearances_field, 0)
                target_object[stat_name] = ((hits + walks + hitByPitch) / plateAppearances)
            elif stat_name == 'OPS':
                onBasePct_field = mappings.get("onBasePct")
                onBasePct = target_object.get(onBasePct_field, 0)
                slugAvg_field = mappings.get("slugAvg")
                slugAvg = target_object.get(slugAvg_field, 0)
                target_object[stat_name] = (onBasePct + slugAvg)
            elif stat_name == 'WHIP':
                walks_field = mappings.get("walks")
                walks = target_object.get(walks_field, 0)
                hits_field = mappings.get("hits")
                hits = target_object.get(hits_field, 0)
                innings_field = mappings.get("innings")
                innings = target_object.get(innings_field, 0)
                target_object[stat_name] = ((walks + hits) / innings)
            elif stat_name == 'strikeoutsPerNineInnings':
                strikeouts_field = mappings.get("strikeouts")
                strikeouts = target_object.get(strikeouts_field, 0)
                innings_field = mappings.get("innings")
                innings = target_object.get(innings_field, 0)
                target_object[stat_name] = ((strikeouts * 9) / innings)
            elif stat_name == 'runsProduced':
                runs_field = mappings.get("runs")
                runs = target_object.get(runs_field, 0)
                RBIs_field = mappings.get("RBIs")
                RBIs = target_object.get(RBIs_field, 0)
                gamesPlayed_field = mappings.get("gamesPlayed")
                gamesPlayed = target_object.get(gamesPlayed_field, 0)
                target_object[stat_name] = ((runs + RBIs) / gamesPlayed)
            elif stat_name == 'extraBaseHits':
                doubles_field = mappings.get("doubles")
                doubles = target_object.get(doubles_field, 0)
                triples_field = mappings.get("triples")
                triples = target_object.get(triples_field, 0)
                homeRuns_field = mappings.get("homeRuns")
                homeRuns = target_object.get(homeRuns_field, 0)
                target_object[stat_name] = (doubles + triples + homeRuns)
            elif stat_name == 'isolatedPower':
                extraBaseHits_field = mappings.get("extraBaseHits")
                extraBaseHits = target_object.get(extraBaseHits_field, 0)
                atBats_field = mappings.get("atBats")
                atBats = target_object.get(atBats_field, 0)
                target_object[stat_name] = extraBaseHits + atBats
            elif stat_name == 'ERA':
                earnedRuns_field = mappings.get("earnedRuns")
                earnedRuns = target_object.get(earnedRuns_field, 0)
                innings_field = mappings.get("innings")
                innings = target_object.get(innings_field, 0)
                target_object[stat_name] = ((earnedRuns * 9) / innings)
            elif stat_name == 'rangeFactor':
                putouts_field = mappings.get("putouts")
                putouts = target_object.get(putouts_field, 0)
                assists_field = mappings.get("assists")
                assists = target_object.get(assists_field, 0)
                innings_field = mappings.get("innings")
                innings = target_object.get(innings_field, 0)
                target_object[stat_name] = ((putouts + assists) / innings)
            elif stat_name == 'outsOnField':
                innings_field = mappings.get("innings")
                innings = target_object.get(innings_field, 0)
                strikeouts_pitching_field = mappings.get("strikeouts_pitching")
                strikeouts_pitching = target_object.get(strikeouts_pitching_field, 0)
                target_object[stat_name] = ((innings * 3) - strikeouts_pitching)

    return target_object
