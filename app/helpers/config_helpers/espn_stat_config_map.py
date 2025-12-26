statMap = {
    # 'statinapi : [{modelField: 'fieldindb'}, category: 'categoryinDb']
    "baseball": {
        # ------------------------------------BASEBALL STATS--------------------------------------------------------------
        'strikeouts': [
            { "modelField": 'BSBbattingStrikeouts', "category": 'batting' },
            { "modelField": 'BSBpitcherStrikeouts', "category": 'pitching' }
        ],
        'walks': [
            { "modelField": 'BSBwalks', "category": 'batting' },
            { "modelField": 'BSBbattersWalked', "category": 'pitching' }
        ],
        'RBIs': [{ "modelField": 'BSBrunsBattedIn', "category": 'batting' }],
        'sacHits': [{ "modelField": 'BSBsacrificeHits', "category": 'batting' }],
        'runs': [
            { "modelField": 'BSBruns', "category": 'batting' },
            { "modelField": 'BSBrunsAllowed', "category": 'pitching' }
        ],
        'homeRuns': [
            { "modelField": 'BSBhomeRuns', "category": 'batting' },
            { "modelField": 'BSBhomeRunsAllowed', "category": 'pitching' }
        ],
        'doubles': [{ "modelField": 'BSBdoubles', "category": 'batting' }],
        'totalBases': [{ "modelField": 'BSBtotalBases', "category": 'batting' }],
        'extraBaseHits': [{ "modelField": 'BSBextraBaseHits', "category": 'batting' }],
        'avg': [{ "modelField": 'BSBbattingAverage', "category": 'batting' }],
        'slugAvg': [{ "modelField": 'BSBsluggingPercentage', "category": 'batting' }],
        'onBasePct': [{ "modelField": 'BSBonBasePercentage', "category": 'batting' }],
        'OPS': [{ "modelField": 'BSBonBasePlusSlugging', "category": 'batting' }],
        'groundToFlyRatio': [{ "modelField": 'BSBgroundToFlyRatio', "category": 'batting' }],
        'atBatsPerHomeRun': [{ "modelField": 'BSBatBatsPerHomeRun', "category": 'batting' }],
        'stolenBasePct': [{ "modelField": 'BSBstolenBasePercentage', "category": 'batting' }],
        'walkToStrikeoutRatio': [{ "modelField": 'BSBbatterWalkToStrikeoutRatio', "category": 'batting' }],
        'earnedRuns': [{ "modelField": 'BSBearnedRuns', "category": 'pitching' }],
        'wins': [{ "modelField": 'BSBwins', "category": 'pitching' }],
        'ERA': [{ "modelField": 'BSBearnedRunAverage', "category": 'pitching' }],
        'WHIP': [{ "modelField": 'BSBwalksHitsPerInningPitched', "category": 'pitching' }],
        'winPct': [{ "modelField": 'BSBwinPct', "category": 'pitching' }],
        'caughtStealingPct': [{ "modelField": 'BSBpitcherCaughtStealingPct', "category": 'pitching' }],
        'pitchesPerInning': [{ "modelField": 'BSBpitchesPerInning', "category": 'pitching' }],
        'runSupportAvg': [{ "modelField": 'BSBrunSupportAverage', "category": 'pitching' }],
        'opponentAvg': [{ "modelField": 'BSBopponentBattingAverage', "category": 'pitching' }],
        'opponentSlugAvg': [{ "modelField": 'BSBopponentSlugAverage', "category": 'pitching' }],
        'opponentOnBasePct': [{ "modelField": 'BSBopponentOnBasePct', "category": 'pitching' }],
        'opponentOPS': [{ "modelField": 'BSBopponentOnBasePlusSlugging', "category": 'pitching' }],
        'strikeoutsPerNineInnings': [{ "modelField": 'BSBstrikeoutsPerNine', "category": 'pitching' }],
        'strikeoutToWalkRatio': [{ "modelField": 'BSBpitcherStrikeoutToWalkRatio', "category": 'pitching' }],
        'doublePlays': [{ "modelField": 'BSBdoublePlays', "category": 'fielding' }],
        'errors': [{ "modelField": 'BSBerrors', "category": 'fielding' }],
        'passedBalls': [{ "modelField": 'BSBpassedBalls', "category": 'fielding' }],
        'putouts': [{ "modelField": 'BSBputouts', "category": 'fielding' }],
        'catcherCaughtStealing': [{ "modelField": 'BSBcatcherCaughtStealing', "category": 'fielding' }],
        'catcherCaughtStealingPct': [{ "modelField": 'BSBcatcherCaughtStealingPct', "category": 'fielding' }],
        'catcherStolenBasesAllowed': [{ "modelField": 'BSBcatcherStolenBasesAllowed', "category": 'fielding' }],
        'fieldingPct': [{ "modelField": 'BSBfieldingPercentage', "category": 'fielding' }],
        'rangeFactor': [{ "modelField": 'BSBrangeFactor', "category": 'fielding' }],
        'assists': [{ "modelField": 'BSBassists', "category": 'fielding' }],
        'hits': [
            { "modelField": 'BSBHitsTotal', "category": 'batting' },
            { "modelField": 'BSBhitsGivenUp', "category": 'pitching' },
        ],
        'shutouts': [{ "modelField": 'BSBshutouts', "category": 'pitching' }],
        'saves': [{ "modelField": 'BSBsaves', "category": 'pitching' }],
        'savePct': [{ "modelField": 'BSBsavePct', "category": 'pitching' }],
    },
    'basketball': {
        # ------------------------------------BASKETBALL STATS--------------------------------------------------------------
        'points': [{ "modelField": 'BSKBtotalPoints', "category": 'offensive' }],
        'avgPoints': [{ "modelField": 'BSKBpointsPerGame', "category": 'offensive' }],

        'avgAssists': [{ "modelField": 'BSKBassistsPerGame', "category": 'offensive' }],
        'assistRatio': [{ "modelField": 'BSKBassistRatio', "category": 'offensive' }],
        'effectiveFGPct': [{ "modelField": 'BSKBeffectiveFgPercent', "category": 'offensive' }],
        'fieldGoalPct': [{ "modelField": 'BSKBfieldGoalPercent', "category": 'offensive' }],
        'fieldGoalsAttempted': [{ "modelField": 'BSKBfieldGoalsAttempted', "category": 'offensive' }],
        'fieldGoalsMade': [{ "modelField": 'BSKBfieldGoalsMade', "category": 'offensive' }],
        'avgFieldGoalsMade': [{ "modelField": 'BSKBfieldGoalsPerGame', "category": 'offensive' }],
        'freeThrowPct': [{ "modelField": 'BSKBfreeThrowPercent', "category": 'offensive' }],
        'freeThrowsAttempted': [{ "modelField": 'BSKBfreeThrowsAttempted', "category": 'offensive' }],
        'freeThrowsMade': [{ "modelField": 'BSKBfreeThrowsMade', "category": 'offensive' }],
        'avgFreeThrowsMade': [{ "modelField": 'BSKBfreeThrowsMadePerGame', "category": 'offensive' }],
        'offensiveRebounds': [{ "modelField": 'BSKBoffensiveRebounds', "category": 'offensive' }],
        'avgOffensiveRebounds': [{ "modelField": 'BSKBoffensiveReboundsPerGame', "category": 'offensive' }],
        'offensiveReboundPct': [{ "modelField": 'BSKBoffensiveReboundRate', "category": 'offensive' }],
        'turnovers': [{ "modelField": 'BSKBoffensiveTurnovers', "category": 'offensive' }],
        'avgTurnovers': [{ "modelField": 'BSKBturnoversPerGame', "category": 'offensive' }],
        'turnoverRatio': [{ "modelField": 'BSKBturnoverRatio', "category": 'offensive' }],
        'turnthreePointPctverRatio': [{ "modelField": 'BSKBthreePointPct', "category": 'offensive' }],
        'threePointFieldGoalsAttempted': [{ "modelField": 'BSKBthreePointsAttempted', "category": 'offensive' }],
        'threePointFieldGoalsMade': [{ "modelField": 'BSKBthreePointsMade', "category": 'offensive' }],
        'TrueShootingPct': [{ "modelField": 'BSKBTrueShootingPct', "category": 'offensive' }],
        'paceFactor': [{ "modelField": 'BSKBpace', "category": 'offensive' }],
        'pointsInPaint': [{ "modelField": 'BSKBpointsInPaint', "category": 'offensive' }],
        'shootingEfficiency': [{ "modelField": 'BSKBshootingEfficiency', "category": 'offensive' }],
        'scoringEfficiency': [{ "modelField": 'BSKBscoringEfficiency', "category": 'offensive' }],
        'blocks': [{ "modelField": 'BSKBblocks', "category": 'defensive' }],
        'avgBlocks': [{ "modelField": 'BSKBblocksPerGame', "category": 'defensive' }],
        'defensiveRebounds': [{ "modelField": 'BSKBdefensiveRebounds', "category": 'defensive' }],
        'avgDefensiveRebounds': [{ "modelField": 'BSKBdefensiveReboundsPerGame', "category": 'defensive' }],
        'steals': [{ "modelField": 'BSKBsteals', "category": 'defensive' }],
        'avgSteals': [{ "modelField": 'BSKBstealsPerGame', "category": 'defensive' }],
        'reboundRate': [{ "modelField": 'BSKBreboundRate', "category": 'general' }],
        'avgRebounds': [{ "modelField": 'BSKBreboundsPerGame', "category": 'general' }],
        'avgFouls': [{ "modelField": 'BSKBfoulsPerGame', "category": 'general' }],
        'teamAssistTurnoverRatio': [{ "modelField": 'BSKBteamAssistToTurnoverRatio', "category": 'general' }],
        'assists': [{ "modelField": 'BSKBassists', "category": 'offensive' }]
    },
    "hockey": {
        # ------------------------------------HOCKEY STATS--------------------------------------------------------------
        'goals': [{ "modelField": 'HKYgoals', "category": 'offensive' }],
        'avgGoals': [{ "modelField": 'HKYgoalsPerGame', "category": 'offensive' }],
        'shotsIn1stPeriod': [
            { "modelField": 'HKYshotsIn1st', "category": 'offensive' },
            { "modelField": 'HKYshotsIn1stPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'shotsIn2ndPeriod': [
            { "modelField": 'HKYshotsIn2nd', "category": 'offensive' },
            { "modelField": 'HKYshotsIn2ndPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'shotsIn3rdPeriod': [
            { "modelField": 'HKYshotsIn3rd', "category": 'offensive' },
            { "modelField": 'HKYshotsIn3rdPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'shotsTotal': [
            { "modelField": 'HKYtotalShots', "category": 'offensive' },
        ],
        'avgShots': [
            { "modelField": 'HKYtotalShotsPerGame', "category": 'offensive' },
        ],
        'shotsMissed': [
            { "modelField": 'HKYshotsMissed', "category": 'offensive' },
            { "modelField": 'HKYshotsMissedPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'powerPlayGoals': [
            { "modelField": 'HKYppgGoals', "category": 'offensive' },
            { "modelField": 'HKYppgGoalsPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'powerPlayAssists': [
            { "modelField": 'HKYppassists', "category": 'offensive' },
            { "modelField": 'HKYppassistsPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'powerPlayPct': [
            { "modelField": 'HKYpowerplayPct', "category": 'offensive' },
        ],
        'shortHandedGoals': [
            { "modelField": 'HKYshortHandedGoals', "category": 'offensive' },
            { "modelField": 'HKYshortHandedGoalsPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'shootingPct': [
            { "modelField": 'HKYshootingPct', "category": 'offensive' },
        ],
        'totalFaceOffs': [
            { "modelField": 'HKYfaceoffs', "category": 'offensive' },
            { "modelField": 'HKYfaceoffsPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'faceoffsWon': [
            { "modelField": 'HKYfaceoffsWon', "category": 'offensive' },
            { "modelField": 'HKYfaceoffsWonPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'faceoffsLost': [
            { "modelField": 'HKYfaceoffsLost', "category": 'offensive' },
            { "modelField": 'HKYfaceoffsLostPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'faceoffPercent': [
            { "modelField": 'HKYfaceoffPct', "category": 'offensive' },
            { "modelField": 'HKYfaceoffPctPerGame', "isPerGame": True, "category": 'offensive' }
        ],
        'giveaways': [
            { "modelField": 'HKYgiveaways', "category": 'offensive' },
        ],
        'goalsAgainst': [
            { "modelField": 'HKYgoalsAgainst', "category": 'defensive' },
        ],
        'avgGoalsAgainst': [
            { "modelField": 'HKYgoalsAgainstPerGame', "category": 'defensive' },
        ],
        'shotsAgainst': [
            { "modelField": 'HKYshotsAgainst', "category": 'defensive' },
        ],
        'avgShotsAgainst': [
            { "modelField": 'HKYshotsAgainstPerGame', "category": 'defensive' },
        ],
        'penaltyKillPct': [
            { "modelField": 'HKYpenaltyKillPct', "category": 'defensive' },
            { "modelField": 'HKYpenaltyKillPctPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'powerPlayGoalsAgainst': [
            { "modelField": 'HKYppGoalsAgainst', "category": 'defensive' },
            { "modelField": 'HKYppGoalsAgainstPerGame', "isPerGame": True, "category": 'defensive' }
        ],

        'blockedShots': [
            { "modelField": 'HKYblockedShots', "category": 'defensive' },
            { "modelField": 'HKYblockedShotsPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'takeaways': [
            { "modelField": 'HKYtakeaways', "category": 'defensive' },
            { "modelField": 'HKYtakeawaysPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'shotDifferential': [
            { "modelField": 'HKYshotDifferential', "category": 'general' },
            { "modelField": 'HKYshotDifferentialPerGame', "isPerGame": True, "category": 'general' }
        ],
        'goalDifferential': [
            { "modelField": 'HKYgoalDifferentialPerGame', "isPerGame": True, "category": 'general' },
        ],
        'PIMDifferential': [
            { "modelField": 'HKYpimDifferential', "category": 'general' },
            { "modelField": 'HKYpimDifferentialPerGame', "isPerGame": True, "category": 'general' }
        ],
        'penalties': [
            { "modelField": 'HKYtotalPenalties', "category": 'penalties' },
            { "modelField": 'HKYpenaltiesPerGame', "isPerGame": True, "category": 'penalties' }
        ],
        'penaltyMinutes': [
            { "modelField": 'HKYpenaltyMinutes', "category": 'penalties' },
            { "modelField": 'HKYpenaltyMinutesPerGame', "isPerGame": True, "category": 'penalties' }
        ],
        'assists': [   
            { "modelField": 'HKYassists', "category": 'offensive' },
            { "modelField": 'HKYassistsPerGame', "isPerGame": True, "category": 'offensive' },
        ],
        'hits': [
            { "modelField": 'HKYhits', "category": 'defensive' },
            { "modelField": 'HKYhitsPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'shutouts': [{ "modelField": 'HKYshutouts', "category": 'defensive' },],
        'saves': [
            { "modelField": 'HKYsaves', "category": 'defensive' },
            { "modelField": 'HKYsavesPerGame', "isPerGame": True, "category": 'defensive' },
        ],
        'savepct': [{ "modelField": 'HKYsavePct', "category": 'defensive' },],
    },
    'football': {
        # -------------------------------AMERICAN FOOTBALL STATS---------------------------------------------
        'completionPct': [{ "modelField": 'USFBcompletionPercent', "category": 'passing' }],
        'completions': [
            { "modelField": 'USFBcompletions', "category": 'passing' },
            { "modelField": 'USFBcompletionsPerGame', "isPerGame": True, "category": 'passing' }],
        'netPassingYards': [
            { "modelField": 'USFBnetPassingYards', "category": 'passing' },
            { "modelField": 'USFBnetPassingYardsPerGame', "isPerGame": True, "category": 'passing' }
        ],
        'passingFirstDowns': [{ "modelField": 'USFBpassingFirstDowns', "category": 'passing' }],
        'passingTouchdowns': [{ "modelField": 'USFBpassingTouchdowns', "category": 'passing' }],
        'passingYards': [
            { "modelField": 'USFBpassingYards', "category": 'passing' },
            { "modelField": 'USFBPassingYardsPerGame', "isPerGame": True, "category": 'passing' }
        ],
        'passingAttempts': [
            { "modelField": 'USFBpassingAttempts', "category": 'passing' },
            { "modelField": 'USFBpassingAttemptsPerGame', "isPerGame": True, "category": 'passing' }
        ],
        'yardsPerPassAttempt': [{ "modelField": 'USFByardsPerPassAttempt', "category": 'passing' }],
        'rushingAttempts': [{ "modelField": 'USFBrushingAttempts', "category": 'rushing' }],
        'rushingFirstDowns': [{ "modelField": 'USFBrushingFirstDowns', "category": 'rushing' }],
        'rushingTouchdowns': [{ "modelField": 'USFBrushingTouchdowns', "category": 'rushing' }],
        'rushingYards': [
            { "modelField": 'USFBrushingYards', "category": 'rushing' },
            { "modelField": 'USFBrushingYardsPerGame', "isPerGame": True, "category": 'rushing' }
        ],
        'yardsPerRushAttempt': [{ "modelField": 'USFByardsPerRushAttempt', "category": 'rushing' }],
        'receivingFirstDowns': [{ "modelField": 'USFBreceivingFirstDowns', "category": 'receiving' }],
        'receivingTouchdowns': [{ "modelField": 'USFBreceivingTouchdowns', "category": 'receiving' }],
        'receivingYards': [
            { "modelField": 'USFBreceivingYards', "category": 'receiving' },
            { "modelField": 'USFBreceivingYardsPerGame', "category": 'receiving' }
        ],
        'yardsPerReception': [{ "modelField": 'USFBreceivingYardsPerReception', "category": 'receiving' }],
        'receivingYardsAfterCatch': [
            { "modelField": 'USFBreceivingYardsAfterCatch', "category": 'receiving' },
            { "modelField": 'USFBreceivingYardsAfterCatchPerGame', "category": 'receiving' }
        ],
        'totalTouchdowns': [
            { "modelField": 'USFBtotalTouchdowns', "category": 'scoring' },
            { "modelField": 'USFBtouchdownsPerGame', "isPerGame": True, "category": 'scoring' }
        ],
        'totalPoints': [{ "modelField": 'USFBtotalPoints', "category": 'scoring' }],
        'totalPointsPerGame': [{ "modelField": 'USFBpointsPerGame', "category": 'scoring' }],
        'tacklesForLoss': [
            { "modelField": 'USFBtacklesforLoss', "category": 'defensive' },
            { "modelField": 'USFBtacklesforLossPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'interceptions': [{ "modelField": 'USFBinterceptions', "category": 'defensiveInterceptions' }],
        'avgInterceptionYards': [{ "modelField": 'USFByardsPerInterception', "category": 'defensive' }],
        'sacks': [
            { "modelField": 'USFBsacksTotal', "category": 'defensive' },
            { "modelField": 'USFBsacksPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'sackYards': [
            { "modelField": 'USFBsackYards', "category": 'defensive' },
            { "modelField": 'USFBsackYardsPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'stuffs': [
            { "modelField": 'USFBstuffs', "category": 'defensive' },
            { "modelField": 'USFBstuffsPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'stuffYards': [{ "modelField": 'USFBstuffYards', "category": 'defensive' }],
        'passesDefended': [
            { "modelField": 'USFBpassesDefended', "category": 'defensive' },
            { "modelField": 'USFBpassesDefendedPerGame', "isPerGame": True, "category": 'defensive' }
        ],
        'safeties': [{ "modelField": 'USFBsafties', "category": 'defensive' }],
        'avgKickoffYards': [
            { "modelField": 'USFBaverageKickoffYards', "category": 'kicking' },
            { "modelField": 'USFBaverageKickoffYardsPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'extraPointAttempts': [
            { "modelField": 'USFBextraPointAttempts', "category": 'kicking' },
            { "modelField": 'USFBextraPointAttemptsPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'extraPointsMade': [
            { "modelField": 'USFBextraPointsMade', "category": 'kicking' },
            { "modelField": 'USFBextraPointsMadePerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'extraPointPct': [
            { "modelField": 'USFBextraPointPercent', "category": 'kicking' },
            { "modelField": 'USFBextraPointPercentPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'fieldGoalAttempts': [
            { "modelField": 'USFBfieldGoalAttempts', "category": 'kicking' },
            { "modelField": 'USFBfieldGoalAttemptsPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'fieldGoalsMade': [
            { "modelField": 'USFBfieldGoalsMade', "category": 'kicking' },
            { "modelField": 'USFBfieldGoalsMadePerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'fieldGoalPct': [
            { "modelField": 'USFBfieldGoalPct', "category": 'kicking' },
            { "modelField": 'USFBfieldGoalPercentPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'touchbacks': [
            { "modelField": 'USFBtouchbacks', "category": 'kicking' },
            { "modelField": 'USFBtouchbacksPerGame', "isPerGame": True, "category": 'kicking' }
        ],
        'touchbackPct': [{ "modelField": 'USFBtouchBackPercentage', "category": 'kicking' }],
        'kickReturns': [
            { "modelField": 'USFBkickReturns', "category": 'returning' },
            { "modelField": 'USFBkickReturnsPerGame', "isPerGame": True, "category": 'returning' }
        ],
        'kickReturnYards': [
            { "modelField": 'USFBkickReturnYards', "category": 'returning' },
            { "modelField": 'USFBkickReturnYardsPerGame', "isPerGame": True, "category": 'returning' }
        ],
        'puntReturns': [
            { "modelField": 'USFBpuntReturns', "category": 'returning' },
            { "modelField": 'USFBpuntReturnsPerGame', "isPerGame": True, "category": 'returning' }
        ],
        'puntReturnFairCatchPct': [{ "modelField": 'USFBpuntReturnFairCatchPct', "category": 'returning' }],
        'puntReturnYards': [
            { "modelField": 'USFBpuntReturnYards', "category": 'returning' },
            { "modelField": 'USFBpuntReturnYardsPerGame', "isPerGame": True, "category": 'returning' }
        ],
        'yardsPerReturn': [{ "modelField": 'USFByardsPerReturn', "category": 'returning' }],
        'thirdDownConvPct': [{ "modelField": 'USFBthirdDownEfficiency', "category": 'miscellaneous' }],
        'totalPenaltyYards': [
            { "modelField": 'USFBtotalPenyards', "category": 'miscellaneous' },
            { "modelField": 'USFBaveragePenYardsPerGame', "isPerGame": True, "category": 'miscellaneous' }
        ],
        'totalGiveaways': [{ "modelField": 'USFBgiveaways', "category": 'miscellaneous' }],
        'totalTakeaways': [{ "modelField": 'USFBtakeaways', "category": 'miscellaneous' }],
        'turnOverDifferential': [{ "modelField": 'USFBturnoverDiff', "category": 'miscellaneous' }],
        'firstDowns': [{ "modelField": 'USFBtotalFirstDowns', "category": 'miscellaneous' }],
    }
}

new_statMap = {
    #statinapi : {category: 'categoryinDb', espn_name: 'nameinESPNAPI'}
    "americanfootball_ncaaf": {
        "gamesPlayed": {
            "category": "general",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "netTotalYards": {
            "category": "passing",
            "espn_name": "netTotalYards",
            "stat_iteration_type": "additive"
        },
        "netYardsPerGame": {
            "category": "passing",
            "espn_name": "netYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "netTotalYards"
        },
        "totalOffensivePlays": {
            "category": "passing",
            "espn_name": "totalOffensivePlays",
            "stat_iteration_type": "additive"
        },
        "totalYards": {
            "category": "passing",
            "espn_name": "totalYards",
            "stat_iteration_type": "additive"
        },
        "totalYardsFromScrimmage": {
            "category": "passing",
            "espn_name": "totalYardsFromScrimmage",
            "stat_iteration_type": "additive"
        },
        "yardsFromScrimmagePerGame": {
            "category": "passing",
            "espn_name": "yardsFromScrimmagePerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalYardsFromScrimmage"
        },
        "yardsPerGame": {
            "category": "passing",
            "espn_name": "yardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalYards"
        },
        "longRushing": {
            "category": "rushing",
            "espn_name": "longRushing",
            "stat_iteration_type": "comparison"
        },
        "rushingAttempts": {
            "category": "rushing",
            "espn_name": "rushingAttempts",
            "stat_iteration_type": "additive"
        },
        "firstDowns": {
            "category": "miscellaneous",
            "espn_name": "firstDowns",
            "stat_iteration_type": "additive"
        },
        "firstDownsPerGame": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "firstDowns"
        },
        "passingAttempts": {
            "category": "passing",
            "espn_name": "passingAttempts",
            "stat_iteration_type": "additive"
        },
        "possessionTimeSeconds": {
            "category": "miscellaneous",
            "espn_name": "possessionTimeSeconds",
            "stat_iteration_type": "additive"
        },
        "thirdDownAttempts": {
            "category": "miscellaneous",
            "espn_name": "thirdDownAttempts",
            "stat_iteration_type": "additive"
        },
        "rushingYards": {
            "category": "rushing",
            "espn_name": "rushingYards",
            "stat_iteration_type": "additive"
        },
        "rushingYardsPerGame": {
            "category": "rushing",
            "espn_name": "rushingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "rushingYards"
        },
        "yardsPerRushAttempt": {
            "category": "rushing",
            "espn_name": "yardsPerRushAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "rushingYards",
            "denominator": "rushingAttempts"
        },
        "netPassingYards": {
            "category": "passing",
            "espn_name": "netPassingYards",
            "stat_iteration_type": "additive"
        },
        "netPassingYardsPerGame": {
            "category": "passing",
            "espn_name": "netPassingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "netPassingYards"
        },
        "netYardsPerPassAttempt": {
            "category": "passing",
            "espn_name": "netYardsPerPassAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "netPassingYards",
            "denominator": "passingAttempts"
        },
        "ESPNWRRating": {
            "category": "receiving",
            "espn_name": "ESPNWRRating",
            "stat_iteration_type": "snapshot"
        },
        "receptions": {
            "category": "receiving",
            "espn_name": "receptions",
            "stat_iteration_type": "additive"
        },
        "completionPct": {
            "category": "passing",
            "espn_name": "completionPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "completions",
            "denominator": "passingAttempts"
        },
        "completions": {
            "category": "passing",
            "espn_name": "completions",
            "stat_iteration_type": "additive"
        },
        "receivingYards": {
            "category": "receiving",
            "espn_name": "receivingYards",
            "stat_iteration_type": "additive"
        },
        "receivingYardsAtCatch": {
            "category": "receiving",
            "espn_name": "receivingYardsAtCatch",
            "stat_iteration_type": "additive"
        },
        "receivingYardsPerGame": {
            "category": "receiving",
            "espn_name": "receivingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "receivingYards"
        },
        "yardsPerReception": {
            "category": "receiving",
            "espn_name": "yardsPerReception",
            "stat_iteration_type": "derived_rate",
            "numerator": "receivingYards",
            "denominator": "receptions"
        },
        "passingYards": {
            "category": "passing",
            "espn_name": "passingYards",
            "stat_iteration_type": "additive"
        },
        "passingYardsAtCatch": {
            "category": "passing",
            "espn_name": "passingYardsAtCatch",
            "stat_iteration_type": "additive"
        },
        "passingYardsPerGame": {
            "category": "passing",
            "espn_name": "passingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "passingYards"
        },
        "yardsPerCompletion": {
            "category": "passing",
            "espn_name": "yardsPerCompletion",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingYards",
            "denominator": "completions"
        },
        "yardsPerPassAttempt": {
            "category": "passing",
            "espn_name": "yardsPerPassAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingYards",
            "denominator": "passingAttempts"
        },
        "ESPNRBRating": {
            "category": "rushing",
            "espn_name": "ESPNRBRating",
            "stat_iteration_type": "snapshot"
        },
        "longReception": {
            "category": "receiving",
            "espn_name": "longReception",
            "stat_iteration_type": "comparison"
        },
        "ESPNQBRating": {
            "category": "passing",
            "espn_name": "ESPNQBRating",
            "stat_iteration_type": "snapshot"
        },
        "longPassing": {
            "category": "passing",
            "espn_name": "longPassing",
            "stat_iteration_type": "comparison"
        },
        "firstDownsPassing": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPassing",
            "stat_iteration_type": "additive"
        },
        "firstDownsRushing": {
            "category": "miscellaneous",
            "espn_name": "firstDownsRushing",
            "stat_iteration_type": "additive"
        },
        "kickoffs": {
            "category": "kicking",
            "espn_name": "kickoffs",
            "stat_iteration_type": "additive"
        },
        "totalPenalties": {
            "category": "miscellaneous",
            "espn_name": "totalPenalties",
            "stat_iteration_type": "additive"
        },
        "totalPenaltyYards": {
            "category": "miscellaneous",
            "espn_name": "totalPenaltyYards",
            "stat_iteration_type": "additive"
        },
        "thirdDownConvPct": {
            "category": "miscellaneous",
            "espn_name": "thirdDownConvPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "thirdDownConvs",
            "denominator": "thirdDownAttempts"
        },
        "thirdDownConvs": {
            "category": "miscellaneous",
            "espn_name": "thirdDownConvs",
            "stat_iteration_type": "additive"
        },
        "yardsAllowed": {
            "category": "defensive",
            "espn_name": "yardsAllowed",
            "stat_iteration_type": "additive"
        },
        "punts": {
            "category": "punting",
            "espn_name": "punts",
            "stat_iteration_type": "additive"
        },
        "grossAvgPuntYards": {
            "category": "punting",
            "espn_name": "grossAvgPuntYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntYards",
            "denominator": "punts"
        },
        "puntYards": {
            "category": "punting",
            "espn_name": "puntYards",
            "stat_iteration_type": "additive"
        },
        "longPunt": {
            "category": "punting",
            "espn_name": "longPunt",
            "stat_iteration_type": "comparison"
        },
        "totalPoints": {
            "category": "scoring",
            "espn_name": "totalPoints",
            "stat_iteration_type": "additive"
        },
        "totalPointsPerGame": {
            "category": "scoring",
            "espn_name": "totalPointsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalPoints"
        },
        "sacks": {
            "category": "defensive",
            "espn_name": "sacks",
            "stat_iteration_type": "additive"
        },
        "qb_sacks": {
            "category": "passing",
            "espn_name": "sacks",
            "stat_iteration_type": "additive"
        },
        "totalKickingPoints": {
            "category": "kicking",
            "espn_name": "totalKickingPoints",
            "stat_iteration_type": "additive"
        },
        "totalTouchdowns": {
            "category": "scoring",
            "espn_name": "totalTouchdowns",
            "stat_iteration_type": "additive"
        },
        "totalDrives": {
            "category": "miscellaneous",
            "espn_name": "totalDrives",
            "stat_iteration_type": "additive"
        },
        "yardsPerReturn": {
            "category": "returning",
            "espn_name": "yardsPerReturn",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickReturnYards",
            "denominator": "kickReturns"
        },
        "extraPointAttempts": {
            "category": "kicking",
            "espn_name": "extraPointAttempts",
            "stat_iteration_type": "additive"
        },
        "kickExtraPoints": {
            "category": "scoring",
            "espn_name": "kickExtraPoints",
            "stat_iteration_type": "additive"
        },
        "kickExtraPointsMade": {
            "category": "scoring",
            "espn_name": "kickExtraPointsMade",
            "stat_iteration_type": "additive"
        },
        "extraPointPct": {
            "category": "kicking",
            "espn_name": "extraPointPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "extraPointsMade",
            "denominator": "extraPointAttempts"
        },
        "extraPointsMade": {
            "category": "kicking",
            "espn_name": "extraPointsMade",
            "stat_iteration_type": "additive"
        },
        "totalTackles": {
            "category": "defensive",
            "espn_name": "totalTackles",
            "stat_iteration_type": "additive"
        },
        "soloTackles": {
            "category": "defensive",
            "espn_name": "soloTackles",
            "stat_iteration_type": "additive"
        },
        "assistTackles": {
            "category": "defensive",
            "espn_name": "assistTackles",
            "stat_iteration_type": "additive"
        },
        "tacklesForLoss": {
            "category": "defensive",
            "espn_name": "tacklesForLoss",
            "stat_iteration_type": "additive"
        },
        "kickReturns": {
            "category": "returning",
            "espn_name": "kickReturns",
            "stat_iteration_type": "additive"
        },
        "passesDefended": {
            "category": "defensive",
            "espn_name": "passesDefended",
            "stat_iteration_type": "additive"
        },
        "kickReturnYards": {
            "category": "returning",
            "espn_name": "kickReturnYards",
            "stat_iteration_type": "additive"
        },
        "longKickReturn": {
            "category": "returning",
            "espn_name": "longKickReturn",
            "stat_iteration_type": "comparison"
        },
        "fourthDownAttempts": {
            "category": "miscellaneous",
            "espn_name": "fourthDownAttempts",
            "stat_iteration_type": "additive"
        },
        "kickoffReturns": {
            "category": "kicking",
            "espn_name": "kickoffReturns",
            "stat_iteration_type": "additive"
        },
        "interceptions": {
            "category": "passing",
            "espn_name": "interceptions",
            "stat_iteration_type": "additive"
        },
        "defensive_interceptions": {
            "category": "defensiveInterceptions",
            "espn_name": "interceptions",
            "stat_iteration_type": "additive"
        },
        "avgKickoffReturnYards": {
            "category": "returning",
            "espn_name": "avgKickoffReturnYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickReturnYards",
            "denominator": "kickReturns"
        },
        "touchbacks": {
            "category": "kicking",
            "espn_name": "touchbacks",
            "stat_iteration_type": "additive"
        },
        "touchbackPct": {
            "category": "kicking",
            "espn_name": "touchbackPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "touchbacks",
            "denominator": "kickoffs"
        },
        "touchbacks_punting": {
            "category": "punting",
            "espn_name": "touchbacks",
            "stat_iteration_type": "additive"
        },
        "touchbackPct_punting": {
            "category": "punting",
            "espn_name": "touchbackPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "touchbacks_punting",
            "denominator": "punts"
        },
        "avgSackYards": {
            "category": "defensive",
            "espn_name": "avgSackYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "sackYards",
            "denominator": "sacks"
        },
        "firstDownsPenalty": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPenalty",
            "stat_iteration_type": "additive"
        },
        "passingTouchdowns": {
            "category": "passing",
            "espn_name": "passingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "sackYardsLost": {
            "category": "passing",
            "espn_name": "sackYardsLost",
            "stat_iteration_type": "additive"
        },
        "receivingTouchdowns": {
            "category": "receiving",
            "espn_name": "receivingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "passingTouchdownPct": {
            "category": "passing",
            "espn_name": "passingTouchdownPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingTouchdowns",
            "denominator": "passingAttempts"
        },
        "sackYards": {
            "category": "defensive",
            "espn_name": "sackYards",
            "stat_iteration_type": "additive"
        },
        "rushingTouchdowns": {
            "category": "rushing",
            "espn_name": "rushingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "fieldGoalAttempts": {
            "category": "kicking",
            "espn_name": "fieldGoalAttempts",
            "stat_iteration_type": "additive"
        },
        "puntReturns": {
            "category": "returning",
            "espn_name": "puntReturns",
            "stat_iteration_type": "additive"
        },
        "puntsInside20": {
            "category": "punting",
            "espn_name": "puntsInside20",
            "stat_iteration_type": "additive"
        },
        "puntsInside20Pct": {
            "category": "punting",
            "espn_name": "puntsInside20Pct",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntsInside20",
            "denominator": "punts"
        },
        "hurries": {
            "category": "defensive",
            "espn_name": "hurries",
            "stat_iteration_type": "additive"
        },
        "fumbles": {
            "category": "general",
            "espn_name": "fumbles",
            "stat_iteration_type": "additive"
        },
        "fieldGoalPct": {
            "category": "kicking",
            "espn_name": "fieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fieldGoalsMade",
            "denominator": "fieldGoals"
        },
        "fieldGoalsMade": {
            "category": "kicking",
            "espn_name": "fieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoals": {
            "category": "scoring",
            "espn_name": "fieldGoals",
            "stat_iteration_type": "additive"
        },
        "fourthDownConvs": {
            "category": "miscellaneous",
            "espn_name": "fourthDownConvs",
            "stat_iteration_type": "additive"
        },
        "fourthDownConvPct": {
            "category": "miscellaneous",
            "espn_name": "fourthDownConvPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fourthDownConvs",
            "denominator": "fourthDownAttempts"
        },
        "turnOverDifferential": {
            "category": "miscellaneous",
            "espn_name": "turnOverDifferential",
            "stat_iteration_type": "additive"
        }
    },
    "americanfootball_nfl": {
        "gamesPlayed": {
            "category": "general",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "completionPct": {
            "category": "passing",
            "espn_name": "completionPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "completions",
            "denominator": "passingAttempts"
        },
        "completions": {
            "category": "passing",
            "espn_name": "completions",
            "stat_iteration_type": "additive"
        },
        "ESPNQBRating": {
            "category": "passing",
            "espn_name": "ESPNQBRating",
            "stat_iteration_type": "snapshot"
        },
        "longPassing": {
            "category": "passing",
            "espn_name": "longPassing",
            "stat_iteration_type": "comparison"
        },
        "netPassingYards": {
            "category": "passing",
            "espn_name": "netPassingYards",
            "stat_iteration_type": "additive"
        },
        "netPassingYardsPerGame": {
            "category": "passing",
            "espn_name": "netPassingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "netPassingYards"
        },
        "netTotalYards": {
            "category": "passing",
            "espn_name": "netTotalYards",
            "stat_iteration_type": "additive"
        },
        "netYardsPerGame": {
            "category": "passing",
            "espn_name": "netYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "netTotalYards"
        },
        "passingAttempts": {
            "category": "passing",
            "espn_name": "passingAttempts",
            "stat_iteration_type": "additive"
        },
        "passingYards": {
            "category": "passing",
            "espn_name": "passingYards",
            "stat_iteration_type": "additive"
        },
        "passingYardsAtCatch": {
            "category": "passing",
            "espn_name": "passingYardsAtCatch",
            "stat_iteration_type": "additive"
        },
        "passingYardsPerGame": {
            "category": "passing",
            "espn_name": "passingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "passingYards"
        },
        "netPassingAttempts": {
            "category": "passing",
            "espn_name": "netPassingAttempts",
            "stat_iteration_type": "additive"
        },
        "totalOffensivePlays": {
            "category": "passing",
            "espn_name": "totalOffensivePlays",
            "stat_iteration_type": "additive"
        },
        "totalYards": {
            "category": "passing",
            "espn_name": "totalYards",
            "stat_iteration_type": "additive"
        },
        "totalYardsFromScrimmage": {
            "category": "passing",
            "espn_name": "totalYardsFromScrimmage",
            "stat_iteration_type": "additive"
        },
        "yardsFromScrimmagePerGame": {
            "category": "passing",
            "espn_name": "yardsFromScrimmagePerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalYardsFromScrimmage"
        },
        "yardsPerCompletion": {
            "category": "passing",
            "espn_name": "yardsPerCompletion",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingYards",
            "denominator": "completions"
        },
        "yardsPerGame": {
            "category": "passing",
            "espn_name": "yardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalYards"
        },
        "yardsPerPassAttempt": {
            "category": "passing",
            "espn_name": "yardsPerPassAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingYards",
            "denominator": "passingAttempts"
        },
        "netYardsPerPassAttempt": {
            "category": "passing",
            "espn_name": "netYardsPerPassAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "netPassingYards",
            "denominator": "netPassingAttempts"
        },
        "ESPNRBRating": {
            "category": "rushing",
            "espn_name": "ESPNRBRating",
            "stat_iteration_type": "snapshot"
        },
        "longRushing": {
            "category": "rushing",
            "espn_name": "longRushing",
            "stat_iteration_type": "comparison"
        },
        "rushingAttempts": {
            "category": "rushing",
            "espn_name": "rushingAttempts",
            "stat_iteration_type": "additive"
        },
        "rushingYards": {
            "category": "rushing",
            "espn_name": "rushingYards",
            "stat_iteration_type": "additive"
        },
        "rushingYardsPerGame": {
            "category": "rushing",
            "espn_name": "rushingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "rushingYards"
        },
        "yardsPerRushAttempt": {
            "category": "rushing",
            "espn_name": "yardsPerRushAttempt",
            "stat_iteration_type": "derived_rate",
            "numerator": "rushingYards",
            "denominator": "rushingAttempts"
        },
        "ESPNWRRating": {
            "category": "receiving",
            "espn_name": "ESPNWRRating",
            "stat_iteration_type": "snapshot"
        },
        "longReception": {
            "category": "receiving",
            "espn_name": "longReception",
            "stat_iteration_type": "comparison"
        },
        "receivingTargets": {
            "category": "receiving",
            "espn_name": "receivingTargets",
            "stat_iteration_type": "additive"
        },
        "receivingYards": {
            "category": "receiving",
            "espn_name": "receivingYards",
            "stat_iteration_type": "additive"
        },
        "receivingYardsAfterCatch": {
            "category": "receiving",
            "espn_name": "receivingYardsAfterCatch",
            "stat_iteration_type": "additive"
        },
        "receivingYardsPerGame": {
            "category": "receiving",
            "espn_name": "receivingYardsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "receivingYards"
        },
        "receptions": {
            "category": "receiving",
            "espn_name": "receptions",
            "stat_iteration_type": "additive"
        },
        "yardsPerReception": {
            "category": "receiving",
            "espn_name": "yardsPerReception",
            "stat_iteration_type": "derived_rate",
            "numerator": "receivingYards",
            "denominator": "receptions"
        },
        "assistTackles": {
            "category": "defensive",
            "espn_name": "assistTackles",
            "stat_iteration_type": "additive"
        },
        "soloTackles": {
            "category": "defensive",
            "espn_name": "soloTackles",
            "stat_iteration_type": "additive"
        },
        "totalTackles": {
            "category": "defensive",
            "espn_name": "totalTackles",
            "stat_iteration_type": "additive"
        },
        "yardsAllowed": {
            "category": "defensive",
            "espn_name": "yardsAllowed",
            "stat_iteration_type": "additive"
        },
        "kickoffs": {
            "category": "kicking",
            "espn_name": "kickoffs",
            "stat_iteration_type": "additive"
        },
        "firstDowns": {
            "category": "miscellaneous",
            "espn_name": "firstDowns",
            "stat_iteration_type": "additive"
        },
        "firstDownsPerGame": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "firstDowns"
        },
        "possessionTimeSeconds": {
            "category": "miscellaneous",
            "espn_name": "possessionTimeSeconds",
            "stat_iteration_type": "additive"
        },
        "thirdDownAttempts": {
            "category": "miscellaneous",
            "espn_name": "thirdDownAttempts",
            "stat_iteration_type": "additive"
        },
        "totalDrives": {
            "category": "miscellaneous",
            "espn_name": "totalDrives",
            "stat_iteration_type": "additive"
        },
        "receivingYardsAtCatch": {
            "category": "receiving",
            "espn_name": "receivingYardsAtCatch",
            "stat_iteration_type": "additive"
        },
        "firstDownsPassing": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPassing",
            "stat_iteration_type": "additive"
        },
        "totalPenalties": {
            "category": "miscellaneous",
            "espn_name": "totalPenalties",
            "stat_iteration_type": "additive"
        },
        "totalPenaltyYards": {
            "category": "miscellaneous",
            "espn_name": "totalPenaltyYards",
            "stat_iteration_type": "additive"
        },
        "rushingFirstDowns": {
            "category": "rushing",
            "espn_name": "rushingFirstDowns",
            "stat_iteration_type": "additive"
        },
        "firstDownsRushing": {
            "category": "miscellaneous",
            "espn_name": "firstDownsRushing",
            "stat_iteration_type": "additive"
        },
        "thirdDownConvPct": {
            "category": "miscellaneous",
            "espn_name": "thirdDownConvPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "thirdDownConvs",
            "denominator": "thirdDownAttempts"
        },
        "thirdDownConvs": {
            "category": "miscellaneous",
            "espn_name": "thirdDownConvs",
            "stat_iteration_type": "additive"
        },
        "totalPoints": {
            "category": "scoring",
            "espn_name": "totalPoints",
            "stat_iteration_type": "additive"
        },
        "totalPointsPerGame": {
            "category": "scoring",
            "espn_name": "totalPointsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalPoints"
        },
        "pointsAllowed": {
            "category": "defensive",
            "espn_name": "pointsAllowed",
            "stat_iteration_type": "additive"
        },
        "sacks": {
            "category": "defensive",
            "espn_name": "sacks",
            "stat_iteration_type": "additive"
        },
        "tacklesForLoss": {
            "category": "defensive",
            "espn_name": "tacklesForLoss",
            "stat_iteration_type": "additive"
        },
        "punts": {
            "category": "punting",
            "espn_name": "punts",
            "stat_iteration_type": "additive"
        },
        "grossAvgPuntYards": {
            "category": "punting",
            "espn_name": "grossAvgPuntYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntYards",
            "denominator": "punts"
        },
        "longPunt": {
            "category": "punting",
            "espn_name": "longPunt",
            "stat_iteration_type": "comparison"
        },
        "puntYards": {
            "category": "punting",
            "espn_name": "puntYards",
            "stat_iteration_type": "additive"
        },
        "totalKickingPoints": {
            "category": "kicking",
            "espn_name": "totalKickingPoints",
            "stat_iteration_type": "additive"
        },
        "stuffs": {
            "category": "defensive",
            "espn_name": "stuffs",
            "stat_iteration_type": "additive"
        },
        "passesDefended": {
            "category": "defensive",
            "espn_name": "passesDefended",
            "stat_iteration_type": "additive"
        },
        "yardsPerReturn": {
            "category": "returning",
            "espn_name": "yardsPerReturn",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntReturnYards",
            "denominator": "puntReturns"
        },
        "puntReturns": {
            "category": "punting",
            "espn_name": "puntReturns",
            "stat_iteration_type": "additive"
        },
        "totalTouchdowns": {
            "category": "scoring",
            "espn_name": "totalTouchdowns",
            "stat_iteration_type": "additive"
        },
        "puntReturnYards": {
            "category": "punting",
            "espn_name": "puntReturnYards",
            "stat_iteration_type": "additive"
        },
        "touchbackPct": {
            "category": "kicking",
            "espn_name": "touchbackPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "touchbacks",
            "denominator": "kickoffs"
        },
        "touchbacks": {
            "category": "kicking",
            "espn_name": "touchbacks",
            "stat_iteration_type": "additive"
        },
        "touchbacks_punting": {
            "category": "punting",
            "espn_name": "touchbackPct",
            "stat_iteration_type": "additive"
        },
        "touchbackPct_punting": {
            "category": "punting",
            "espn_name": "touchbacks",
            "stat_iteration_type": "derived_rate",
            "numerator": "touchbacks_punting",
            "denominator": "punts"
        },
        "extraPointAttempts": {
            "category": "kicking",
            "espn_name": "extraPointAttempts",
            "stat_iteration_type": "additive"
        },
        "avgPuntReturnYards": {
            "category": "punting",
            "espn_name": "avgPuntReturnYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntReturnYards",
            "denominator": "puntReturns"
        },
        "extraPointPct": {
            "category": "kicking",
            "espn_name": "extraPointPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickExtraPointsMade",
            "denominator": "extraPointAttempts"
        },
        "extraPointsMade": {
            "category": "kicking",
            "espn_name": "extraPointsMade",
            "stat_iteration_type": "additive"
        },
        "kickExtraPoints": {
            "category": "scoring",
            "espn_name": "kickExtraPoints",
            "stat_iteration_type": "additive"
        },
        "kickExtraPointsMade": {
            "category": "scoring",
            "espn_name": "kickExtraPointsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoalAttempts": {
            "category": "kicking",
            "espn_name": "fieldGoalAttempts",
            "stat_iteration_type": "additive"
        },
        "fieldGoalAttemptYards": {
            "category": "kicking",
            "espn_name": "fieldGoalAttemptYards",
            "stat_iteration_type": "additive"
        },
        "twoPointRecConvs": {
            "category": "receiving",
            "espn_name": "twoPointRecConvs",
            "stat_iteration_type": "additive"
        },
        "sackYardsLost": {
            "category": "passing",
            "espn_name": "sackYardsLost",
            "stat_iteration_type": "additive"
        },
        "avgSackYards": {
            "category": "defensive",
            "espn_name": "avgSackYards",
            "stat_iteration_type": "derived_average",
            "base_stat": "sackYards"
        },
        "sackYards": {
            "category": "defensive",
            "espn_name": "sackYards",
            "stat_iteration_type": "additive"
        },
        "passingFirstDowns": {
            "category": "passing",
            "espn_name": "passingFirstDowns",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsMadeYards": {
            "category": "kicking",
            "espn_name": "fieldGoalsMadeYards",
            "stat_iteration_type": "additive"
        },
        "longFieldGoalMade": {
            "category": "kicking",
            "espn_name": "longFieldGoalMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoalPct": {
            "category": "kicking",
            "espn_name": "fieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fieldGoalsMade",
            "denominator": "fieldGoalAttempts"
        },
        "fieldGoalsMade": {
            "category": "kicking",
            "espn_name": "fieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoals": {
            "category": "scoring",
            "espn_name": "fieldGoals",
            "stat_iteration_type": "additive"
        },
        "firstDownsPenalty": {
            "category": "miscellaneous",
            "espn_name": "firstDownsPenalty",
            "stat_iteration_type": "additive"
        },
        "avgKickoffYards": {
            "category": "kicking",
            "espn_name": "avgKickoffYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickoffYards",
            "denominator": "kickoffs"
        },
        "kickoffYards": {
            "category": "kicking",
            "espn_name": "kickoffYards",
            "stat_iteration_type": "additive"
        },
        "passingTouchdownPct": {
            "category": "passing",
            "espn_name": "passingTouchdownPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "passingTouchdowns",
            "denominator": "passingAttempts"
        },
        "passingTouchdowns": {
            "category": "passing",
            "espn_name": "passingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "receivingTouchdowns": {
            "category": "receiving",
            "espn_name": "receivingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "interceptions": {
            "category": "passing",
            "espn_name": "interceptions",
            "stat_iteration_type": "additive"
        },
        "defensive_interceptions": {
            "category": "defensive",
            "espn_name": "interceptions",
            "stat_iteration_type": "additive"
        },
        "kickoffReturns": {
            "category": "kicking",
            "espn_name": "kickoffReturns",
            "stat_iteration_type": "additive"
        },
        "kickReturns": {
            "category": "returning",
            "espn_name": "kickReturns",
            "stat_iteration_type": "additive"
        },
        "puntsInside20": {
            "category": "punting",
            "espn_name": "puntsInside20",
            "stat_iteration_type": "additive"
        },
        "puntsInside20Pct": {
            "category": "punting",
            "espn_name": "puntsInside20Pct",
            "stat_iteration_type": "derived_rate",
            "numerator": "puntsInside20",
            "denominator": "punts"
        },
        "avgKickoffReturnYards": {
            "category": "kicking",
            "espn_name": "avgKickoffReturnYards",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickoffReturnYards",
            "denominator": "kickoffReturns"
        },
        "kickoffReturnYards": {
            "category": "kicking",
            "espn_name": "kickoffReturnYards",
            "stat_iteration_type": "additive"
        },
        "kickReturnYards": {
            "category": "returning",
            "espn_name": "kickReturnYards",
            "stat_iteration_type": "additive"
        },
        "longKickReturn": {
            "category": "returning",
            "espn_name": "longKickReturn",
            "stat_iteration_type": "additive"
        },
        "yardsPerPuntReturn": {
            "category": "returning",
            "espn_name": "yardsPerPuntReturn",
            "stat_iteration_type": "derived_rate",
            "numerator": "kickReturnYards",
            "denominator": "kickReturns"
        },
        "longPuntReturn": {
            "category": "returning",
            "espn_name": "longPuntReturn",
            "stat_iteration_type": "comparison"
        },
        "rushingTouchdowns": {
            "category": "rushing",
            "espn_name": "rushingTouchdowns",
            "stat_iteration_type": "additive"
        },
        "turnOverDifferential": {
            "category": "miscellaneous",
            "espn_name": "turnOverDifferential",
            "stat_iteration_type": "additive"
        },
    },
    "basketball_nba": {
        "defensiveRebounds": {
            "category": "defensive",
            "espn_name": "defensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgDefensiveRebounds": {
            "category": "defensive",
            "espn_name": "avgDefensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "defensiveRebounds"
        },
        "fouls": {
            "category": "general",
            "espn_name": "fouls",
            "stat_iteration_type": "additive"
        },
        "rebounds": {
            "category": "general",
            "espn_name": "rebounds",
            "stat_iteration_type": "additive"
        },
        "NBARating": {
            "category": "general",
            "espn_name": "NBARating",
            "stat_iteration_type": "snapshot"
        },
        "avgRebounds": {
            "category": "general",
            "espn_name": "avgRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "rebounds"
        },
        "avgFouls": {
            "category": "general",
            "espn_name": "avgFouls",
            "stat_iteration_type": "derived_average",
            "base_stat": "fouls"
        },
        "assistTurnoverRatio": {
            "category": "general",
            "espn_name": "assistTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "assists",
            "denominator": "turnovers"
        },
        "totalRebounds": {
            "category": "general",
            "espn_name": "totalRebounds",
            "stat_iteration_type": "additive"
        },
        "gamesPlayed": {
            "category": "general",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "assists": {
            "category": "offensive",
            "espn_name": "assists",
            "stat_iteration_type": "additive"
        },
        "fieldGoals": {
            "category": "offensive",
            "espn_name": "fieldGoals",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "fieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsMade": {
            "category": "offensive",
            "espn_name": "fieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoalPct": {
            "category": "offensive",
            "espn_name": "fieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fieldGoalsMade",
            "denominator": "fieldGoalsAttempted"
        },
        "points": {
            "category": "offensive",
            "espn_name": "points",
            "stat_iteration_type": "additive"
        },
        "turnovers": {
            "category": "offensive",
            "espn_name": "turnovers",
            "stat_iteration_type": "additive"
        },
        "threePointPct": {
            "category": "offensive",
            "espn_name": "threePointPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "threePointFieldGoalsMade",
            "denominator": "threePointFieldGoalsAttempted"
        },
        "threePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "threePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "pointsInPaint": {
            "category": "offensive",
            "espn_name": "pointsInPaint",
            "stat_iteration_type": "additive"
        },
        "avgFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsMade"
        },
        "avgFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsAttempted"
        },
        "avgThreePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsMade"
        },
        "avgThreePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsAttempted"
        },
        "avgPoints": {
            "category": "offensive",
            "espn_name": "avgPoints",
            "stat_iteration_type": "derived_average",
            "base_stat": "points"
        },
        "avgAssists": {
            "category": "offensive",
            "espn_name": "avgAssists",
            "stat_iteration_type": "derived_average",
            "base_stat": "assists"
        },
        "avgTurnovers": {
            "category": "offensive",
            "espn_name": "avgTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "turnovers"
        },
        "estimatedPossessions": {
            "category": "offensive",
            "espn_name": "estimatedPossessions",
            "stat_iteration_type": "additive"
        },
        "avgEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "avgEstimatedPossessions",
            "stat_iteration_type": "derived_average",
            "base_stat": "estimatedPossessions"
        },
        "pointsPerEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "pointsPerEstimatedPossessions",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "threePointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "threePointFieldGoalsMade",
            "denominator": "threePointFieldGoalsAttempted"
        },
        "twoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "twoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgTwoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsMade"
        },
        "avgTwoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsAttempted"
        },
        "twoPointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "twoPointFieldGoalsMade",
            "denominator": "twoPointFieldGoalsAttempted"
        },
        "shootingEfficiency": {
            "category": "offensive",
            "espn_name": "shootingEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "fieldGoalsAttempted"
        },
        "scoringEfficiency": {
            "category": "offensive",
            "espn_name": "scoringEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "freeThrowPct": {
            "category": "offensive",
            "espn_name": "freeThrowPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "freeThrowsMade",
            "denominator": "freeThrowsAttempted"
        },
        "freeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "freeThrowsAttempted",
            "stat_iteration_type": "additive"
        },
        "freeThrowsMade": {
            "category": "offensive",
            "espn_name": "freeThrowsMade",
            "stat_iteration_type": "additive"
        },
        "avgFreeThrowsMade": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsMade"
        },
        "avgFreeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsAttempted"
        },
        "offensiveRebounds": {
            "category": "offensive",
            "espn_name": "offensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgOffensiveRebounds": {
            "category": "offensive",
            "espn_name": "avgOffensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "offensiveRebounds"
        },
        "offensiveReboundPct": {
            "category": "offensive",
            "espn_name": "offensiveReboundPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "offensiveRebounds",
            "denominator": "totalRebounds"
        },
        "totalTurnovers": {
            "category": "offensive",
            "espn_name": "totalTurnovers",
            "stat_iteration_type": "additive"
        },
        "avgTotalTurnovers": {
            "category": "offensive",
            "espn_name": "avgTotalTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalTurnovers"
        },
        "turnoverPoints": {
            "category": "defensive",
            "espn_name": "turnoverPoints",
            "stat_iteration_type": "additive"
        },
        "steals": {
            "category": "defensive",
            "espn_name": "steals",
            "stat_iteration_type": "additive"
        },
        "avgSteals": {
            "category": "defensive",
            "espn_name": "avgSteals",
            "stat_iteration_type": "derived_average",
            "base_stat": "steals"
        },
        "stealFoulRatio": {
            "category": "general",
            "espn_name": "stealFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "fouls"
        },
        "stealTurnoverRatio": {
            "category": "general",
            "espn_name": "stealTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "turnovers"
        },
        "fastBreakPoints": {
            "category": "offensive",
            "espn_name": "fastBreakPoints",
            "stat_iteration_type": "additive"
        },
        "blocks": {
            "category": "defensive",
            "espn_name": "blocks",
            "stat_iteration_type": "additive"
        },
        "avgBlocks": {
            "category": "defensive",
            "espn_name": "avgBlocks",
            "stat_iteration_type": "derived_average",
            "base_stat": "blocks"
        },
        "blockFoulRatio": {
            "category": "general",
            "espn_name": "blockFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "blocks",
            "denominator": "fouls"
        },
    },
    "basketball_ncaab": {
        "defensiveRebounds": {
            "category": "defensive",
            "espn_name": "defensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgDefensiveRebounds": {
            "category": "defensive",
            "espn_name": "avgDefensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "defensiveRebounds"
        },
        "fouls": {
            "category": "general",
            "espn_name": "fouls",
            "stat_iteration_type": "additive"
        },
        "avgFouls": {
            "category": "general",
            "espn_name": "avgFouls",
            "stat_iteration_type": "derived_average",
            "base_stat": "fouls"
        },
        "rebounds": {
            "category": "general",
            "espn_name": "rebounds",
            "stat_iteration_type": "additive"
        },
        "avgRebounds": {
            "category": "general",
            "espn_name": "avgRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "rebounds"
        },
        "totalRebounds": {
            "category": "general",
            "espn_name": "totalRebounds",
            "stat_iteration_type": "additive"
        },
        "gamesPlayed": {
            "category": "general",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "assists": {
            "category": "offensive",
            "espn_name": "assists",
            "stat_iteration_type": "additive"
        },
        "fieldGoals": {
            "category": "offensive",
            "espn_name": "fieldGoals",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "fieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsMade": {
            "category": "offensive",
            "espn_name": "fieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoalPct": {
            "category": "offensive",
            "espn_name": "fieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fieldGoalsMade",
            "denominator": "fieldGoalsAttempted"
        },
        "points": {
            "category": "offensive",
            "espn_name": "points",
            "stat_iteration_type": "additive"
        },
        "threePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsMade"
        },
        "avgFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsAttempted"
        },
        "avgThreePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsAttempted"
        },
        "avgPoints": {
            "category": "offensive",
            "espn_name": "avgPoints",
            "stat_iteration_type": "derived_average",
            "base_stat": "points"
        },
        "avgAssists": {
            "category": "offensive",
            "espn_name": "avgAssists",
            "stat_iteration_type": "derived_average",
            "base_stat": "assists"
        },
        "estimatedPossessions": {
            "category": "offensive",
            "espn_name": "estimatedPossessions",
            "stat_iteration_type": "additive"
        },
        "avgEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "avgEstimatedPossessions",
            "stat_iteration_type": "derived_average",
            "base_stat": "estimatedPossessions"
        },
        "pointsPerEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "pointsPerEstimatedPossessions",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "twoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "twoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgTwoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsMade"
        },
        "avgTwoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsAttempted"
        },
        "twoPointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "twoPointFieldGoalsMade",
            "denominator": "twoPointFieldGoalsAttempted"
        },
        "shootingEfficiency": {
            "category": "offensive",
            "espn_name": "shootingEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "fieldGoalsAttempted"
        },
        "scoringEfficiency": {
            "category": "offensive",
            "espn_name": "scoringEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "assistTurnoverRatio": {
            "category": "offensive",
            "espn_name": "assistTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "assists",
            "denominator": "turnovers"
        },
        "turnovers": {
            "category": "offensive",
            "espn_name": "turnovers",
            "stat_iteration_type": "additive"
        },
        "totalTurnovers": {
            "category": "offensive",
            "espn_name": "totalTurnovers",
            "stat_iteration_type": "additive"
        },
        "avgTurnovers": {
            "category": "offensive",
            "espn_name": "avgTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "turnovers"
        },
        "avgTotalTurnovers": {
            "category": "offensive",
            "espn_name": "avgTotalTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalTurnovers"
        },
        "freeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "freeThrowsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgFreeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsAttempted"
        },
        "offensiveRebounds": {
            "category": "offensive",
            "espn_name": "offensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgOffensiveRebounds": {
            "category": "offensive",
            "espn_name": "avgOffensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "offensiveRebounds"
        },
        "offensiveReboundPct": {
            "category": "offensive",
            "espn_name": "offensiveReboundPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "offensiveRebounds",
            "denominator": "totalRebounds"
        },
        "freeThrowPct": {
            "category": "offensive",
            "espn_name": "freeThrowPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "freeThrowsMade",
            "denominator": "freeThrowsAttempted"
        },
        "freeThrowsMade": {
            "category": "offensive",
            "espn_name": "freeThrowsMade",
            "stat_iteration_type": "additive"
        },
        "avgFreeThrowsMade": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsMade"
        },
        "threePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "avgThreePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsMade"
        },
        "threePointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "threePointFieldGoalsMade",
            "denominator": "threePointFieldGoalsAttempted"
        },
        "steals": {
            "category": "defensive",
            "espn_name": "steals",
            "stat_iteration_type": "additive"
        },
        "avgSteals": {
            "category": "defensive",
            "espn_name": "avgSteals",
            "stat_iteration_type": "derived_average",
            "base_stat": "steals"
        },
        "stealFoulRatio": {
            "category": "defensive",
            "espn_name": "stealFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "fouls"
        },
        "stealTurnoverRatio": {
            "category": "general",
            "espn_name": "stealTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "turnovers"
        },
        "turnoverPoints": {
            "category": "defensive",
            "espn_name": "turnoverPoints",
            "stat_iteration_type": "additive"
        },
        "blocks": {
            "category": "defensive",
            "espn_name": "blocks",
            "stat_iteration_type": "additive"
        },
        "avgBlocks": {
            "category": "defensive",
            "espn_name": "avgBlocks",
            "stat_iteration_type": "derived_average",
            "base_stat": "blocks"
        },
        "blockFoulRatio": {
            "category": "general",
            "espn_name": "blockFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "blocks",
            "denominator": "fouls"
        },
        "fastBreakPoints": {
            "category": "offensive",
            "espn_name": "fastBreakPoints",
            "stat_iteration_type": "additive"
        },
    },
    "basketball_wncaab": {
        "defensiveRebounds": {
            "category": "defensive",
            "espn_name": "defensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgDefensiveRebounds": {
            "category": "defensive",
            "espn_name": "avgDefensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "defensiveRebounds"
        },
        "fouls": {
            "category": "general",
            "espn_name": "fouls",
            "stat_iteration_type": "additive"
        },
        "rebounds": {
            "category": "general",
            "espn_name": "rebounds",
            "stat_iteration_type": "additive"
        },
        "avgRebounds": {
            "category": "general",
            "espn_name": "avgRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "rebounds"
        },
        "avgFouls": {
            "category": "general",
            "espn_name": "avgFouls",
            "stat_iteration_type": "derived_average",
            "base_stat": "fouls"
        },
        "totalRebounds": {
            "category": "general",
            "espn_name": "totalRebounds",
            "stat_iteration_type": "additive"
        },
        "gamesPlayed": {
            "category": "general",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "fieldGoals": {
            "category": "offensive",
            "espn_name": "fieldGoals",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "fieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "fieldGoalsMade": {
            "category": "offensive",
            "espn_name": "fieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "fieldGoalPct": {
            "category": "offensive",
            "espn_name": "fieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "fieldGoalsMade",
            "denominator": "fieldGoalsAttempted"
        },
        "points": {
            "category": "offensive",
            "espn_name": "points",
            "stat_iteration_type": "additive"
        },
        "turnovers": {
            "category": "offensive",
            "espn_name": "turnovers",
            "stat_iteration_type": "additive"
        },
        "totalTurnovers": {
            "category": "offensive",
            "espn_name": "totalTurnovers",
            "stat_iteration_type": "additive"
        },
        "avgFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsMade"
        },
        "avgFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "fieldGoalsAttempted"
        },
        "avgPoints": {
            "category": "offensive",
            "espn_name": "avgPoints",
            "stat_iteration_type": "derived_average",
            "base_stat": "points"
        },
        "avgTurnovers": {
            "category": "offensive",
            "espn_name": "avgTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "turnovers"
        },
        "estimatedPossessions": {
            "category": "offensive",
            "espn_name": "estimatedPossessions",
            "stat_iteration_type": "additive"
        },
        "avgEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "avgEstimatedPossessions",
            "stat_iteration_type": "derived_average",
            "base_stat": "estimatedPossessions"
        },
        "pointsPerEstimatedPossessions": {
            "category": "offensive",
            "espn_name": "pointsPerEstimatedPossessions",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "avgTotalTurnovers": {
            "category": "offensive",
            "espn_name": "avgTotalTurnovers",
            "stat_iteration_type": "derived_average",
            "base_stat": "totalTurnovers"
        },
        "twoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "twoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgTwoPointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsMade"
        },
        "avgTwoPointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgTwoPointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "twoPointFieldGoalsAttempted"
        },
        "twoPointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "twoPointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "twoPointFieldGoalsMade",
            "denominator": "twoPointFieldGoalsAttempted"
        },
        "shootingEfficiency": {
            "category": "offensive",
            "espn_name": "shootingEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "fieldGoalsAttempted"
        },
        "scoringEfficiency": {
            "category": "offensive",
            "espn_name": "scoringEfficiency",
            "stat_iteration_type": "derived_rate",
            "numerator": "points",
            "denominator": "estimatedPossessions"
        },
        "threePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgThreePointFieldGoalsAttempted": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsAttempted"
        },
        "assistTurnoverRatio": {
            "category": "general",
            "espn_name": "assistTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "assists",
            "denominator": "turnovers"
        },
        "assists": {
            "category": "offensive",
            "espn_name": "assists",
            "stat_iteration_type": "additive"
        },
        "avgAssists": {
            "category": "offensive",
            "espn_name": "avgAssists",
            "stat_iteration_type": "derived_average",
            "base_stat": "assists"
        },
        "offensiveRebounds": {
            "category": "offensive",
            "espn_name": "offensiveRebounds",
            "stat_iteration_type": "additive"
        },
        "avgOffensiveRebounds": {
            "category": "offensive",
            "espn_name": "avgOffensiveRebounds",
            "stat_iteration_type": "derived_average",
            "base_stat": "offensiveRebounds"
        },
        "offensiveReboundPct": {
            "category": "offensive",
            "espn_name": "offensiveReboundPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "offensiveRebounds",
            "denominator": "totalRebounds"
        },
        "freeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "freeThrowsAttempted",
            "stat_iteration_type": "additive"
        },
        "avgFreeThrowsAttempted": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsAttempted",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsAttempted"
        },
        "freeThrowPct": {
            "category": "offensive",
            "espn_name": "freeThrowPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "freeThrowsMade",
            "denominator": "freeThrowsAttempted"
        },
        "freeThrowsMade": {
            "category": "offensive",
            "espn_name": "freeThrowsMade",
            "stat_iteration_type": "additive"
        },
        "avgFreeThrowsMade": {
            "category": "offensive",
            "espn_name": "avgFreeThrowsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "freeThrowsMade"
        },
        "steals": {
            "category": "defensive",
            "espn_name": "steals",
            "stat_iteration_type": "additive"
        },
        "avgSteals": {
            "category": "defensive",
            "espn_name": "avgSteals",
            "stat_iteration_type": "derived_average",
            "base_stat": "steals"
        },
        "stealFoulRatio": {
            "category": "general",
            "espn_name": "stealFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "fouls"
        },
        "stealTurnoverRatio": {
            "category": "general",
            "espn_name": "stealTurnoverRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "steals",
            "denominator": "turnovers"
        },
        "threePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalsMade",
            "stat_iteration_type": "additive"
        },
        "avgThreePointFieldGoalsMade": {
            "category": "offensive",
            "espn_name": "avgThreePointFieldGoalsMade",
            "stat_iteration_type": "derived_average",
            "base_stat": "threePointFieldGoalsMade"
        },
        "threePointFieldGoalPct": {
            "category": "offensive",
            "espn_name": "threePointFieldGoalPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "threePointFieldGoalsMade",
            "denominator": "threePointFieldGoalsAttempted"
        },
        "turnoverPoints": {
            "category": "defensive",
            "espn_name": "turnoverPoints",
            "stat_iteration_type": "additive"
        },
        "blocks": {
            "category": "defensive",
            "espn_name": "blocks",
            "stat_iteration_type": "additive"
        },
        "avgBlocks": {
            "category": "defensive",
            "espn_name": "avgBlocks",
            "stat_iteration_type": "derived_average",
            "base_stat": "blocks"
        },
        "blockFoulRatio": {
            "category": "defensive",
            "espn_name": "blockFoulRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "blocks",
            "denominator": "fouls"
        },
        "fastBreakPoints": {
            "category": "offensive",
            "espn_name": "fastBreakPoints",
            "stat_iteration_type": "additive"
        },
    },
    "baseball_mlb": {
        "gamesPlayed": {
            "category": "batting",
            "espn_name": "gamesPlayed",
            "stat_iteration_type": "additive"
        },
        "strikeouts_pitching": {
            "category": "pitching",
            "espn_name": "strikeouts",
            "stat_iteration_type": "additive"
        },
        "strikeouts_batting": {
            "category": "batting",
            "espn_name": "strikeouts",
            "stat_iteration_type": "additive"
        },
        "hits": {
            "category": "batting",
            "espn_name": "hits",
            "stat_iteration_type": "additive"
        },
        "runs": {
            "category": "batting",
            "espn_name": "runs",
            "stat_iteration_type": "additive"
        },
        "atBats": {
            "category": "batting",
            "espn_name": "atBats",
            "stat_iteration_type": "additive"
        },
        "pitches": {
            "category": "pitching",
            "espn_name": "pitches",
            "stat_iteration_type": "additive"
        },
        "plateAppearances": {
            "category": "batting",
            "espn_name": "plateAppearances",
            "stat_iteration_type": "additive"
        },
        "runsCreated": {
            "category": "batting",
            "espn_name": "runsCreated",
            "stat_iteration_type": "special_rate",
            "runs": "runs",
            "totalBases": "totalBases",
            "walks": "walks",
            "atBats": "atBats"
        },
        "pitchesPerPlateAppearance": {
            "category": "batting",
            "espn_name": "pitchesPerPlateAppearance",
            "stat_iteration_type": "derived_rate",
            "numerator": "pitches",
            "denominator": "plateAppearances"
        },
        "MLBRating": {
            "category": "batting",
            "espn_name": "MLBRating",
            "stat_iteration_type": "snapshot"
        },
        "groundBalls": {
            "category": "pitching",
            "espn_name": "groundBalls",
            "stat_iteration_type": "additive"
        },
        "flyBalls": {
            "category": "pitching",
            "espn_name": "flyBalls",
            "stat_iteration_type": "additive"
        },
        "groundBalls_batting": {
            "category": "batting",
            "espn_name": "groundBalls",
            "stat_iteration_type": "additive"
        },
        "flyBalls_batting": {
            "category": "batting",
            "espn_name": "flyBalls",
            "stat_iteration_type": "additive"
        },
        "battersFaced": {
            "category": "pitching",
            "espn_name": "battersFaced",
            "stat_iteration_type": "additive"
        },
        "thirdInnings": {
            "category": "pitching",
            "espn_name": "thirdInnings",
            "stat_iteration_type": "additive"
        },
        "gamesStarted": {
            "category": "pitching",
            "espn_name": "gamesStarted",
            "stat_iteration_type": "additive"
        },
        "fullInnings": {
            "category": "pitching",
            "espn_name": "fullInnings",
            "stat_iteration_type": "additive"
        },
        "innings": {
            "category": "pitching",
            "espn_name": "innings",
            "stat_iteration_type": "additive"
        },
        "groundToFlyRatio": {
            "category": "pitching",
            "espn_name": "groundToFlyRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "groundBalls",
            "denominator": "flyBalls"
        },
        "groundToFlyRatio_batting": {
            "category": "batting",
            "espn_name": "groundToFlyRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "groundBalls_batting",
            "denominator": "flyBalls_batting"
        },
        "pitchesPerInning": {
            "category": "pitching",
            "espn_name": "pitchesPerInning",
            "stat_iteration_type": "derived_rate",
            "numerator": "pitches",
            "denominator": "innings"
        },
        "BIPA": {
            "category": "batting",
            "espn_name": "BIPA",
            "stat_iteration_type": "special_rate",
            "hits": "hits",
            "walks": "walks",
            "hitByPitch": "hitByPitch",
            "battersFaced": "battersFaced"
        },
        "strikes": {
            "category": "pitching",
            "espn_name": "strikes",
            "stat_iteration_type": "additive"
        },
        "putouts": {
            "category": "fielding",
            "espn_name": "putouts",
            "stat_iteration_type": "additive"
        },
        "successfulChances": {
            "category": "fielding",
            "espn_name": "successfulChances",
            "stat_iteration_type": "additive"
        },
        "totalChances": {
            "category": "fielding",
            "espn_name": "totalChances",
            "stat_iteration_type": "additive"
        },
        "fieldingPct": {
            "category": "fielding",
            "espn_name": "fieldingPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "successfulChances",
            "denominator": "totalChances"
        },
        "onBasePct": {
            "category": "batting",
            "espn_name": "onBasePct",
            "stat_iteration_type": "special_rate",
            "hits": "hits",
            "walks": "walks",
            "hitByPitch": "hitByPitch",
            "plateAppearances": "plateAppearances"
        },
        "OPS": {
            "category": "batting",
            "espn_name": "OPS",
            "stat_iteration_type": "special_rate",
            "onBasePct": "onBasePct",
            "slugAvg": "slugAvg"
        },
        "patienceRatio": {
            "category": "batting",
            "espn_name": "patienceRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "walks",
            "denominator": "strikeouts_batting"
        },
        "opponentOnBasePct": {
            "category": "pitching",
            "espn_name": "opponentOnBasePct",
            "stat_iteration_type": "snapshot"
        },
        "opponentOPS": {
            "category": "pitching",
            "espn_name": "opponentOPS",
            "stat_iteration_type": "snapshot"
        },
        "runnersLeftOnBase": {
            "category": "batting",
            "espn_name": "runnersLeftOnBase",
            "stat_iteration_type": "additive"
        },
        "WHIP": {
            "category": "pitching",
            "espn_name": "WHIP",
            "stat_iteration_type": "special_rate",
            "walks": "walks",
            "hits": "hits",
            "innings": "innings"
        },
        "assists": {
            "category": "fielding",
            "espn_name": "assists",
            "stat_iteration_type": "additive"
        },
        "strikeoutsPerNineInnings": {
            "category": "pitching",
            "espn_name": "strikeoutsPerNineInnings",
            "stat_iteration_type": "special_rate",
            "srikeouts": "strikeouts_pitching",
            "innings": "innings"
        },
        "batterRating": {
            "category": "batting",
            "espn_name": "batterRating",
            "stat_iteration_type": "snapshot"
        },
        "totalBases": {
            "category": "batting",
            "espn_name": "totalBases",
            "stat_iteration_type": "additive"
        },
        "avg": {
            "category": "batting",
            "espn_name": "avg",
            "stat_iteration_type": "derived_rate",
            "numerator": "hits",
            "denominator": "atBats"
        },
        "slugAvg": {
            "category": "batting",
            "espn_name": "slugAvg",
            "stat_iteration_type": "derived_rate",
            "numerator": "totalBases",
            "denominator": "atBats"
        },
        "opponentTotalBases": {
            "category": "pitching",
            "espn_name": "opponentTotalBases",
            "stat_iteration_type": "additive"
        },
        "opponentAvg": {
            "category": "pitching",
            "espn_name": "opponentAvg",
            "stat_iteration_type": "snapshot"
        },
        "opponentSlugAvg": {
            "category": "pitching",
            "espn_name": "opponentSlugAvg",
            "stat_iteration_type": "snapshot"
        },
        "walks": {
            "category": "pitching",
            "espn_name": "walks",
            "stat_iteration_type": "additive"
        },
        "walks_batting": {
            "category": "batting",
            "espn_name": "walks",
            "stat_iteration_type": "additive"
        },
        "RBIs": {
            "category": "batting",
            "espn_name": "RBIs",
            "stat_iteration_type": "additive"
        },
        "doubles": {
            "category": "batting",
            "espn_name": "doubles",
            "stat_iteration_type": "additive"
        },
        "walksPerPlateAppearance": {
            "category": "batting",
            "espn_name": "walksPerPlateAppearance",
            "stat_iteration_type": "derived_rate",
            "numerator": "walks",
            "denominator": "plateAppearances"
        },
        "walkToStrikeoutRatio": {
            "category": "batting",
            "espn_name": "walkToStrikeoutRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "walks_batting",
            "denominator": "strikeouts_batting"
        },
        "strikeoutToWalkRatio": {
            "category": "pitching",
            "espn_name": "strikeoutToWalkRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "strikeouts_pitching",
            "denominator": "walks"
        },
        "runsProduced": {
            "category": "batting",
            "espn_name": "runsProduced",
            "stat_iteration_type": "special_rate",
            "runs": "runs",
            "RBIs": "RBIs",
            "gamesPlayed": "gamesPlayed"
        },
        "extraBaseHits": {
            "category": "batting",
            "espn_name": "extraBaseHits",
            "stat_iteration_type": "special_rate",
            "doubles": "doubles",
            "triples": "triples",
            "homeRuns": "homeRuns"
        },
        "isolatedPower": {
            "category": "batting",
            "espn_name": "isolatedPower",
            "stat_iteration_type": "derived_rate",
            "numerator": "extraBaseHits",
            "denominator": "atBats"
        },
        "earnedRuns": {
            "category": "pitching",
            "espn_name": "earnedRuns",
            "stat_iteration_type": "additive"
        },
        "ERA": {
            "category": "pitching",
            "espn_name": "ERA",
            "stat_iteration_type": "special_rate",
            "earnedRuns": "earnedRuns",
            "innings": "innings",
        },
        "teamEarnedRuns": {
            "category": "pitching",
            "espn_name": "teamEarnedRuns",
            "stat_iteration_type": "additive"
        },
        "pitchCount": {
            "category": "pitching",
            "espn_name": "pitchCount",
            "stat_iteration_type": "additive"
        },
        "strikePitchRatio": {
            "category": "pitching",
            "espn_name": "strikePitchRatio",
            "stat_iteration_type": "derived_rate",
            "numerator": "strikes",
            "denominator": "pitches"
        },
        "finishes": {
            "category": "pitching",
            "espn_name": "finishes",
            "stat_iteration_type": "additive"
        },
        "pitchesAsStarter": {
            "category": "pitching",
            "espn_name": "pitchesAsStarter",
            "stat_iteration_type": "additive"
        },
        "pitchesPerStart": {
            "category": "pitching",
            "espn_name": "pitchesPerStart",
            "stat_iteration_type": "derived_rate",
            "numerator": "pitches",
            "denominator": "pitchesAsStarter"
        },
        "homeRuns": {
            "category": "batting",
            "espn_name": "homeRuns",
            "stat_iteration_type": "additive"
        },
        "homeRuns_pitching": {
            "category": "pitching",
            "espn_name": "homeRuns",
            "stat_iteration_type": "additive"
        },
        "outsOnField": {
            "category": "fielding",
            "espn_name": "outsOnField",
            "stat_iteration_type": "special_rate",
            "innings": "innings",
            "strikeouts_pitching": "strikeouts_pitching"
        },
        "rangeFactor": {
            "category": "fielding",
            "espn_name": "rangeFactor",
            "stat_iteration_type": "special_rate",
            "putouts": "putouts",
            "assists": "assists",
            "innings": "innings"
        },
        "catcherThirdInningsPlayed": {
            "category": "fielding",
            "espn_name": "catcherThirdInningsPlayed",
            "stat_iteration_type": "additive"
        },
        "runSupport": {
            "category": "pitching",
            "espn_name": "runSupport",
            "stat_iteration_type": "additive"
        },
        "runSupportAvg": {
            "category": "pitching",
            "espn_name": "runSupportAvg",
            "stat_iteration_type": "derived_average",
            "base_stat": "runSupport"
        },
        "atBatsPerHomeRun": {
            "category": "batting",
            "espn_name": "atBatsPerHomeRun",
            "stat_iteration_type": "derived_rate",
            "numerator": "atBats",
            "denominator": "homeRuns"
        },
        "stolenBases": {
            "category": "batting",
            "espn_name": "stolenBases",
            "stat_iteration_type": "additive"
        },
        "hitByPitch": {
            "category": "batting",
            "espn_name": "hitByPitch",
            "stat_iteration_type": "additive"
        },
        "doublePlays": {
            "category": "fielding",
            "espn_name": "doublePlays",
            "stat_iteration_type": "additive"
        },
        "inheritedRunners": {
            "category": "pitching",
            "espn_name": "inheritedRunners",
            "stat_iteration_type": "additive"
        },
        "GIDPs": {
            "category": "batting",
            "espn_name": "GIDPs",
            "stat_iteration_type": "additive"
        },
        "losses": {
            "category": "pitching",
            "espn_name": "losses",
            "stat_iteration_type": "additive"
        },
        "wins": {
            "category": "pitching",
            "espn_name": "wins",
            "stat_iteration_type": "additive"
        },
        "winPct": {
            "category": "pitching",
            "espn_name": "winPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "wins",
            "denominator": "gamesPlayed"
        },
        "runsCreatedPer27Outs": {
            "category": "batting",
            "espn_name": "runsCreatedPer27Outs",
            "stat_iteration_type": "special_rate",
            "runsCreated": "runsCreated",
            "outsOnField": "outsOnField"
        },
    },
    "icehockey_nhl": {
        "shotsAgainst": {
            "category": "defensive",
            "espn_name": "shotsAgainst",
            "stat_iteration_type": "additive"
        },
        "saves": {
            "category": "defensive",
            "espn_name": "saves",
            "stat_iteration_type": "additive"
        },
        "savePct": {
            "category": "defensive",
            "espn_name": "savePct",
            "stat_iteration_type": "derived_rate",
            "numerator": "saves",
            "denominator": "shotsAgainst"
        },
        "blockedShots": {
            "category": "defensive",
            "espn_name": "blockedShots",
            "stat_iteration_type": "additive"
        },
        "hits": {
            "category": "defensive",
            "espn_name": "hits",
            "stat_iteration_type": "additive"
        },
        "shifts": {
            "category": "general",
            "espn_name": "shifts",
            "stat_iteration_type": "additive"
        },
        "shotsTotal": {
            "category": "offensive",
            "espn_name": "shotsTotal",
            "stat_iteration_type": "additive"
        },
        "shotsMissed": {
            "category": "offensive",
            "espn_name": "shotsMissed",
            "stat_iteration_type": "additive"
        },
        "pointsPerGame": {
            "category": "offensive",
            "espn_name": "pointsPerGame",
            "stat_iteration_type": "derived_average",
            "base_stat": "points"
        },
        "totalFaceOffs": {
            "category": "offensive",
            "espn_name": "totalFaceOffs",
            "stat_iteration_type": "additive"
        },
        "faceoffsWon": {
            "category": "offensive",
            "espn_name": "faceoffsWon",
            "stat_iteration_type": "additive"
        },
        "faceoffsLost": {
            "category": "offensive",
            "espn_name": "faceoffsLost",
            "stat_iteration_type": "additive"
        },
        "faceoffPercent": {
            "category": "offensive",
            "espn_name": "faceoffPercent",
            "stat_iteration_type": "derived_rate",
            "numerator": "faceoffsWon",
            "denominator": "totalFaceOffs"
        },
        "shotsIn1stPeriod": {
            "category": "offensive",
            "espn_name": "shotsIn1stPeriod",
            "stat_iteration_type": "additive"
        },
        "shotsIn2ndPeriod": {
            "category": "offensive",
            "espn_name": "shotsIn2ndPeriod",
            "stat_iteration_type": "additive"
        },
        "shotsIn3rdPeriod": {
            "category": "offensive",
            "espn_name": "shotsIn3rdPeriod",
            "stat_iteration_type": "additive"
        },
        "giveaways": {
            "category": "offensive",
            "espn_name": "giveaways",
            "stat_iteration_type": "additive"
        },
        "takeaways": {
            "category": "defensive",
            "espn_name": "takeaways",
            "stat_iteration_type": "additive"
        },
        "penalties": {
            "category": "penalties",
            "espn_name": "penalties",
            "stat_iteration_type": "additive"
        },
        "penaltyMinutes": {
            "category": "penalties",
            "espn_name": "penaltyMinutes",
            "stat_iteration_type": "additive"
        },
        "timesShortHanded": {
            "category": "defensive",
            "espn_name": "timesShortHanded",
            "stat_iteration_type": "additive"
        },
        "powerPlayOpportunities": {
            "category": "offensive",
            "espn_name": "powerPlayOpportunities",
            "stat_iteration_type": "additive"
        },
        "shotDifferential": {
            "category": "general",
            "espn_name": "shotDifferential",
            "stat_iteration_type": "derived_rate",
            "numerator": "shotsTotal",
            "denominator": "shotsAgainst"
        },
        "goalsAgainst": {
            "category": "defensive",
            "espn_name": "goalsAgainst",
            "stat_iteration_type": "additive"
        },
        "points": {
            "category": "offensive",
            "espn_name": "points",
            "stat_iteration_type": "additive"
        },
        "goals": {
            "category": "offensive",
            "espn_name": "goals",
            "stat_iteration_type": "additive"
        },
        "shootingPct": {
            "category": "offensive",
            "espn_name": "shootingPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "goals",
            "denominator": "shotsTotal"
        },
        "penaltyKillPct": {
            "category": "defensive",
            "espn_name": "penaltyKillPct",
            "stat_iteration_type": "special_rate",
            "numerator_one": "timesShortHanded",
            "numerator_two": "powerPlayGoalsAgainst",
            "denominator": "timesShortHanded",
        },
        "assists": {
            "category": "offensive",
            "espn_name": "assists",
            "stat_iteration_type": "additive"
        },
        "goalDifferential": {
            "category": "general",
            "espn_name": "goalDifferential",
            "stat_iteration_type": "derived_rate",
            "numerator": "goals",
            "denominator": "goalsAgainst"
        },
        "PIMDifferential": {
            "category": "general",
            "espn_name": "PIMDifferential",
            "stat_iteration_type": "derived_rate",
            "numerator": "penaltyMinutes",
            "denominator": "penalties"
        },
        "powerPlayAssists": {
            "category": "offensive",
            "espn_name": "powerPlayAssists",
            "stat_iteration_type": "additive"
        },
        "powerPlayGoalsAgainst": {
            "category": "defensive",
            "espn_name": "powerPlayGoalsAgainst",
            "stat_iteration_type": "additive"
        },
        "powerPlayGoals": {
            "category": "offensive",
            "espn_name": "powerPlayGoals",
            "stat_iteration_type": "additive"
        },
        "powerPlayPct": {
            "category": "offensive",
            "espn_name": "powerPlayPct",
            "stat_iteration_type": "derived_rate",
            "numerator": "powerPlayGoals",
            "denominator": "powerPlayOpportunities"
        }
    },
}