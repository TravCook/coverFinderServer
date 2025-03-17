const pastGameStatsPoC = async () => {
    let pastYears = [
        // '2024', '2023',
        '2022',
        '2021'
    ]

    let statMap = {}
    for (const year of pastYears) {
        for (const sport of sports) {
            let teams = [];

            // Get teams from the database based on the sport
            switch (sport.name) {
                case 'americanfootball_nfl':
                case 'americanfootball_ncaaf':
                    teams = await UsaFootballTeam.find({ league: sport.league }).lean();
                    statMap = {
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
                    }
                    break;
                case 'basketball_nba':
                case 'basketball_ncaab':
                case 'basketball_wncaab':
                    teams = await BasketballTeam.find({ league: sport.league }).lean();
                    statMap = {        //------------------------------------BASKETBALL STATS--------------------------------------------------------------
                        'points': [{ modelField: 'BSKBtotalPoints', category: 'offensive' }],
                        'avgPoints': [{ modelField: 'BSKBpointsPerGame', category: 'offensive', isPerGame: true }],

                        'avgAssists': [{ modelField: 'BSKBassistsPerGame', category: 'offensive', isPerGame: true }],
                        'assistRatio': [{ modelField: 'BSKBassistRatio', category: 'offensive' }],
                        'effectiveFGPct': [{ modelField: 'BSKBeffectiveFgPercent', category: 'offensive' }],
                        'fieldGoalPct': [{ modelField: 'BSKBfieldGoalPercent', category: 'offensive' }],
                        'fieldGoalsAttempted': [{ modelField: 'BSKBfieldGoalsAttempted', category: 'offensive' }],
                        'fieldGoalsMade': [{ modelField: 'BSKBfieldGoalsMade', category: 'offensive' }],
                        'avgFieldGoalsMade': [{ modelField: 'BSKBfieldGoalsPerGame', category: 'offensive', isPerGame: true }],
                        'freeThrowPct': [{ modelField: 'BSKBfreeThrowPercent', category: 'offensive' }],
                        'freeThrowsAttempted': [{ modelField: 'BSKBfreeThrowsAttempted', category: 'offensive' }],
                        'freeThrowsMade': [{ modelField: 'BSKBfreeThrowsMade', category: 'offensive' }],
                        'avgFreeThrowsMade': [{ modelField: 'BSKBfreeThrowsMadePerGame', category: 'offensive', isPerGame: true }],
                        'offensiveRebounds': [{ modelField: 'BSKBoffensiveRebounds', category: 'offensive' }],
                        'avgOffensiveRebounds': [{ modelField: 'BSKBoffensiveReboundsPerGame', category: 'offensive', isPerGame: true }],
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
                        'avgBlocks': [{ modelField: 'BSKBblocksPerGame', category: 'defensive', isPerGame: true }],
                        'defensiveRebounds': [{ modelField: 'BSKBdefensiveRebounds', category: 'defensive' }],
                        'avgDefensiveRebounds': [{ modelField: 'BSKBdefensiveReboundsPerGame', category: 'defensive', isPerGame: true }],
                        'steals': [{ modelField: 'BSKBsteals', category: 'defensive' }],
                        'avgSteals': [{ modelField: 'BSKBstealsPerGame', category: 'defensive' }],
                        'reboundRate': [{ modelField: 'BSKBreboundRate', category: 'general' }],
                        'avgRebounds': [{ modelField: 'BSKBreboundsPerGame', category: 'general', isPerGame: true }],
                        'avgFouls': [{ modelField: 'BSKBfoulsPerGame', category: 'general', isPerGame: true }],
                        'assistTurnoverRatio': [{ modelField: 'BSKBteamAssistToTurnoverRatio', category: 'general' }],
                        'assists': [
                            { modelField: 'BSKBassists', category: 'offensive' }
                        ]
                    }
                    break;
                case 'icehockey_nhl':
                    teams = await HockeyTeam.find({ league: sport.league }).lean();
                    statMap = {
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
                        'savePct': [
                            { modelField: 'HKYsavePct', category: 'defensive' }
                        ],
                        'saves': [
                            { modelField: 'HKYsaves', category: 'defensive' },
                            { modelField: 'HKYsavesPerGame', isPerGame: true, category: 'defensive' },
                        ],
                        'shutouts': [
                            { modelField: 'HKYshutouts', category: 'defensive' }
                        ],
                        'hits': [
                            { modelField: 'HKYhits', category: 'defensive' },
                            { modelField: 'HKYhitsPerGame', isPerGame: true, category: 'defensive' }
                        ],
                        'assists': [
                            { modelField: 'HKYassists', category: 'offensive' },
                            { modelField: 'HKYassistsPerGame', isPerGame: true, category: 'offensive' },
                        ]
                    }
                    break;
                case 'baseball_mlb':
                    teams = await BaseballTeam.find({ league: sport.league }).lean();
                    statMap = {
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
                        'savePct': [
                            { modelField: 'BSBsavePct', category: 'pitching' }
                        ],
                        'saves': [
                            { modelField: 'BSBsaves', category: 'pitching' }
                        ],
                        'shutouts': [
                            { modelField: 'BSBshutouts', category: 'pitching' }
                        ],
                        'hits': [
                            { modelField: 'BSBHitsTotal', category: 'batting' },
                            { modelField: 'BSBhitsGivenUp', category: 'pitching' },
                        ],
                        'assists': [
                            { modelField: 'BSBassists', category: 'fielding' }
                        ]
                    }
                    break;
            }

            let doneGames = [];
            let upcomingGames = [];

            // Helper function to increment win/loss record
            function incrementWinLoss(winLossStr, isWin) {
                let [wins, losses] = winLossStr.split('-').map(Number);

                if (isWin) {
                    wins += 1;
                } else {
                    losses += 1;
                }

                return `${wins}-${losses}`;
            }
            // Reset stats for teams before processing new data
            for (let team of teams) {
                // Initialize win/loss records if they don't exist
                team.stats.seasonWinLoss = team.stats.seasonWinLoss || "0-0";
                team.stats.homeWinLoss = team.stats.homeWinLoss || "0-0";
                team.stats.awayWinLoss = team.stats.awayWinLoss || "0-0";
                team.stats.pointDiff = team.stats.pointDiff || 0;

                // Reset individual stat counters (this part is assuming stats need to be reset for each team)
                if (Object.keys(team.stats).length > 0) {
                    for (const stat in team.stats) {
                        if (stat !== 'seasonWinLoss' && stat !== 'homeWinLoss' && stat !== 'awayWinLoss' && stat !== 'pointDiff') {
                            team.stats[stat] = 0;
                        }
                    }
                }
            }

            for (let team of teams) {
                let oldTeamSched;
                let oldTeamSchedJSON;

                // Get the team's schedule based on sport and year
                if ((sport.name === 'americanfootball_nfl' || sport.name === 'americanfootball_ncaaf') && year === '2024') {
                    // oldTeamSched = await fetch(...); // Get the schedule (not used in this version)
                } else {
                    oldTeamSched = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.espnSport}/${sport.league}/teams/${team.espnID}/schedule?season=${year}`);
                    // if (!oldTeamSched.ok) {
                    //     console.error(`Error: Received status code ${oldTeamSched.status}`);
                    //     const errorText = await oldTeamSched.text();  // Log the error content (HTML or other)
                    //     console.error("Error response body:", errorText);
                    // }
                    oldTeamSchedJSON = await oldTeamSched.json();
                }

                // Process each event from the team's schedule
                if (oldTeamSchedJSON !== undefined) {
                    for (const event of oldTeamSchedJSON.events) {
                        if (event.competitions[0].competitors[0].score && event.competitions[0].competitors[1].score) {
                            upcomingGames.push(event);
                        }

                    }
                }
            }

            // Sort upcoming games by date
            if (upcomingGames.length > 0) {
                upcomingGames.sort((a, b) => new Date(a.date) - new Date(b.date));

                // Loop through each event
                for (const event of upcomingGames) {
                    let homeTeam, awayTeam;
                    let homeScore, awayScore;
                    let gameWinner;
                    try {
                        // Check if the game has already been processed
                        if (!doneGames.some((game) => game.id === event.id)) {
                            // Loop through competitors in the event
                            for (const competitor of event.competitions[0].competitors) {
                                if (competitor.homeAway === 'home') {
                                    homeTeam = teams.find(t => t.espnID === competitor.id);
                                    if (sport.espnSport === 'hockey') {
                                        if (competitor.id === '24') {
                                            homeTeam = teams.find(t => t.espnID === '129764');
                                        }
                                    }
                                    homeScore = competitor.score.value;

                                    // Fetch stats for the event
                                    const oldEvent = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/events/${event.id}/competitions/${event.id}/competitors/${competitor.id}/statistics`);

                                    // if (!oldEvent.ok) {
                                    //     console.error(`Error: Received status code ${oldEvent.status}`);
                                    //     const errorText = await oldEvent.text();  // Log the error content (HTML or other)
                                    //     console.error("Error response body:", errorText);
                                    // }
                                    const oldEventJSON = await oldEvent.json();
                                    if (homeTeam != undefined) {
                                        // Process stats
                                        if (oldEventJSON.splits) {
                                            for (const category of oldEventJSON.splits.categories) {
                                                for (const stat of category.stats) {
                                                    if (statMap[stat.name]) {
                                                        for (const statInfo of statMap[stat.name]) {
                                                            const statKey = statInfo.modelField;
                                                            if (category.name === statInfo.category) {
                                                                if (statInfo.isPerGame || statInfo.isDisplayValue) {
                                                                    homeTeam.stats[statKey] = stat.value === null || stat.value === undefined ? 0 : stat.value;
                                                                } else {
                                                                    homeTeam.stats[statKey] = (homeTeam.stats[statKey] || 0) + (stat.value === null || stat.value === undefined ? 0 : stat.value);
                                                                }
                                                            }

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                } else {
                                    awayTeam = teams.find(t => t.espnID === competitor.id);
                                    if (sport.espnSport === 'hockey') {
                                        if (competitor.id === '24') {
                                            awayTeam = teams.find(t => t.espnID === '129764');
                                        }
                                    }
                                    awayScore = competitor.score.value;

                                    // Fetch stats for the event
                                    const oldEvent = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/events/${event.id}/competitions/${event.id}/competitors/${competitor.id}/statistics`);
                                    // if (!oldEvent.ok) {
                                    //     console.error(`Error: Received status code ${oldEvent.status}`);
                                    //     const errorText = await oldEvent.text();  // Log the error content (HTML or other)
                                    //     console.error("Error response body:", errorText);
                                    // }
                                    const oldEventJSON = await oldEvent.json();
                                    if (awayTeam != undefined) {
                                        // Process stats
                                        if (oldEventJSON.splits) {
                                            for (const category of oldEventJSON.splits.categories) {
                                                for (const stat of category.stats) {
                                                    if (statMap[stat.name]) {
                                                        for (const statInfo of statMap[stat.name]) {
                                                            const statKey = statInfo.modelField;
                                                            // Accumulate stats for the away team
                                                            if (category.name === statInfo.category) {
                                                                if (statInfo.isPerGame || statInfo.isDisplayValue) {
                                                                    awayTeam.stats[statKey] = stat.value === null || stat.value === undefined ? 0 : stat.value;
                                                                } else {
                                                                    awayTeam.stats[statKey] = (awayTeam.stats[statKey] || 0) + (stat.value === null || stat.value === undefined ? 0 : stat.value);
                                                                }
                                                            }

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                }
                            }

                            // Determine game winner
                            if (homeScore > awayScore) {
                                gameWinner = 'home'
                            } else if (awayScore > homeScore) {
                                gameWinner = 'away'
                            }

                            // Update win/loss and point difference only once, after determining the winner
                            if (gameWinner === 'home' && homeTeam && awayTeam) {
                                // Home team wins
                                homeTeam.stats.seasonWinLoss = incrementWinLoss(homeTeam.stats.seasonWinLoss, true);  // Increment wins for home
                                homeTeam.stats.homeWinLoss = incrementWinLoss(homeTeam.stats.homeWinLoss, true);      // Increment home wins for home
                                homeTeam.stats.pointDiff = (homeTeam.stats.pointDiff || 0) + (homeScore - awayScore); // Update point difference for home

                                awayTeam.stats.seasonWinLoss = incrementWinLoss(awayTeam.stats.seasonWinLoss, false); // Increment losses for away
                                awayTeam.stats.awayWinLoss = incrementWinLoss(awayTeam.stats.awayWinLoss, false);     // Increment away losses for away
                                awayTeam.stats.pointDiff = (awayTeam.stats.pointDiff || 0) + (awayScore - homeScore); // Update point difference for away
                            } else if (gameWinner === 'away' && homeTeam && awayTeam) {
                                // Away team wins
                                awayTeam.stats.seasonWinLoss = incrementWinLoss(awayTeam.stats.seasonWinLoss, true);  // Increment wins for away
                                awayTeam.stats.awayWinLoss = incrementWinLoss(awayTeam.stats.awayWinLoss, true);      // Increment away wins for away
                                awayTeam.stats.pointDiff = (awayTeam.stats.pointDiff || 0) + (awayScore - homeScore); // Update point difference for away

                                homeTeam.stats.seasonWinLoss = incrementWinLoss(homeTeam.stats.seasonWinLoss, false); // Increment losses for home
                                homeTeam.stats.homeWinLoss = incrementWinLoss(homeTeam.stats.homeWinLoss, false);     // Increment home losses for home
                                homeTeam.stats.pointDiff = (homeTeam.stats.pointDiff || 0) + (homeScore - awayScore); // Update point difference for home
                            }

                            if (event.id === "401423177") {
                                console.log({
                                    id: event.id,
                                    sport_key: sport.name,
                                    sport_title: sport.league,
                                    commence_time: event.date,
                                    home_team: homeTeam.espnDisplayName,
                                    away_team: awayTeam.espnDisplayName,
                                    awayTeamAbbr: awayTeam.abbreviation,
                                    homeTeamAbbr: homeTeam.abbreviation,
                                    homeTeamlogo: homeTeam.logo,
                                    awayTeamlogo: awayTeam.logo,
                                    homeTeamShort: homeTeam.teamName,
                                    awayTeamShort: awayTeam.teamName,
                                    sport: sport.espnSport,
                                    winner: gameWinner || 'draw',
                                    homeScore: homeScore,
                                    awayScore: awayScore,
                                    homeTeamStats: homeTeam.stats,
                                    awayTeamStats: awayTeam.stats,
                                    predictionCorrect: false
                                })
                            }

                            if (homeTeam && awayTeam && (homeScore !== undefined && homeScore !== null) && (awayScore !== undefined && awayScore !== null)) {
                                // Use findOneAndUpdate to either update or create the game odds record
                                try {
                                    await PastGameOdds.findOneAndUpdate(
                                        { id: event.id },  // Match on event ID
                                        {
                                            $set: {
                                                id: event.id,
                                                sport_key: sport.name,
                                                sport_title: sport.league,
                                                commence_time: event.date,
                                                home_team: homeTeam.espnDisplayName,
                                                away_team: awayTeam.espnDisplayName,
                                                awayTeamAbbr: awayTeam.abbreviation,
                                                homeTeamAbbr: homeTeam.abbreviation,
                                                homeTeamShort: homeTeam.teamName,
                                                awayTeamShort: awayTeam.teamName,
                                                homeTeamlogo: homeTeam.logo,
                                                awayTeamlogo: awayTeam.logo,
                                                sport: sport.espnSport,
                                                winner: gameWinner || 'draw',
                                                homeScore: homeScore,
                                                awayScore: awayScore,
                                                homeTeamStats: homeTeam.stats,
                                                awayTeamStats: awayTeam.stats,
                                                predictionCorrect: false
                                            }
                                        },
                                        { upsert: true }  // If not found, insert a new document
                                    );
                                } catch (err) {
                                    console.log(err)
                                }

                            }


                            // Mark the game as done
                            doneGames.push({ id: event.id, date: event.date });
                        }
                    } catch (err) {
                        console.log(event.id)
                        console.log(err)
                    }

                }
            }
            console.log(`${year} ${sport.league} finished @ ${new Date().toLocaleString()}`)
        }
        console.log(`${year} finished @ ${new Date().toLocaleString()}`)
    }



}

module.exports = { pastGameStatsPoC }