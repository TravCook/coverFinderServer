import re


def normalize_team_name(team_name, league=None):
    known_team_names = {
        "SE Missouri State Redhawks": "Southeast Missouri State Redhawks",
        "Arkansas-Little Rock Trojans": "Little Rock Trojans",
        "GW Revolutionaries": "George Washington Revolutionaries",
        "Loyola (Chi) Ramblers": "Loyola Chicago Ramblers",
        "IUPUI Jaguars": "IU Indianapolis Jaguars",
        "Fort Wayne Mastodons": "Purdue Fort Wayne Mastodons",
        "Boston Univ. Terriers": "Boston University Terriers",
        "Army Knights": "Army Black Knights",
        "Gardner-Webb Bulldogs": "Gardner-Webb Runnin' Bulldogs",
        "Albany": "UAlbany Great Danes",
        "Florida Int'l Golden Panthers": "Florida International Panthers",
        "N Colorado Bears": "Northern Colorado Bears",
        "Long Beach State 49ers": "Long Beach State Beach",
        "SIU-Edwardsville Cougars": "SIU Edwardsville Cougars",
        "Grand Canyon Antelopes": "Grand Canyon Lopes",
        "Tenn-Martin Skyhawks": "UT Martin Skyhawks",
        "Seattle Redhawks": "Seattle U Redhawks",
        "CSU Northridge Matadors": "Cal State Northridge Matadors",
        "UT-Arlington Mavericks": "UT Arlington Mavericks",
        "Appalachian State Mountaineers": "App State Mountaineers",
        "Mt. St. Mary's Mountaineers": "Mount St. Mary's Mountaineers",
        "Sam Houston State Bearkats": "Sam Houston Bearkats",
        "UMKC Kangaroos": "Kansas City Roos",
        "Cal Baptist Lancers": "California Baptist Lancers",
        "CSU Fullerton Titans": "Cal State Fullerton Titans",
        "LIU Sharks": "Long Island University Sharks",
        "Nicholls State Colonels": "Nicholls Colonels",
        "Texas A&M-Commerce Lions": "East Texas A&M Lions",
        "Prairie View Panthers": "Prairie View A&M Panthers",
        "St. Thomas (MN) Tommies": "St. Thomas-Minnesota Tommies",
        "CSU Bakersfield Roadrunners": "Cal State Bakersfield Roadrunners",
        "Loyola (MD) Greyhounds": "Loyola Maryland Greyhounds",
        "American Eagles": "American University Eagles",
        "Central Connecticut State Blue Devils": "Central Connecticut Blue Devils",
        "Grambling State Tigers": "Grambling Tigers",
        "Miss Valley State Delta Devils": "Mississippi Valley State Delta Devils",
        "Texas A&M-CC Islanders": "Texas A&M-Corpus Christi Islanders",
        "Maryland-Eastern Shore Hawks": "Maryland Eastern Shore Hawks",
        "IU Indy Jaguars": "IU Indianapolis Jaguars",
        "Oakland Athletics": "Athletics Athletics",
        "Hawaii Rainbow Warriors": "Hawai'i Rainbow Warriors",
        "San Jose State Spartans": "San José State Spartans",
        "Southern Mississippi Golden Eagles": "Southern Miss Golden Eagles",
        "UMass Minutemen": "Massachusetts Minutemen",
        "Louisiana Ragin Cajuns": "Louisiana Ragin' Cajuns",
        "Southeastern Louisiana Lions": "SE Louisiana Lions",
        "Houston Baptist Huskies": "Houston Christian Huskies",
        "William and Mary Tribe": "William & Mary Tribe",
        "Youngstown St Penguins": "Youngstown State Penguins",
        "Southern University Jaguars": "Southern Jaguars",
        "Gardner-Webb Runnin Bulldogs": "Gardner-Webb Runnin' Bulldogs",
        "McNeese State Cowboys": "McNeese Cowboys",
        "Albany Great Danes": "UAlbany Great Danes",
        "Citadel Bulldogs": "The Citadel Bulldogs"
    }


    # Replace common abbreviations or patterns
    if league in ('basketball_ncaab', 'basketball_wncaab'):
        team_name = re.sub(r'\bst\b(?!\.)', 'State', team_name, flags=re.IGNORECASE)

    # Normalize known team names
    if team_name in known_team_names:
        team_name = known_team_names[team_name]

    # WNCAAB specific replacements
    if league == 'basketball_wncaab':
        wncaab_map = {
            'Penn State Nittany Lions': 'Penn State Lady Lions',
            'Georgia Bulldogs': 'Georgia Lady Bulldogs',
            'Tennessee Volunteers': 'Tennessee Lady Volunteers',
            'Oklahoma State Cowboys': 'Oklahoma State Cowgirls',
            'UNLV Rebels': 'UNLV Lady Rebels',
            'Texas Tech Red Raiders': 'Texas Tech Lady Raiders',
            "Hawai'i Rainbow Warriors": "Hawai'i Rainbow Wahine",
            'Morgan State Bears': 'Morgan State Lady Bears',
            'Montana Grizzlies': 'Montana Lady Griz',
            'Western Kentucky Hilltoppers': 'Western Kentucky Lady Toppers',
            'Massachusetts Minutemen': 'Massachusetts Minutewomen',
            'Crown College Polars': 'Crown College Storm',
            'NE Illinois Ne Illinois': 'Northeastern Illinois Golden Eagles',
            'Hampton Pirates': 'Hampton Lady Pirates',
            'McNeese Cowboys': 'McNeese Cowgirls',
            'Missouri State Bears': 'Missouri State Lady Bears',
            'Wyoming Cowboys': 'Wyoming Cowgirls',
            'Grambling Tigers': 'Grambling Lady Tigers',
            'Alcorn State Braves': 'Alcorn State Lady Braves',
            'Central Arkansas Bears': 'Central Arkansas Sugar Bears',
            'Alabama State Hornets': 'Alabama State Lady Hornets',
            'Jackson State Tigers': 'Jackson State Lady Tigers',
            'Mississippi Valley State Delta Devils': 'Mississippi Valley State Devilettes',
            'Southern Miss Golden Eagles': 'Southern Miss Lady Eagles',
            'Prairie View A&M Panthers': 'Prairie View A&M Lady Panthers',
            'South Carolina State Bulldogs': 'South Carolina State Lady Bulldogs',
            'SE Louisiana Lions': 'SE Louisiana Lady Lions',
            'Stephen F. Austin Lumberjacks': 'Stephen F. Austin Ladyjacks',
            'Tennessee State Tigers': 'Tennessee State Lady Tigers',
            'Louisiana Tech Bulldogs': 'Louisiana Tech Lady Techsters',
            'Northwestern State Demons': 'Northwestern State Lady Demons',
            'East Tennessee State Buccaneers': 'East Tennessee State Bucs',
        }
        if team_name in wncaab_map:
            team_name = wncaab_map[team_name]

    return team_name
