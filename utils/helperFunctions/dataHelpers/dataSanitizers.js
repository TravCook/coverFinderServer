const db = require('../../../models_sql')
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const moment = require('moment')
const normalizeTeamName = (teamName, league) => {

    const knownTeamNames = {
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
        "Hawaii Rainbow Warriors": `Hawai'i Rainbow Warriors`,
        "San Jose State Spartans": `San José State Spartans`,
        "Southern Mississippi Golden Eagles": `Southern Miss Golden Eagles`,
        "UMass Minutemen": `Massachusetts Minutemen`,
        "Louisiana Ragin Cajuns": `Louisiana Ragin' Cajuns`,
        "Southeastern Louisiana Lions": `SE Louisiana Lions`,
        "Houston Baptist Huskies": `Houston Christian Huskies`,
        "William and Mary Tribe": `William & Mary Tribe`,
        "Youngstown St Penguins": `Youngstown State Penguins`,
        "Southern University Jaguars": `Southern Jaguars`,
        "Gardner-Webb Runnin Bulldogs": `Gardner-Webb Runnin' Bulldogs`,
        "McNeese State Cowboys": `McNeese Cowboys`,
    }

    if (league === 'basketball_ncaab' || league === 'basketball_wncaab') {
        // Replace common abbreviations or patterns
        teamName = teamName.replace(/\bst\b(?!\.)/gi, 'State'); // Match "St" or "st" as a separate word, not followed by a perio
    }

    if (knownTeamNames[teamName]) {
        teamName = knownTeamNames[teamName];
    }

    if (league === 'basketball_wncaab') {
        if (teamName === 'Penn State Nittany Lions') {
            teamName = 'Penn State Lady Lions';
        } else if (teamName === 'Georgia Bulldogs') {
            teamName = 'Georgia Lady Bulldogs';
        } else if (teamName === 'Tennessee Volunteers') {
            teamName = 'Tennessee Lady Volunteers';
        } else if (teamName === 'Oklahoma State Cowboys') {
            teamName = 'Oklahoma State Cowgirls';
        } else if (teamName === 'UNLV Rebels') {
            teamName = 'UNLV Lady Rebels';
        } else if (teamName === 'Texas Tech Red Raiders') {
            teamName = 'Texas Tech Lady Raiders';
        } else if (teamName === 'Hawai\'i Rainbow Warriors') {
            teamName = 'Hawai\'i Rainbow Wahine';
        } else if (teamName === 'Morgan State Bears') {
            teamName = 'Morgan State Lady Bears';
        } else if (teamName === 'Montana Grizzlies') {
            teamName = 'Montana Lady Griz';
        } else if (teamName === 'Western Kentucky Hilltoppers') {
            teamName = 'Western Kentucky Lady Toppers';
        } else if (teamName === 'Massachusetts Minutemen') {
            teamName = 'Massachusetts Minutewomen';
        } else if (teamName === 'Crown College Polars') {
            teamName = 'Crown College Storm';
        } else if (teamName === 'NE Illinois Ne Illinois') {
            teamName = 'Northeastern Illinois Golden Eagles';
        } else if (teamName === 'Hampton Pirates') {
            teamName = 'Hampton Lady Pirates';
        } else if (teamName === 'McNeese Cowboys') {
            teamName = 'McNeese Cowgirls';
        } else if (teamName === 'Missouri State Bears') {
            teamName = 'Missouri State Lady Bears';
        } else if (teamName === 'Wyoming Cowboys') {
            teamName = 'Wyoming Cowgirls';
        } else if (teamName === 'Grambling Tigers') {
            teamName = 'Grambling Lady Tigers';
        } else if (teamName === 'Alcorn State Braves') {
            teamName = 'Alcorn State Lady Braves';
        } else if (teamName === 'Central Arkansas Bears') {
            teamName = 'Central Arkansas Sugar Bears';
        } else if (teamName === 'Alabama State Hornets') {
            teamName = 'Alabama State Lady Hornets';
        } else if (teamName === 'Jackson State Tigers') {
            teamName = 'Jackson State Lady Tigers';
        } else if (teamName === 'Mississippi Valley State Delta Devils') {
            teamName = 'Mississippi Valley State Devilettes';
        } else if (teamName === 'Southern Miss Golden Eagles') {
            teamName = 'Southern Miss Lady Eagles';
        } else if (teamName === 'Prairie View A&M Panthers') {
            teamName = 'Prairie View A&M Lady Panthers';
        } else if (teamName === 'South Carolina State Bulldogs') {
            teamName = 'South Carolina State Lady Bulldogs';
        } else if (teamName === 'SE Louisiana Lions') {
            teamName = 'SE Louisiana Lady Lions';
        } else if (teamName === 'Stephen F. Austin Lumberjacks') {
            teamName = 'Stephen F. Austin Ladyjacks';
        } else if (teamName === 'Tennessee State Tigers') {
            teamName = 'Tennessee State Lady Tigers';
        } else if (teamName === 'Louisiana Tech Bulldogs') {
            teamName = 'Louisiana Tech Lady Techsters';
        } else if (teamName === 'Northwestern State Demons') {
            teamName = 'Northwestern State Lady Demons';
        } else if (teamName === 'East Tennessee State Buccaneers') {
            teamName = 'East Tennessee State Bucs';
        }
    }


    // // Replace hyphens with spaces
    // teamName = teamName.replace(/-/g, ' '); // Replace all hyphens with spaces

    // // Remove all punctuation and extra spaces
    // teamName = teamName.replace(/[^\w\s&]/g, ''); // Removes non-alphanumeric characters except spaces and ampersands
    // teamName = teamName.replace(/\s+/g, ' ').trim(); // Remove extra spaces and trim leading/trailing spaces

    return teamName;
}

const getDynamicStatYear = (startMonth, endMonth, currentDate) => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed, so add 1.

    if (endMonth > startMonth) { //IF THE SPORT HAPPENS WITHIN ONE YEAR
        if (currentMonth >= startMonth && currentMonth <= endMonth) {
            // In season, statYear is the current year
            return currentYear
        } else if (currentMonth < startMonth) { //out of season, before season starts
            return currentYear
        } else if (currenMonth > endMonth) { // out of season after season happens
            return currentYear + 1
        }

    } else { // IF THE SPORT SPANS TWO YEARS
        // For sports that start late in the year (e.g., NFL, NBA), we'll base the statYear on the start month.
        if (currentMonth >= startMonth && currentMonth <= 12) {
            // In season, up to december
            return currentYear + 1
        } else if (currentMonth <= endMonth && currentMonth <= 1) {
            // in season after Jan.
            return currentYear
        } else if (currentMonth >= endMonth && currentMonth <= startMonth) {
            // out of season
            return currentYear + 1
        }
    }



}
const checkNaNValues = (data, game) => {
    data.forEach((row, index) => {
        // console.log(row)
        if (isNaN(row) || row === Infinity || row === -Infinity || row === null || row === undefined) {
            console.log(game.id)
            console.log(`NaN or Infinity found in row ${index}`);
        }
    });
};

const nameSearch = async () => {
    let mensTeams = await BasketballTeam.find({ league: 'mens-college-basketball' })
    let womensTeams = await BasketballTeam.find({ league: 'womens-college-basketball' })

    for (const mensTeam of mensTeams) {
        let matchingTeam = womensTeams.find((team) => team.espnID === mensTeam.espnID)
        if (matchingTeam) {
            if (mensTeam.espnDisplayName !== matchingTeam.espnDisplayName) {
                console.log(`Mens Team Name: ${mensTeam.espnDisplayName}`)
                console.log(`Womens Team Name: ${matchingTeam.espnDisplayName}`)
            }
        }
        else {
            console.log(`No Matching Team for: ${mensTeam.espnDisplayName}`)
        }
    }
}

const normalizeOutcomes = (outcomes, league) => {
    return outcomes.map(outcome => ({
        ...outcome,
        name: normalizeTeamName(outcome.name, league) // Normalize the outcome team name
    }));
};

const getCommonStats = (team) => ({
    //------------------------------SHARED STATS-----------------------------------------------------------
    seasonWinLoss: team.seasonWinLoss,
    homeWinLoss: team.homeWinLoss,
    awayWinLoss: team.awayWinLoss,
    pointDiff: team.pointDiff,

    USFBcompletionPercent: team.stats.USFBcompletionPercent,
    USFBcompletions: team.stats.USFBcompletions,
    USFBcompletionsPerGame: team.stats.USFBcompletionsPerGame,
    USFBnetPassingYards: team.stats.USFBnetPassingYards,
    USFBnetPassingYardsPerGame: team.stats.USFBnetPassingYardsPerGame,
    USFBpassingFirstDowns: team.stats.USFBpassingFirstDowns,
    USFBpassingTouchdowns: team.stats.USFBpassingTouchdowns,
    USFBpassingYards: team.stats.USFBpassingYards,
    USFBpassingYardsPerGame: team.stats.USFBpassingYardsPerGame,
    USFBpassingAttempts: team.stats.USFBpassingAttempts,
    USFBpassingAttemptsPerGame: team.stats.USFBpassingAttemptsPerGame,
    USFByardsPerPassAttempt: team.stats.USFByardsPerPassAttempt,
    USFBrushingAttempts: team.stats.USFBrushingAttempts,
    USFBrushingFirstDowns: team.stats.USFBrushingFirstDowns,
    USFBrushingTouchdowns: team.stats.USFBrushingTouchdowns,
    USFBrushingYards: team.stats.USFBrushingYards,
    USFBrushingYardsPerGame: team.stats.USFBrushingYardsPerGame,
    USFByardsPerRushAttempt: team.stats.USFByardsPerRushAttempt,
    USFBreceivingFirstDowns: team.stats.USFBreceivingFirstDowns,
    USFBreceivingTouchdowns: team.stats.USFBreceivingTouchdowns,
    USFBreceivingYards: team.stats.USFBreceivingYards,
    USFBreceivingYardsPerGame: team.stats.USFBreceivingYardsPerGame,
    USFBreceivingYardsPerReception: team.stats.USFBreceivingYardsPerReception,
    USFBreceivingYardsAfterCatch: team.stats.USFBreceivingYardsAfterCatch,
    USFBreceivingYardsAfterCatchPerGame: team.stats.USFBreceivingYardsAfterCatchPerGame,
    USFBtotalTouchdowns: team.stats.USFBtotalTouchdowns,
    USFBtouchdownsPerGame: team.stats.USFBtouchdownsPerGame,
    USFBtotalPoints: team.stats.USFBtotalPoints,
    USFBpointsPerGame: team.stats.USFBpointsPerGame,
    USFBtacklesforLoss: team.stats.USFBtacklesforLoss,
    USFBtacklesforLossPerGame: team.stats.USFBtacklesforLossPerGame,
    USFBinterceptions: team.stats.USFBinterceptions,
    USFByardsPerInterception: team.stats.USFByardsPerInterception,
    USFBsacksTotal: team.stats.USFBsacksTotal,
    USFBsacksPerGame: team.stats.USFBsacksPerGame,
    USFBsackYards: team.stats.USFBsackYards,
    USFBsackYardsPerGame: team.stats.USFBsackYardsPerGame,
    USFBstuffs: team.stats.USFBstuffs,
    USFBstuffsPerGame: team.stats.USFBstuffsPerGame,
    USFBstuffYards: team.stats.USFBstuffYards,
    USFBpassesDefended: team.stats.USFBpassesDefended,
    USFBpassesDefendedPerGame: team.stats.USFBpassesDefendedPerGame,
    USFBsafties: team.stats.USFBsafties,
    USFBaverageKickoffYards: team.stats.USFBaverageKickoffYards,
    USFBaverageKickoffYardsPerGame: team.stats.USFBaverageKickoffYardsPerGame,
    USFBextraPointAttempts: team.stats.USFBextraPointAttempts,
    USFBextraPointAttemptsPerGame: team.stats.USFBextraPointAttemptsPerGame,
    USFBextraPointsMade: team.stats.USFBextraPointsMade,
    USFBextraPointsMadePerGame: team.stats.USFBextraPointsMadePerGame,
    USFBextraPointPercent: team.stats.USFBextraPointPercent,
    USFBextraPointPercentPerGame: team.stats.USFBextraPointPercentPerGame,
    USFBfieldGoalAttempts: team.stats.USFBfieldGoalAttempts,
    USFBfieldGoalAttemptsPerGame: team.stats.USFBfieldGoalAttemptsPerGame,
    USFBfieldGoalsMade: team.stats.USFBfieldGoalsMade,
    USFBfieldGoalsMadePerGame: team.stats.USFBfieldGoalsMadePerGame,
    USFBfieldGoalPct: team.stats.USFBfieldGoalPct,
    USFBfieldGoalPercentPerGame: team.stats.USFBfieldGoalPercentPerGame,
    USFBtouchbacks: team.stats.USFBtouchbacks,
    USFBtouchbacksPerGame: team.stats.USFBtouchbacksPerGame,
    USFBtouchBackPercentage: team.stats.USFBtouchBackPercentage,
    USFBkickReturns: team.stats.USFBkickReturns,
    USFBkickReturnsPerGame: team.stats.USFBkickReturnsPerGame,
    USFBkickReturnYards: team.stats.USFBkickReturnYards,
    USFBkickReturnYardsPerGame: team.stats.USFBkickReturnYardsPerGame,
    USFBpuntReturns: team.stats.USFBpuntReturns,
    USFBpuntReturnsPerGame: team.stats.USFBpuntReturnsPerGame,
    USFBpuntReturnFairCatchPct: team.stats.USFBpuntReturnFairCatchPct,
    USFBpuntReturnYards: team.stats.USFBpuntReturnYards,
    USFBpuntReturnYardsPerGame: team.stats.USFBpuntReturnYardsPerGame,
    USFByardsPerReturn: team.stats.USFByardsPerReturn,
    USFBthirdDownEfficiency: team.stats.USFBthirdDownEfficiency,
    USFBtotalPenyards: team.stats.USFBtotalPenyards,
    USFBaveragePenYardsPerGame: team.stats.USFBaveragePenYardsPerGame,
    USFBgiveaways: team.stats.USFBgiveaways,
    USFBtakeaways: team.stats.USFBtakeaways,
    USFBturnoverDiff: team.stats.USFBturnoverDiff,
    USFBtotalFirstDowns: team.stats.USFBtotalFirstDowns,

    //------------------------------AMERICAN FOOTBALL STATS-----------------------------------------------------------
    BSBbattingStrikeouts: team.stats.BSBbattingStrikeouts,
    BSBrunsBattedIn: team.stats.BSBrunsBattedIn,
    BSBsacrificeHits: team.stats.BSBsacrificeHits,
    BSBHitsTotal: team.stats.BSBHitsTotal,
    BSBwalks: team.stats.BSBwalks,
    BSBruns: team.stats.BSBruns,
    BSBhomeRuns: team.stats.BSBhomeRuns,
    BSBdoubles: team.stats.BSBdoubles,
    BSBtotalBases: team.stats.BSBtotalBases,
    BSBextraBaseHits: team.stats.BSBextraBaseHits,
    BSBbattingAverage: team.stats.BSBbattingAverage,
    BSBsluggingPercentage: team.stats.BSBsluggingPercentage,
    BSBonBasePercentage: team.stats.BSBonBasePercentage,
    BSBonBasePlusSlugging: team.stats.BSBonBasePlusSlugging,
    BSBgroundToFlyRatio: team.stats.BSBgroundToFlyRatio,
    BSBatBatsPerHomeRun: team.stats.BSBatBatsPerHomeRun,
    BSBstolenBasePercentage: team.stats.BSBstolenBasePercentage,
    BSBbatterWalkToStrikeoutRatio: team.stats.BSBbatterWalkToStrikeoutRatio,
    BSBsaves: team.stats.BSBsaves,
    BSBpitcherStrikeouts: team.stats.BSBpitcherStrikeouts,
    BSBhitsGivenUp: team.stats.BSBhitsGivenUp,
    BSBearnedRuns: team.stats.BSBearnedRuns,
    BSBbattersWalked: team.stats.BSBbattersWalked,
    BSBrunsAllowed: team.stats.BSBrunsAllowed,
    BSBhomeRunsAllowed: team.stats.BSBhomeRunsAllowed,
    BSBwins: team.stats.BSBwins,
    BSBshutouts: team.stats.BSBshutouts,
    BSBearnedRunAverage: team.stats.BSBearnedRunAverage,
    BSBwalksHitsPerInningPitched: team.stats.BSBwalksHitsPerInningPitched,
    BSBwinPct: team.stats.BSBwinPct,
    BSBpitcherCaughtStealingPct: team.stats.BSBpitcherCaughtStealingPct,
    BSBpitchesPerInning: team.stats.BSBpitchesPerInning,
    BSBrunSupportAverage: team.stats.BSBrunSupportAverage,
    BSBopponentBattingAverage: team.stats.BSBopponentBattingAverage,
    BSBopponentSlugAverage: team.stats.BSBopponentSlugAverage,
    BSBopponentOnBasePct: team.stats.BSBopponentOnBasePct,
    BSBopponentOnBasePlusSlugging: team.stats.BSBopponentOnBasePlusSlugging,
    BSBsavePct: team.stats.BSBsavePct,
    BSBstrikeoutsPerNine: team.stats.BSBstrikeoutsPerNine,
    BSBpitcherStrikeoutToWalkRatio: team.stats.BSBpitcherStrikeoutToWalkRatio,
    BSBdoublePlays: team.stats.BSBdoublePlays,
    BSBerrors: team.stats.BSBerrors,
    BSBpassedBalls: team.stats.BSBpassedBalls,
    BSBassists: team.stats.BSBassists,
    BSBputouts: team.stats.BSBputouts,
    BSBcatcherCaughtStealing: team.stats.BSBcatcherCaughtStealing,
    BSBcatcherCaughtStealingPct: team.stats.BSBcatcherCaughtStealingPct,
    BSBcatcherStolenBasesAllowed: team.stats.BSBcatcherStolenBasesAllowed,
    BSBfieldingPercentage: team.stats.BSBfieldingPercentage,
    BSBrangeFactor: team.stats.BSBrangeFactor,

    //------------------------------BASKETBALL STATS-----------------------------------------------------------
    BSKBtotalPoints: team.stats.BSKBtotalPoints,
    BSKBpointsPerGame: team.stats.BSKBpointsPerGame,
    BSKBassists: team.stats.BSKBassists,
    BSKBassistsPerGame: team.stats.BSKBassistsPerGame,
    BSKBassistRatio: team.stats.BSKBassistRatio,
    BSKBeffectiveFgPercent: team.stats.BSKBeffectiveFgPercent,
    BSKBfieldGoalPercent: team.stats.BSKBfieldGoalPercent,
    BSKBfieldGoalsAttempted: team.stats.BSKBfieldGoalsAttempted,
    BSKBfieldGoalsMade: team.stats.BSKBfieldGoalsMade,
    BSKBfieldGoalsPerGame: team.stats.BSKBfieldGoalsPerGame,
    BSKBfreeThrowPercent: team.stats.BSKBfreeThrowPercent,
    BSKBfreeThrowsAttempted: team.stats.BSKBfreeThrowsAttempted,
    BSKBfreeThrowsMade: team.stats.BSKBfreeThrowsMade,
    BSKBfreeThrowsMadePerGame: team.stats.BSKBfreeThrowsMadePerGame,
    BSKBoffensiveRebounds: team.stats.BSKBoffensiveRebounds,
    BSKBoffensiveReboundsPerGame: team.stats.BSKBoffensiveReboundsPerGame,
    BSKBoffensiveReboundRate: team.stats.BSKBoffensiveReboundRate,
    BSKBoffensiveTurnovers: team.stats.BSKBoffensiveTurnovers,
    BSKBturnoversPerGame: team.stats.BSKBturnoversPerGame,
    BSKBturnoverRatio: team.stats.BSKBturnoverRatio,
    BSKBthreePointPct: team.stats.BSKBthreePointPct,
    BSKBthreePointsAttempted: team.stats.BSKBthreePointsAttempted,
    BSKBthreePointsMade: team.stats.BSKBthreePointsMade,
    BSKBtrueShootingPct: team.stats.BSKBtrueShootingPct,
    BSKBpace: team.stats.BSKBpace,
    BSKBpointsInPaint: team.stats.BSKBpointsInPaint,
    BSKBshootingEfficiency: team.stats.BSKBshootingEfficiency,
    BSKBscoringEfficiency: team.stats.BSKBscoringEfficiency,
    BSKBblocks: team.stats.BSKBblocks,
    BSKBblocksPerGame: team.stats.BSKBblocksPerGame,
    BSKBdefensiveRebounds: team.stats.BSKBdefensiveRebounds,
    BSKBdefensiveReboundsPerGame: team.stats.BSKBdefensiveReboundsPerGame,
    BSKBsteals: team.stats.BSKBsteals,
    BSKBstealsPerGame: team.stats.BSKBstealsPerGame,
    BSKBreboundRate: team.stats.BSKBreboundRate,
    BSKBreboundsPerGame: team.stats.BSKBreboundsPerGame,
    BSKBfoulsPerGame: team.stats.BSKBfoulsPerGame,
    BSKBteamAssistToTurnoverRatio: team.stats.BSKBteamAssistToTurnoverRatio,

    //------------------------------HOCKEY STATS-----------------------------------------------------------
    HKYgoals: team.stats.HKYgoals,
    HKYgoalsPerGame: team.stats.HKYgoalsPerGame,
    HKYassists: team.stats.HKYassists,
    HKYassistsPerGame: team.stats.HKYassistsPerGame,
    HKYshotsIn1st: team.stats.HKYshotsIn1st,
    HKYshotsIn1stPerGame: team.stats.HKYshotsIn1stPerGame,
    HKYshotsIn2nd: team.stats.HKYshotsIn2nd,
    HKYshotsIn2ndPerGame: team.stats.HKYshotsIn2ndPerGame,
    HKYshotsIn3rd: team.stats.HKYshotsIn3rd,
    HKYshotsIn3rdPerGame: team.stats.HKYshotsIn3rdPerGame,
    HKYtotalShots: team.stats.HKYtotalShots,
    HKYtotalShotsPerGame: team.stats.HKYtotalShotsPerGame,
    HKYshotsMissed: team.stats.HKYshotsMissed,
    HKYshotsMissedPerGame: team.stats.HKYshotsMissedPerGame,
    HKYppgGoals: team.stats.HKYppgGoals,
    HKYppgGoalsPerGame: team.stats.HKYppgGoalsPerGame,
    HKYppassists: team.stats.HKYppassists,
    HKYppassistsPerGame: team.stats.HKYppassistsPerGame,
    HKYpowerplayPct: team.stats.HKYpowerplayPct,
    HKYshortHandedGoals: team.stats.HKYshortHandedGoals,
    HKYshortHandedGoalsPerGame: team.stats.HKYshortHandedGoalsPerGame,
    HKYshootingPct: team.stats.HKYshootingPct,
    HKYfaceoffs: team.stats.HKYfaceoffs,
    HKYfaceoffsPerGame: team.stats.HKYfaceoffsPerGame,
    HKYfaceoffsWon: team.stats.HKYfaceoffsWon,
    HKYfaceoffsWonPerGame: team.stats.HKYfaceoffsWonPerGame,
    HKYfaceoffsLost: team.stats.HKYfaceoffsLost,
    HKYfaceoffsLostPerGame: team.stats.HKYfaceoffsLostPerGame,
    HKYfaceoffPct: team.stats.HKYfaceoffPct,
    HKYfaceoffPctPerGame: team.stats.HKYfaceoffPctPerGame,
    HKYgiveaways: team.stats.HKYgiveaways,
    HKYgoalsAgainst: team.stats.HKYgoalsAgainst,
    HKYgoalsAgainstPerGame: team.stats.HKYgoalsAgainstPerGame,
    HKYshotsAgainst: team.stats.HKYshotsAgainst,
    HKYshotsAgainstPerGame: team.stats.HKYshotsAgainstPerGame,
    HKYpenaltyKillPct: team.stats.HKYpenaltyKillPct,
    HKYpenaltyKillPctPerGame: team.stats.HKYpenaltyKillPctPerGame,
    HKYppGoalsAgainst: team.stats.HKYppGoalsAgainst,
    HKYppGoalsAgainstPerGame: team.stats.HKYppGoalsAgainstPerGame,
    HKYshutouts: team.stats.HKYshutouts,
    HKYsaves: team.stats.HKYsaves,
    HKYsavesPerGame: team.stats.HKYsavesPerGame,
    HKYsavePct: team.stats.HKYsavePct,
    HKYblockedShots: team.stats.HKYblockedShots,
    HKYblockedShotsPerGame: team.stats.HKYblockedShotsPerGame,
    HKYhits: team.stats.HKYhits,
    HKYhitsPerGame: team.stats.HKYhitsPerGame,
    HKYtakeaways: team.stats.HKYtakeaways,
    HKYtakeawaysPerGame: team.stats.HKYtakeawaysPerGame,
    HKYshotDifferential: team.stats.HKYshotDifferential,
    HKYshotDifferentialPerGame: team.stats.HKYshotDifferentialPerGame,
    HKYgoalDifferentialPerGame: team.stats.HKYgoalDifferentialPerGame,
    HKYpimDifferential: team.stats.HKYpimDifferential,
    HKYpimDifferentialPerGame: team.stats.HKYpimDifferentialPerGame,
    HKYtotalPenalties: team.stats.HKYtotalPenalties,
    HKYpenaltiesPerGame: team.stats.HKYpenaltiesPerGame,
    HKYpenaltyMinutes: team.stats.HKYpenaltyMinutes,
    HKYpenaltyMinutesPerGame: team.stats.HKYpenaltyMinutesPerGame,
});
const cleanStats = (stats) => {
    const cleanedStats = {};

    for (const key in stats) {
        if (stats[key] !== null && stats[key] !== undefined) {
            cleanedStats[key] = stats[key];
        }
    }

    return cleanedStats;
};

const modelConfAnalyzer = async () => {
    const games = await db.Games.findAll({
        where: {
            complete: true, // Only include completed games
            predictedWinner: { [Op.in]: ['home', 'away'] },
        },
        where: { predictionCorrect: { [Op.not]: null } }, order: [['commence_time', 'DESC']], raw: true
    })

    let percentRanges = ['50-59', '60-69', '70-79', '80-89', '90-100'];
    for (const range of percentRanges) {
        let rangeGames = games.filter(game => {
            let winPercent = game.predictionConfidence * 100; // Convert to percentage
            if (winPercent >= parseInt(range.split('-')[0]) && winPercent <= parseInt(range.split('-')[1])) {
                return true;
            }
            return false;
        });
        console.log(`Games with confidence in range ${range}: ${rangeGames.length} /(${((rangeGames.length / games.length) * 100).toFixed(2)}%)`);
        let rangeWins = rangeGames.filter(game => game.predictionCorrect === true).length;
        let rangeLosses = rangeGames.filter(game => game.predictionCorrect === false).length;
        console.log(`Wins: ${rangeWins}, Losses: ${rangeLosses}`);
        let rangeWinRate = ((rangeWins / (rangeWins + rangeLosses)) * 100).toFixed(2);
        console.log(`Win Rate: ${rangeWinRate}%`);

    }
    const dayStats = {};

    // Group games by date
    for (const game of games) {
        const date = moment(game.commence_time).format('YYYY-MM-DD'); // Get YYYY-MM-DD
        if (!dayStats[date]) dayStats[date] = { correct: 0, total: 0 };

        if (game.predictionCorrect) dayStats[date].correct++;
        dayStats[date].total++;
    }

    const results = [];
    let totalWinrate = 0;

    // Compute winrate per day
    for (const [date, { correct, total }] of Object.entries(dayStats)) {
        const winrate = (correct / total) * 100;
        results.push({ date, winrate });
        totalWinrate += winrate;
    }

    if (results.length === 0) {
        return {
            averageWinrate: 0,
            highestWinrateDay: null,
            lowestWinrateDay: null
        };
    }
    const closeWins = games.filter((game) => game.predictionCorrect === true).filter((game) => {
        return game.predictedWinner === 'home' ? game.homeScore - game.awayScore === 1 : game.awayScore - game.homeScore === 1
    })
    const closeLosses = games.filter((game) => game.predictionCorrect === false).filter((game) => {
        return game.predictedWinner === 'home' ? game.awayScore - game.homeScore === 1 : game.homeScore - game.awayScore === 1
    })
    console.log(`Close wins: ${closeWins.length} (${((closeWins.length / games.length) * 100).toFixed(2)}%)`)
    console.log(`Close losses: ${closeLosses.length} (${((closeLosses.length / games.length) * 100).toFixed(2)}%)`)
    // Sort for high/low
    const highestWinrateDay = results.reduce((a, b) => (a.winrate > b.winrate ? a : b));
    const lowestWinrateDay = results.reduce((a, b) => (a.winrate < b.winrate ? a : b));
    console.log(`Average Winrate: ${(totalWinrate / results.length).toFixed(2)}%`);
    console.log(`Highest Winrate Day: ${highestWinrateDay.date} (${highestWinrateDay.winrate.toFixed(2)}%)`);
    console.log(`Lowest Winrate Day: ${lowestWinrateDay.date} (${lowestWinrateDay.winrate.toFixed(2)}%)`);
    return {
        averageWinrate: totalWinrate / results.length,
        highestWinrateDay,
        lowestWinrateDay
    };


}
module.exports = { checkNaNValues, getDynamicStatYear, normalizeTeamName, nameSearch, normalizeOutcomes, cleanStats, getCommonStats, modelConfAnalyzer };