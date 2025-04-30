const moment = require('moment')
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../../models');

const getTeamRecordUrl = (month, startMonth, endMonth, espnSport, league, statYear, espnID) => {
    let type = 2; // Default type
    if (month === startMonth) {
        type = 1; // Pre-season
    } else if (month === endMonth) {
        type = 3; // Post-season
    }
    return `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/seasons/${statYear}/types/${type}/teams/${espnID}/record?lang=en&region=us`;
};

// Helper function to process the team record response and update the team
const updateTeamRecord = (team, teamRecordJson) => {
    try {
        teamRecordJson.items.forEach((item) => {
            if (item.name === 'overall') {
                item.stats.forEach((stat) => {
                    if (stat.name === 'pointDifferential') {
                        team.pointDiff = stat.value;
                    }
                });
                team.seasonWinLoss = item.displayValue.replace(/, \d+ PTS$/, ''); // Remove ", X PTS" where X is any number
            } else if (item.name === 'Home') {
                team.homeWinLoss = item.displayValue.replace(/, \d+ PTS$/, ''); // Same here
            } else if (item.name === 'Road' || item.name === 'Away') {
                team.awayWinLoss = item.displayValue.replace(/, \d+ PTS$/, ''); // Same here
            }
        });
    } catch (err) {
        console.error("Error processing team record:", err);
    }
};
// Helper function to update team stats
const updateTeamStats = (team, statName, value, perGameValue, displayValue, category) => {
    const statMap = {
        'assists': [
            { modelField: 'BSKBassists', category: 'offensive' },
            { modelField: 'HKYassists', category: 'offensive' },
            { modelField: 'HKYassistsPerGame', isPerGame: true, category: 'offensive' },
            { modelField: 'BSBassists', category: 'fielding' }
        ],
        'hits': [
            { modelField: 'BSBHitsTotal', category: 'batting' },
            { modelField: 'BSBhitsGivenUp', category: 'pitching' },
            { modelField: 'HKYhits', category: 'defensive' },
            { modelField: 'HKYhitsPerGame', isPerGame: true, category: 'defensive' }
        ],
        'shutouts': [
            { modelField: 'HKYshutouts', category: 'defensive' },
            { modelField: 'BSBshutouts', category: 'pitching' }
        ],
        'saves': [
            { modelField: 'HKYsaves', category: 'defensive' },
            { modelField: 'HKYsavesPerGame', isPerGame: true, category: 'defensive' },
            { modelField: 'BSBsaves', category: 'pitching' }
        ],
        'savePct': [
            { modelField: 'HKYsavePct', category: 'defensive' },
            { modelField: 'BSBsavePct', category: 'pitching' }
        ],
        //'statinapi : [{modelField: 'fieldindb'}, category: 'categoryinDb']
        //-------------------------------AMERICAN FOOTBALL STATS---------------------------------------------
        'completionPct': [{ modelField: 'USFBcompletionPercent', category: 'passing' }],
        'completions': [
            { modelField: 'USFBcompletions', category: 'passing' },
            { modelField: 'USFBcompletionsPerGame', isPerGame: true, category: 'passing' }],
        'netPassingYards': [
            { modelField: 'USFBnetPassingYards', category: 'passing' },
            { modelField: 'USFBnetPassingYardsPerGame', isPerGame: true, category: 'passing' }
        ],
        'passingFirstDowns': [{ modelField: 'USFBpassingFirstDowns', category: 'passing' }],
        'passingTouchdowns': [{ modelField: 'USFBpassingTouchdowns', category: 'passing' }],
        'passingYards': [
            { USFBpassingYards: 'USFBPassingYards', category: 'passing' },
            { USFBpassingYardsPerGame: 'USFBPassingYardsPerGame', isPerGame: true, category: 'passing' }
        ],
        'passingAttempts': [
            { modelField: 'USFBpassingAttempts', category: 'passing' },
            { modelField: 'USFBpassingAttemptsPerGame', isPerGame: true, category: 'passing' }
        ],
        'yardsPerPassAttempt': [{ modelField: 'USFByardsPerPassAttempt', category: 'passing' }],
        'rushingAttempts': [{ modelField: 'USFBrushingAttempts', category: 'rushing' }],
        'rushingFirstDowns': [{ modelField: 'USFBrushingFirstDowns', category: 'rushing' }],
        'rushingTouchdowns': [{ modelField: 'USFBrushingTouchdowns', category: 'rushing' }],
        'rushingYards': [
            { modelField: 'USFBrushingYards', category: 'rushing' },
            { modelField: 'USFBrushingYardsPerGame', isPerGame: true, category: 'rushing' }
        ],
        'yardsPerRushAttempt': [{ modelField: 'USFByardsPerRushAttempt', category: 'rushing' }],
        'receivingFirstDowns': [{ modelField: 'USFBreceivingFirstDowns', category: 'receiving' }],
        'receivingTouchdowns': [{ modelField: 'USFBreceivingTouchdowns', category: 'receiving' }],
        'receivingYards': [
            { modelField: 'USFBreceivingYards', category: 'receiving' },
            { modelField: 'USFBreceivingYardsPerGame', category: 'receiving' }
        ],
        'yardsPerReception': [{ modelField: 'USFBreceivingYardsPerReception', category: 'receiving' }],
        'receivingYardsAfterCatch': [
            { modelField: 'USFBreceivingYardsAfterCatch', category: 'receiving' },
            { modelField: 'USFBreceivingYardsAfterCatchPerGame', category: 'receiving' }
        ],
        'totalTouchdowns': [
            { modelField: 'USFBtotalTouchdowns', category: 'scoring' },
            { modelField: 'USFBtouchdownsPerGame', isPerGame: true, category: 'scoring' }
        ],
        'totalPoints': [{ modelField: 'USFBtotalPoints', category: 'scoring' }],
        'totalPointsPerGame': [{ modelField: 'USFBpointsPerGame', category: 'scoring' }],
        'tacklesForLoss': [
            { modelField: 'USFBtacklesforLoss', category: 'defensive' },
            { modelField: 'USFBtacklesforLossPerGame', isPerGame: true, category: 'defensive' }
        ],
        'interceptions': [{ modelField: 'USFBinterceptions', category: 'defensiveInterceptions' }],
        'avgInterceptionYards': [{ modelField: 'USFByardsPerInterception', category: 'defensive' }],
        'sacks': [
            { modelField: 'USFBsacksTotal', category: 'defensive' },
            { modelField: 'USFBsacksPerGame', isPerGame: true, category: 'defensive' }
        ],
        'sackYards': [
            { modelField: 'USFBsackYards', category: 'defensive' },
            { modelField: 'USFBsackYardsPerGame', isPerGame: true, category: 'defensive' }
        ],
        'stuffs': [
            { modelField: 'USFBstuffs', category: 'defensive' },
            { modelField: 'USFBstuffsPerGame', isPerGame: true, category: 'defensive' }
        ],
        'stuffYards': [{ modelField: 'USFBstuffYards', category: 'defensive' }],
        'passesDefended': [
            { modelField: 'USFBpassesDefended', category: 'defensive' },
            { modelField: 'USFBpassesDefendedPerGame', isPerGame: true, category: 'defensive' }
        ],
        'safeties': [{ modelField: 'USFBsafties', category: 'defensive' }],
        'avgKickoffYards': [
            { modelField: 'USFBaverageKickoffYards', category: 'kicking' },
            { modelField: 'USFBaverageKickoffYardsPerGame', isPerGame: true, category: 'kicking' }
        ],
        'extraPointAttempts': [
            { modelField: 'USFBextraPointAttempts', category: 'kicking' },
            { modelField: 'USFBextraPointAttemptsPerGame', isPerGame: true, category: 'kicking' }
        ],
        'extraPointsMade': [
            { modelField: 'USFBextraPointsMade', category: 'kicking' },
            { modelField: 'USFBextraPointsMadePerGame', isPerGame: true, category: 'kicking' }
        ],
        'extraPointPct': [
            { modelField: 'USFBextraPointPercent', category: 'kicking' },
            { modelField: 'USFBextraPointPercentPerGame', isPerGame: true, category: 'kicking' }
        ],
        'fieldGoalAttempts': [
            { modelField: 'USFBfieldGoalAttempts', category: 'kicking' },
            { modelField: 'USFBfieldGoalAttemptsPerGame', isPerGame: true, category: 'kicking' }
        ],
        'fieldGoalsMade': [
            { modelField: 'USFBfieldGoalsMade', category: 'kicking' },
            { modelField: 'USFBfieldGoalsMadePerGame', isPerGame: true, category: 'kicking' }
        ],
        'fieldGoalPct': [
            { modelField: 'USFBfieldGoalPct', category: 'kicking' },
            { modelField: 'USFBfieldGoalPercentPerGame', isPerGame: true, category: 'kicking' }
        ],
        'touchbacks': [
            { modelField: 'USFBtouchbacks', category: 'kicking' },
            { modelField: 'USFBtouchbacksPerGame', isPerGame: true, category: 'kicking' }
        ],
        'touchbackPct': [{ modelField: 'USFBtouchBackPercentage', category: 'kicking' }],
        'kickReturns': [
            { modelField: 'USFBkickReturns', category: 'returning' },
            { modelField: 'USFBkickReturnsPerGame', isPerGame: true, category: 'returning' }
        ],
        'kickReturnYards': [
            { modelField: 'USFBkickReturnYards', category: 'returning' },
            { modelField: 'USFBkickReturnYardsPerGame', isPerGame: true, category: 'returning' }
        ],
        'puntReturns': [
            { modelField: 'USFBpuntReturns', category: 'returning' },
            { modelField: 'USFBpuntReturnsPerGame', isPerGame: true, category: 'returning' }
        ],
        'puntReturnFairCatchPct': [{ modelField: 'USFBpuntReturnFairCatchPct', category: 'returning' }],
        'puntReturnYards': [
            { modelField: 'USFBpuntReturnYards', category: 'returning' },
            { modelField: 'USFBpuntReturnYardsPerGame', isPerGame: true, category: 'returning' }
        ],
        'yardsPerReturn': [{ modelField: 'USFByardsPerReturn', category: 'returning' }],
        'thirdDownConvPct': [{ modelField: 'USFBthirdDownEfficiency', category: 'miscellaneous' }],
        'totalPenaltyYards': [
            { modelField: 'USFBtotalPenyards', category: 'miscellaneous' },
            { modelField: 'USFBaveragePenYardsPerGame', isPerGame: true, category: 'miscellaneous' }
        ],
        'totalGiveaways': [{ modelField: 'USFBgiveaways', category: 'miscellaneous' }],
        'totalTakeaways': [{ modelField: 'USFBtakeaways', category: 'miscellaneous' }],
        'turnOverDifferential': [{ modelField: 'USFBturnoverDiff', category: 'miscellaneous' }],
        'firstDowns': [{ modelField: 'USFBtotalFirstDowns', category: 'miscellaneous' }],
        //------------------------------------BASKETBALL STATS--------------------------------------------------------------
        'points': [{ modelField: 'BSKBtotalPoints', category: 'offensive' }],
        'avgPoints': [{ modelField: 'BSKBpointsPerGame', category: 'offensive' }],

        'avgAssists': [{ modelField: 'BSKBassistsPerGame', category: 'offensive' }],
        'assistRatio': [{ modelField: 'BSKBassistRatio', category: 'offensive' }],
        'effectiveFGPct': [{ modelField: 'BSKBeffectiveFgPercent', category: 'offensive' }],
        'fieldGoalPct': [{ modelField: 'BSKBfieldGoalPercent', category: 'offensive' }],
        'fieldGoalsAttempted': [{ modelField: 'BSKBfieldGoalsAttempted', category: 'offensive' }],
        'fieldGoalsMade': [{ modelField: 'BSKBfieldGoalsMade', category: 'offensive' }],
        'avgFieldGoalsMade': [{ modelField: 'BSKBfieldGoalsPerGame', category: 'offensive' }],
        'freeThrowPct': [{ modelField: 'BSKBfreeThrowPercent', category: 'offensive' }],
        'freeThrowsAttempted': [{ modelField: 'BSKBfreeThrowsAttempted', category: 'offensive' }],
        'freeThrowsMade': [{ modelField: 'BSKBfreeThrowsMade', category: 'offensive' }],
        'avgFreeThrowsMade': [{ modelField: 'BSKBfreeThrowsMadePerGame', category: 'offensive' }],
        'offensiveRebounds': [{ modelField: 'BSKBoffensiveRebounds', category: 'offensive' }],
        'avgOffensiveRebounds': [{ modelField: 'BSKBoffensiveReboundsPerGame', category: 'offensive' }],
        'offensiveReboundPct': [{ modelField: 'BSKBoffensiveReboundRate', category: 'offensive' }],
        'turnovers': [{ modelField: 'BSKBoffensiveTurnovers', category: 'offensive' }],
        'avgTurnovers': [{ modelField: 'BSKBturnoversPerGame', category: 'offensive' }],
        'turnoverRatio': [{ modelField: 'BSKBturnoverRatio', category: 'offensive' }],
        'turnthreePointPctverRatio': [{ modelField: 'BSKBthreePointPct', category: 'offensive' }],
        'threePointFieldGoalsAttempted': [{ modelField: 'BSKBthreePointsAttempted', category: 'offensive' }],
        'threePointFieldGoalsMade': [{ modelField: 'BSKBthreePointsMade', category: 'offensive' }],
        'trueShootingPct': [{ modelField: 'BSKBtrueShootingPct', category: 'offensive' }],
        'paceFactor': [{ modelField: 'BSKBpace', category: 'offensive' }],
        'pointsInPaint': [{ modelField: 'BSKBpointsInPaint', category: 'offensive' }],
        'shootingEfficiency': [{ modelField: 'BSKBshootingEfficiency', category: 'offensive' }],
        'scoringEfficiency': [{ modelField: 'BSKBscoringEfficiency', category: 'offensive' }],
        'blocks': [{ modelField: 'BSKBblocks', category: 'defensive' }],
        'avgBlocks': [{ modelField: 'BSKBblocksPerGame', category: 'defensive' }],
        'defensiveRebounds': [{ modelField: 'BSKBdefensiveRebounds', category: 'defensive' }],
        'avgDefensiveRebounds': [{ modelField: 'BSKBdefensiveReboundsPerGame', category: 'defensive' }],
        'steals': [{ modelField: 'BSKBsteals', category: 'defensive' }],
        'avgSteals': [{ modelField: 'BSKBstealsPerGame', category: 'defensive' }],
        'reboundRate': [{ modelField: 'BSKBreboundRate', category: 'general' }],
        'avgRebounds': [{ modelField: 'BSKBreboundsPerGame', category: 'general' }],
        'avgFouls': [{ modelField: 'BSKBfoulsPerGame', category: 'general' }],
        'teamAssistTurnoverRatio': [{ modelField: 'BSKBteamAssistToTurnoverRatio', category: 'general' }],
        //------------------------------------HOCKEY STATS--------------------------------------------------------------
        'goals': [{ modelField: 'HKYgoals', category: 'offensive' }],
        'avgGoals': [{ modelField: 'HKYgoalsPerGame', category: 'offensive' }],
        'shotsIn1stPeriod': [
            { modelField: 'HKYshotsIn1st', category: 'offensive' },
            { modelField: 'HKYshotsIn1stPerGame', isPerGame: true, category: 'offensive' }
        ],
        'shotsIn2ndPeriod': [
            { modelField: 'HKYshotsIn2nd', category: 'offensive' },
            { modelField: 'HKYshotsIn2ndPerGame', isPerGame: true, category: 'offensive' }
        ],
        'shotsIn3rdPeriod': [
            { modelField: 'HKYshotsIn3rd', category: 'offensive' },
            { modelField: 'HKYshotsIn3rdPerGame', isPerGame: true, category: 'offensive' }
        ],
        'shotsTotal': [
            { modelField: 'HKYtotalShots', category: 'offensive' },
        ],
        'avgShots': [
            { modelField: 'HKYtotalShotsPerGame', category: 'offensive' },
        ],
        'shotsMissed': [
            { modelField: 'HKYshotsMissed', category: 'offensive' },
            { modelField: 'HKYshotsMissedPerGame', isPerGame: true, category: 'offensive' }
        ],
        'powerPlayGoals': [
            { modelField: 'HKYppgGoals', category: 'offensive' },
            { modelField: 'HKYppgGoalsPerGame', isPerGame: true, category: 'offensive' }
        ],
        'powerPlayAssists': [
            { modelField: 'HKYppassists', category: 'offensive' },
            { modelField: 'HKYppassistsPerGame', isPerGame: true, category: 'offensive' }
        ],
        'powerPlayPct': [
            { modelField: 'HKYpowerplayPct', category: 'offensive' },
        ],
        'shortHandedGoals': [
            { modelField: 'HKYshortHandedGoals', category: 'offensive' },
            { modelField: 'HKYshortHandedGoalsPerGame', isPerGame: true, category: 'offensive' }
        ],
        'shootingPct': [
            { modelField: 'HKYshootingPct', category: 'offensive' },
        ],
        'totalFaceOffs': [
            { modelField: 'HKYfaceoffs', category: 'offensive' },
            { modelField: 'HKYfaceoffsPerGame', isPerGame: true, category: 'offensive' }
        ],
        'faceoffsWon': [
            { modelField: 'HKYfaceoffsWon', category: 'offensive' },
            { modelField: 'HKYfaceoffsWonPerGame', isPerGame: true, category: 'offensive' }
        ],
        'faceoffsLost': [
            { modelField: 'HKYfaceoffsLost', category: 'offensive' },
            { modelField: 'HKYfaceoffsLostPerGame', isPerGame: true, category: 'offensive' }
        ],
        'faceoffPercent': [
            { modelField: 'HKYfaceoffPct', category: 'offensive' },
            { modelField: 'HKYfaceoffPctPerGame', isPerGame: true, category: 'offensive' }
        ],
        'giveaways': [
            { modelField: 'HKYgiveaways', category: 'offensive' },
        ],
        'goalsAgainst': [
            { modelField: 'HKYgoalsAgainst', category: 'defensive' },
        ],
        'avgGoalsAgainst': [
            { modelField: 'HKYgoalsAgainstPerGame', category: 'defensive' },
        ],
        'shotsAgainst': [
            { modelField: 'HKYshotsAgainst', category: 'defensive' },
        ],
        'avgShotsAgainst': [
            { modelField: 'HKYshotsAgainstPerGame', category: 'defensive' },
        ],
        'penaltyKillPct': [
            { modelField: 'HKYpenaltyKillPct', category: 'defensive' },
            { modelField: 'HKYpenaltyKillPctPerGame', isPerGame: true, category: 'defensive' }
        ],
        'powerPlayGoalsAgainst': [
            { modelField: 'HKYppGoalsAgainst', category: 'defensive' },
            { modelField: 'HKYppGoalsAgainstPerGame', isPerGame: true, category: 'defensive' }
        ],

        'blockedShots': [
            { modelField: 'HKYblockedShots', category: 'defensive' },
            { modelField: 'HKYblockedShotsPerGame', isPerGame: true, category: 'defensive' }
        ],
        'takeaways': [
            { modelField: 'HKYtakeaways', category: 'defensive' },
            { modelField: 'HKYtakeawaysPerGame', isPerGame: true, category: 'defensive' }
        ],
        'shotDifferential': [
            { modelField: 'HKYshotDifferential', category: 'general' },
            { modelField: 'HKYshotDifferentialPerGame', isPerGame: true, category: 'general' }
        ],
        'goalDifferential': [
            { modelField: 'HKYgoalDifferentialPerGame', isPerGame: true, category: 'general' },
        ],
        'PIMDifferential': [
            { modelField: 'HKYpimDifferential', category: 'general' },
            { modelField: 'HKYpimDifferentialPerGame', isPerGame: true, category: 'general' }
        ],
        'penalties': [
            { modelField: 'HKYtotalPenalties', category: 'penalties' },
            { modelField: 'HKYpenaltiesPerGame', isPerGame: true, category: 'penalties' }
        ],
        'penaltyMinutes': [
            { modelField: 'HKYpenaltyMinutes', category: 'penalties' },
            { modelField: 'HKYpenaltyMinutesPerGame', isPerGame: true, category: 'penalties' }
        ],
        //------------------------------------BASEBALL STATS--------------------------------------------------------------
        'strikeouts': [
            { modelField: 'BSBbattingStrikeouts', category: 'batting' },
            { modelField: 'BSBpitcherStrikeouts', category: 'pitching' }
        ],
        'walks': [
            { modelField: 'BSBwalks', category: 'batting' },
            { modelField: 'BSBbattersWalked', category: 'pitching' }
        ],
        'RBIs': [{ modelField: 'BSBrunsBattedIn', category: 'batting' }],
        'sacHits': [{ modelField: 'BSBsacrificeHits', category: 'batting' }],
        'runs': [
            { modelField: 'BSBruns', category: 'batting' },
            { modelField: 'BSBrunsAllowed', category: 'pitching' }
        ],
        'homeRuns': [
            { modelField: 'BSBhomeRuns', category: 'batting' },
            { modelField: 'BSBhomeRunsAllowed', category: 'pitching' }
        ],
        'doubles': [{ modelField: 'BSBdoubles', category: 'batting' }],
        'totalBases': [{ modelField: 'BSBtotalBases', category: 'batting' }],
        'extraBaseHits': [{ modelField: 'BSBextraBaseHits', category: 'batting' }],
        'avg': [{ modelField: 'BSBbattingAverage', category: 'batting' }],
        'slugAvg': [{ modelField: 'BSBsluggingPercentage', category: 'batting' }],
        'onBasePct': [{ modelField: 'BSBonBasePercentage', category: 'batting' }],
        'OPS': [{ modelField: 'BSBonBasePlusSlugging', category: 'batting' }],
        'groundToFlyRatio': [{ modelField: 'BSBgroundToFlyRatio', category: 'batting' }],
        'atBatsPerHomeRun': [{ modelField: 'BSBatBatsPerHomeRun', category: 'batting' }],
        'stolenBasePct': [{ modelField: 'BSBstolenBasePercentage', category: 'batting' }],
        'walkToStrikeoutRatio': [{ modelField: 'BSBbatterWalkToStrikeoutRatio', category: 'batting' }],
        'earnedRuns': [{ modelField: 'BSBearnedRuns', category: 'pitching' }],
        'wins': [{ modelField: 'BSBwins', category: 'pitching' }],
        'ERA': [{ modelField: 'BSBearnedRunAverage', category: 'pitching' }],
        'WHIP': [{ modelField: 'BSBwalksHitsPerInningPitched', category: 'pitching' }],
        'winPct': [{ modelField: 'BSBwinPct', category: 'pitching' }],
        'caughtStealingPct': [{ modelField: 'BSBpitcherCaughtStealingPct', category: 'pitching' }],
        'pitchesPerInning': [{ modelField: 'BSBpitchesPerInning', category: 'pitching' }],
        'runSupportAvg': [{ modelField: 'BSBrunSupportAverage', category: 'pitching' }],
        'opponentAvg': [{ modelField: 'BSBopponentBattingAverage', category: 'pitching' }],
        'opponentSlugAvg': [{ modelField: 'BSBopponentSlugAverage', category: 'pitching' }],
        'opponentOnBasePct': [{ modelField: 'BSBopponentOnBasePct', category: 'pitching' }],
        'opponentOPS': [{ modelField: 'BSBopponentOnBasePlusSlugging', category: 'pitching' }],
        'strikeoutsPerNineInnings': [{ modelField: 'BSBstrikeoutsPerNine', category: 'pitching' }],
        'strikeoutToWalkRatio': [{ modelField: 'BSBpitcherStrikeoutToWalkRatio', category: 'pitching' }],
        'doublePlays': [{ modelField: 'BSBdoublePlays', category: 'fielding' }],
        'errors': [{ modelField: 'BSBerrors', category: 'fielding' }],
        'passedBalls': [{ modelField: 'BSBpassedBalls', category: 'fielding' }],
        'putouts': [{ modelField: 'BSBputouts', category: 'fielding' }],
        'catcherCaughtStealing': [{ modelField: 'BSBcatcherCaughtStealing', category: 'fielding' }],
        'catcherCaughtStealingPct': [{ modelField: 'BSBcatcherCaughtStealingPct', category: 'fielding' }],
        'catcherStolenBasesAllowed': [{ modelField: 'BSBcatcherStolenBasesAllowed', category: 'fielding' }],
        'fieldingPct': [{ modelField: 'BSBfieldingPercentage', category: 'fielding' }],
        'rangeFactor': [{ modelField: 'BSBrangeFactor', category: 'fielding' }],
    }


    if (statMap[statName]) {
        // Loop through all mappings for this stat (in case there are multiple)
        for (const statInfo of statMap[statName]) {
            // Ensure the stats object exists
            team.stats = team.stats || {};

            // Check if the category matches
            if (statInfo.category === category) {
                const statKey = statInfo.modelField;

                // If it's a per-game stat, update with perGameValue
                if (statInfo.isPerGame || statInfo.isDisplayValue) {
                    statInfo.isDisplayValue ? team.stats[statKey] = displayValue : 0
                    statInfo.isPerGame ? team.stats[statKey] = perGameValue : 0;
                } else {
                    // If it's not a per-game stat, store the regular value
                    team.stats[statKey] = value;
                }
            }
        }
    }

    return team;
};

const upsertTeamsInBulk = async (teams, sport, TeamModel) => {

    const bulkOps = teams.map(team => {
        // Create a new object without the _id field
        const { _id, ...teamWithoutId } = team;

        if (sport.league === team.league) {
            return {
                updateOne: {
                    filter: {
                        'espnID': team.espnID, // Unique to the team
                        'league': sport.league, // Ensures uniqueness within the league
                    },
                    update: { $set: teamWithoutId }, // Ensure you're not updating _id
                    upsert: true,
                }
            };
        }

        return null

    }).filter(operation => operation !== null);

    if (bulkOps.length > 0) {
        try {
            await TeamModel.bulkWrite(bulkOps);
        } catch (err) {
            console.log(err)
        }

    }
};

const fetchAllTeamData = async (sport, teams, statYear, TeamModel) => {

    const fetchTeamData = async (team, sport) => {
        try {
            // Fetch team record
            const teamRecordUrl = getTeamRecordUrl(moment().format('M'), sport.startMonth, sport.endMonth, sport.espnSport, sport.league, sport.statYear, team.espnID);
            const teamRecordResponse = await fetch(teamRecordUrl);
            const teamRecordJson = await teamRecordResponse.json();
            updateTeamRecord(team, teamRecordJson);

            // Fetch team stats
            const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/seasons/${statYear}/types/2/teams/${team.espnID}/statistics?lang=en&region=us`);
            const teamStatJson = await teamStatResponse.json();
            if (teamStatJson.splits) {
                for (const category of teamStatJson.splits.categories) {
                    for (const stat of category.stats) {
                        team = updateTeamStats(team, stat.name, stat.value, stat.perGameValue, stat.displayValue, category.name);
                    }
                }
            }
            let pastTeamGames = await PastGameOdds.find({
                $or: [
                    { home_team: team.espnDisplayName },
                    { away_team: team.espnDisplayName }
                ]
            }).sort({ commence_time: -1 })
            team.lastFiveGames = []



            pastTeamGames.map((game, idx) => {
                if (idx <= 4) {
                    team.lastFiveGames[idx] = {
                        id: game.id,
                        commence_time: game.commence_time,
                        home_team: game.home_team,
                        away_team: game.away_team,
                        homeTeamIndex: game.homeTeamIndex,
                        awayTeamIndex: game.awayTeamIndex,
                        homeTeamLogo: game.homeTeamLogo,
                        awayTeamLogo: game.awayTeamLogo,
                        homeTeamAbbr: game.homeTeamAbbr,
                        awayTeamAbbr: game.awayTeamAbbr,
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        winner: game.winner,
                        predictedWinner: game.predictedWinner
                    }
                }

            })
            return team;  // Return the updated team
        } catch (error) {
            console.log(`Error fetching data for team ${team.espnID}:`, error);
        }
    };

    const MAX_CONCURRENT_REQUESTS = 30; // You can adjust this number to control concurrency
    const promises = [];

    try {
        // Loop through each team and fetch their data
        for (let team of teams) {
            promises.push(fetchTeamData(team, sport).then(updatedTeam => {
                if (updatedTeam) {
                    return updatedTeam; // Add the updated team to the result
                }
            }));
            // If we reach the maximum number of concurrent requests, wait for them to resolve
            if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                // Wait for all current promises to resolve
                const results = await Promise.all(promises);
                // Filter out any undefined results (in case some fetches failed)
                const filteredResults = results.filter(result => result !== undefined);
                // Upsert the fetched team data in bulk
                await upsertTeamsInBulk(filteredResults, sport, TeamModel);
                promises.length = 0; // Clear the array after waiting for requests to resolve
            }
        }
        // After all requests have been processed, make sure to upsert the remaining teams
        if (promises.length > 0) {
            const results = await Promise.all(promises);
            const filteredResults = results.filter(result => result !== undefined);
            await upsertTeamsInBulk(filteredResults, sport, TeamModel);
        }

    } catch (error) {
        console.error("Error fetching or processing team data:", error);
    }
};

const retrieveTeamsandStats = async (sports) => {

    for (let sport of sports) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12
        const sportGames = await Odds.find({sport_key: sport.name})
        if (sportGames.length > 0) {


            console.log(`STARTING ${sport.name} TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
            let TeamModel;
            let sportArr = sport.name.split('_')
            let leagueAbbr = sportArr[1]
            switch (sport.espnSport) {
                case 'football':
                    TeamModel = UsaFootballTeam;
                    break;
                case 'basketball':
                    TeamModel = BasketballTeam;
                    break;
                case 'hockey':
                    TeamModel = HockeyTeam;
                    break;
                case 'baseball':
                    TeamModel = BaseballTeam;
                    break;
                default:
                    console.error("Unsupported sport:", sport.espnSport);
                    return;
            }
            let teams
            teams = await TeamModel.find({league: leagueAbbr})
            // Helper function to get the team record URL based on the current month

            await fetchAllTeamData(sport, teams, sport.statYear, TeamModel)
            console.log(`Finished ${sport.name} TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
            teams = []
        }
    }

    console.log(`Finished TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
}
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

module.exports = { retrieveTeamsandStats, getCommonStats, cleanStats }