require('dotenv').config()
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../models');
const axios = require('axios')
const moment = require('moment')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const { emitToClients } = require('../socketManager');
const pastGameOdds = require('../models/pastGameOdds');

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs
let nflWeights = []
let nbaWeights = []
let mlbWeights = []
let nhlWeights = []
let ncaafWeights = []
let ncaamWeights = []
let ncaawWeights = []

const retrieveTeamsandStats = async () => {

    for (let i = 0; i < sports.length; i++) {
        let TeamModel;
        switch (sports[i].espnSport) {
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
                console.error("Unsupported sport:", sports[i].espnSport);
                return;
        }
        let teams
        teams = await TeamModel.find({})
        // Helper function to get the team record URL based on the current month
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

        const upsertTeamsInBulk = async (teams, sport) => {

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
                await TeamModel.bulkWrite(bulkOps);
            }
        };

        const fetchAllTeamData = async (sport, teams, statYear) => {

            const fetchTeamData = async (team, sport) => {
                try {
                    // Fetch team record
                    const teamRecordUrl = getTeamRecordUrl(moment().format('M'), sport.startMonth, sport.endMonth, sport.espnSport, sport.league, sport.statYear, team.espnID);
                    const teamRecordResponse = await fetch(teamRecordUrl);
                    const teamRecordJson = await teamRecordResponse.json();
                    updateTeamRecord(team, teamRecordJson);

                    // Fetch team stats
                    const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/seasons/${statYear}/types/2/teams/${team.espnID}/statistics?lang=en&region=us`, { signal: AbortSignal.timeout(10000) });
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
                    }).sort({ commence_time: -1, winPercent: 1 })
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
                            }
                        }

                    })
                    return team;  // Return the updated team
                } catch (error) {
                    console.log(`Error fetching data for team ${team.espnID}:`, error);
                }
            };

            const MAX_CONCURRENT_REQUESTS = 25; // You can adjust this number to control concurrency
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
                        await upsertTeamsInBulk(filteredResults, sport);
                        promises.length = 0; // Clear the array after waiting for requests to resolve
                    }
                }

                // After all requests have been processed, make sure to upsert the remaining teams
                if (promises.length > 0) {
                    const results = await Promise.all(promises);
                    const filteredResults = results.filter(result => result !== undefined);
                    await upsertTeamsInBulk(filteredResults, sport);
                }

            } catch (error) {
                console.error("Error fetching or processing team data:", error);
            }
        };
        fetchAllTeamData(sports[i], teams, sports[i].statYear)
    }


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
const removePastGames = async (currentOdds) => {
    for (let game of currentOdds) {

        // Check if the game is in the past based on commence_time
        if (moment(game.commence_time).local().isBefore(moment().local())) {
            let { _id, ...newGame } = game._doc;

            if (game.sport === 'football') {
                if (game.sport_key === 'americanfootball_nfl') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'americanfootball_ncaaf') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.away_team
                    });
                }
                homeTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'baseball') {
                homeTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'basketball') {
                if (game.sport_key === 'basketball_nba') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_ncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_wncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                }
            } else if (game.sport === 'hockey') {
                homeTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.away_team });
            }


            const controller = new AbortController();  // Create the AbortController
            const signal = controller.signal;          // Get the signal from the controller
            if (homeTeam && awayTeam) {
                try {
                    // Fetch home team schedule from ESPN API
                    let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`, { signal }, timeout = 10000);
                    let homeTeamSchedJSON = await homeTeamSchedule.json();
                    // Loop through events in the home team schedule
                    for (let event of homeTeamSchedJSON.events) {

                        // Check if the event matches the current game's date
                        if ((event.name === `${awayTeam.espnDisplayName} at ${homeTeam.espnDisplayName}` || event.shortName === `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`) && moment(event.date).isSame(moment(game.commence_time), 'day')) {
                            if (event.competitions[0].status.type.completed === true) {
                                let homeScore, awayScore, predictionCorrect, winner
                                // Determine the scores and winner
                                event.competitions[0].competitors.forEach((team) => {
                                    if (team.homeAway === 'home') {
                                        homeScore = team.score.value; // home score
                                    } else if (team.homeAway === 'away') {
                                        awayScore = team.score.value; // away score
                                    }
                                });

                                // Determine winner
                                winner = homeScore > awayScore ? 'home' : 'away';

                                // Check if the prediction was correct
                                if (game.homeTeamIndex >= game.awayTeamIndex) {
                                    predictionCorrect = winner === 'home';
                                } else if (game.awayTeamIndex > game.homeTeamIndex) {
                                    predictionCorrect = winner === 'away';
                                }

                                let existingGame = await PastGameOdds.findOne({
                                    home_team: homeTeam.espnDisplayName,
                                    away_team: awayTeam.espnDisplayName,
                                    commence_time: game.commence_time
                                });
                                // Save the past game to the PastGameOdds collection
                                // Check if the game already exists in the PastGameOdds collection
                                if (!existingGame) {
                                    try {
                                        // Create a new record
                                        await PastGameOdds.create({
                                            ...newGame,
                                            homeScore,
                                            awayScore,
                                            winner,
                                            predictionCorrect: predictionCorrect ? predictionCorrect : false,
                                            homeTeamStats: cleanStats(getCommonStats(homeTeam)),
                                            awayTeamStats: cleanStats(getCommonStats(awayTeam)),
                                        });

                                        // Delete the game from the Odds collection
                                        let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                        if (deletedGame) {
                                            console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                            deletedGame = null;  // Nullify reference after use
                                        }
                                    } catch (error) {
                                        console.error("Error during database operation", error);
                                    }
                                } else {
                                    console.log('Game already exists in PastGameOdds');
                                    // Delete the game from the Odds collection
                                    let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                    if (deletedGame) {
                                        console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                    }
                                    deletedGame = null
                                }

                                existingGame = null
                            } else if (event.competitions[0].status.type.description === 'In Progress' || event.competitions[0].status.type.description === 'Halftime' || event.competitions[0].status.type.description === 'End of Period') {
                                let timeRemaining, homeScore, awayScore
                                let currentScoreboard = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/scoreboard`)
                                let scoreboardJSON = await currentScoreboard.json()
                                for (let SBevent of scoreboardJSON.events) {
                                    if (moment(SBevent.date).isSame(moment(game.commence_time), 'hour') && (SBevent.name === `${game.away_team} at ${game.home_team}` || SBevent.shortName === `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`)) {
                                        // Determine the scores and winner
                                        SBevent.competitions[0].competitors.forEach((team) => {
                                            if (team.homeAway === 'home') {
                                                homeScore = parseInt(team.score); // home score
                                            } else if (team.homeAway === 'away') {
                                                awayScore = parseInt(team.score); // away score
                                            }
                                        });

                                        timeRemaining = SBevent.competitions[0].status.type.shortDetail
                                        try {
                                            await Odds.findOneAndUpdate({ _id: game._doc._id }, {
                                                ...newGame,
                                                homeScore: homeScore,
                                                awayScore: awayScore,
                                                timeRemaining: timeRemaining,
                                            }, { new: true });

                                        } catch (error) {
                                            console.error('Error updating game:', error);
                                        }

                                    }


                                }
                            } else if (event.competitions[0].status.type.description === 'Postponed') {
                                // Delete the game from the Odds collection
                                let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                if (deletedGame) {
                                    console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                }
                                deletedGame = null
                            }
                        }
                    }
                } catch (err) {
                    console.log(game.id)
                    console.log(err); // Log any errors encountered during the API call or processing
                    controller.abort();
                }
            } else {
                console.log(game.id)
            }

            homeTeam = null
            awayTeam = null

        }
    }
}
const getStat = (stats, statName, fallbackValue = 0) => {
    return stats && stats[statName] !== undefined ? stats[statName] : fallbackValue;
};
// Helper function to calculate Win-Loss difference
const getWinLoss = (stats) => {
    if (stats && stats.seasonWinLoss) {
        const winLoss = stats.seasonWinLoss.split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in wins and losses
        }
    }
    return 0;
};
// Helper function to extract home/away win-loss
const getHomeAwayWinLoss = (stats, type) => {
    if (stats && stats[type]) {
        const winLoss = stats[type].split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in home/away win-loss
        }
    }
    return 0;
};
// Feature extraction per sport
function extractSportFeatures(homeStats, awayStats, league) {
    switch (league) {
        case 'americanfootball_nfl':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'USFBpointsPerGame') - getStat(awayStats, 'USFBpointsPerGame'),
                getStat(homeStats, 'USFBtotalPoints') - getStat(awayStats, 'USFBtotalPoints'),
                getStat(homeStats, 'USFBtotalTouchdowns') - getStat(awayStats, 'USFBtotalTouchdowns'),
                getStat(homeStats, 'USFBtouchdownsPerGame') - getStat(awayStats, 'USFBtouchdownsPerGame'),
                getStat(homeStats, 'USFBcompletionPercent') - getStat(awayStats, 'USFBcompletionPercent'),
                getStat(homeStats, 'USFBcompletions') - getStat(awayStats, 'USFBcompletions'),
                getStat(homeStats, 'USFBcompletionsPerGame') - getStat(awayStats, 'USFBcompletionsPerGame'),
                getStat(homeStats, 'USFBnetPassingYards') - getStat(awayStats, 'USFBnetPassingYards'),
                getStat(homeStats, 'USFBnetPassingYardsPerGame') - getStat(awayStats, 'USFBnetPassingYardsPerGame'),
                getStat(homeStats, 'USFBpassingFirstDowns') - getStat(awayStats, 'USFBpassingFirstDowns'),
                getStat(homeStats, 'USFBpassingTouchdowns') - getStat(awayStats, 'USFBpassingTouchdowns'),
                getStat(homeStats, 'USFBpassingYards') - getStat(awayStats, 'USFBpassingYards'),
                getStat(homeStats, 'USFBpassingYardsPerGame') - getStat(awayStats, 'USFBpassingYardsPerGame'),
                getStat(homeStats, 'USFBpassingAttempts') - getStat(awayStats, 'USFBpassingAttempts'),
                getStat(homeStats, 'USFBpassingAttemptsPerGame') - getStat(awayStats, 'USFBpassingAttemptsPerGame'),
                getStat(homeStats, 'USFByardsPerPassAttempt') - getStat(awayStats, 'USFByardsPerPassAttempt'),
                getStat(homeStats, 'USFBrushingAttempts') - getStat(awayStats, 'USFBrushingAttempts'),
                getStat(homeStats, 'USFBrushingFirstDowns') - getStat(awayStats, 'USFBrushingFirstDowns'),
                getStat(homeStats, 'USFBrushingTouchdowns') - getStat(awayStats, 'USFBrushingTouchdowns'),
                getStat(homeStats, 'USFBrushingYards') - getStat(awayStats, 'USFBrushingYards'),
                getStat(homeStats, 'USFBrushingYardsPerGame') - getStat(awayStats, 'USFBrushingYardsPerGame'),
                getStat(homeStats, 'USFByardsPerRushAttempt') - getStat(awayStats, 'USFByardsPerRushAttempt'),
                getStat(homeStats, 'USFBreceivingFirstDowns') - getStat(awayStats, 'USFBreceivingFirstDowns'),
                getStat(homeStats, 'USFBreceivingTouchdowns') - getStat(awayStats, 'USFBreceivingTouchdowns'),
                getStat(homeStats, 'USFBreceivingYards') - getStat(awayStats, 'USFBreceivingYards'),
                getStat(homeStats, 'USFBreceivingYardsPerGame') - getStat(awayStats, 'USFBreceivingYardsPerGame'),
                getStat(homeStats, 'USFBreceivingYardsPerReception') - getStat(awayStats, 'USFBreceivingYardsPerReception'),
                getStat(homeStats, 'USFBreceivingYardsAfterCatch') - getStat(awayStats, 'USFBreceivingYardsAfterCatch'),
                getStat(homeStats, 'USFBreceivingYardsAfterCatchPerGame') - getStat(awayStats, 'USFBreceivingYardsAfterCatchPerGame'),
                getStat(homeStats, 'USFBtacklesforLoss') - getStat(awayStats, 'USFBtacklesforLoss'),
                getStat(homeStats, 'USFBtacklesforLossPerGame') - getStat(awayStats, 'USFBtacklesforLossPerGame'),
                getStat(homeStats, 'USFBinterceptions') - getStat(awayStats, 'USFBinterceptions'),
                getStat(homeStats, 'USFByardsPerInterception') - getStat(awayStats, 'USFByardsPerInterception'),
                getStat(homeStats, 'USFBsacksTotal') - getStat(awayStats, 'USFBsacksTotal'),
                getStat(homeStats, 'USFBsacksPerGame') - getStat(awayStats, 'USFBsacksPerGame'),
                getStat(homeStats, 'USFBsackYards') - getStat(awayStats, 'USFBsackYards'),
                getStat(homeStats, 'USFBsackYardsPerGame') - getStat(awayStats, 'USFBsackYardsPerGame'),
                getStat(homeStats, 'USFBstuffs') - getStat(awayStats, 'USFBstuffs'),
                getStat(homeStats, 'USFBstuffsPerGame') - getStat(awayStats, 'USFBstuffsPerGame'),
                getStat(homeStats, 'USFBstuffYards') - getStat(awayStats, 'USFBstuffYards'),
                getStat(homeStats, 'USFBpassesDefended') - getStat(awayStats, 'USFBpassesDefended'),
                getStat(homeStats, 'USFBpassesDefendedPerGame') - getStat(awayStats, 'USFBpassesDefendedPerGame'),
                getStat(homeStats, 'USFBsafties') - getStat(awayStats, 'USFBsafties'),
                getStat(homeStats, 'USFBaverageKickoffYards') - getStat(awayStats, 'USFBaverageKickoffYards'),
                getStat(homeStats, 'USFBaverageKickoffYardsPerGame') - getStat(awayStats, 'USFBaverageKickoffYardsPerGame'),
                getStat(homeStats, 'USFBextraPointAttempts') - getStat(awayStats, 'USFBextraPointAttempts'),
                getStat(homeStats, 'USFBextraPointAttemptsPerGame') - getStat(awayStats, 'USFBextraPointAttemptsPerGame'),
                getStat(homeStats, 'USFBextraPointsMade') - getStat(awayStats, 'USFBextraPointsMade'),
                getStat(homeStats, 'USFBextraPointsMadePerGame') - getStat(awayStats, 'USFBextraPointsMadePerGame'),
                getStat(homeStats, 'USFBextraPointPercent') - getStat(awayStats, 'USFBextraPointPercent'),
                getStat(homeStats, 'USFBextraPointPercentPerGame') - getStat(awayStats, 'USFBextraPointPercentPerGame'),
                getStat(homeStats, 'USFBfieldGoalAttempts') - getStat(awayStats, 'USFBfieldGoalAttempts'),
                getStat(homeStats, 'USFBfieldGoalAttemptsPerGame') - getStat(awayStats, 'USFBfieldGoalAttemptsPerGame'),
                getStat(homeStats, 'USFBfieldGoalsMade') - getStat(awayStats, 'USFBfieldGoalsMade'),
                getStat(homeStats, 'USFBfieldGoalsMadePerGame') - getStat(awayStats, 'USFBfieldGoalsMadePerGame'),
                getStat(homeStats, 'USFBfieldGoalPct') - getStat(awayStats, 'USFBfieldGoalPct'),
                getStat(homeStats, 'USFBfieldGoalPercentPerGame') - getStat(awayStats, 'USFBfieldGoalPercentPerGame'),
                getStat(homeStats, 'USFBtouchbacks') - getStat(awayStats, 'USFBtouchbacks'),
                getStat(homeStats, 'USFBtouchbacksPerGame') - getStat(awayStats, 'USFBtouchbacksPerGame'),
                getStat(homeStats, 'USFBtouchBackPercentage') - getStat(awayStats, 'USFBtouchBackPercentage'),
                getStat(homeStats, 'USFBkickReturns') - getStat(awayStats, 'USFBkickReturns'),
                getStat(homeStats, 'USFBkickReturnsPerGame') - getStat(awayStats, 'USFBkickReturnsPerGame'),
                getStat(homeStats, 'USFBkickReturnYards') - getStat(awayStats, 'USFBkickReturnYards'),
                getStat(homeStats, 'USFBkickReturnYardsPerGame') - getStat(awayStats, 'USFBkickReturnYardsPerGame'),
                getStat(homeStats, 'USFBpuntReturns') - getStat(awayStats, 'USFBpuntReturns'),
                getStat(homeStats, 'USFBpuntReturnsPerGame') - getStat(awayStats, 'USFBpuntReturnsPerGame'),
                getStat(homeStats, 'USFBpuntReturnFairCatchPct') - getStat(awayStats, 'USFBpuntReturnFairCatchPct'),
                getStat(homeStats, 'USFBpuntReturnYards') - getStat(awayStats, 'USFBpuntReturnYards'),
                getStat(homeStats, 'USFBpuntReturnYardsPerGame') - getStat(awayStats, 'USFBpuntReturnYardsPerGame'),
                getStat(homeStats, 'USFByardsPerReturn') - getStat(awayStats, 'USFByardsPerReturn'),
                getStat(homeStats, 'USFBthirdDownEfficiency') - getStat(awayStats, 'USFBthirdDownEfficiency'),
                getStat(homeStats, 'USFBtotalPenyards') - getStat(awayStats, 'USFBtotalPenyards'),
                getStat(homeStats, 'USFBaveragePenYardsPerGame') - getStat(awayStats, 'USFBaveragePenYardsPerGame'),
                getStat(homeStats, 'USFBgiveaways') - getStat(awayStats, 'USFBgiveaways'),
                getStat(homeStats, 'USFBtakeaways') - getStat(awayStats, 'USFBtakeaways'),
                getStat(homeStats, 'USFBturnoverDiff') - getStat(awayStats, 'USFBturnoverDiff'),
                getStat(homeStats, 'USFBtotalFirstDowns') - getStat(awayStats, 'USFBtotalFirstDowns'),

            ];
        case 'americanfootball_ncaaf':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'USFBpointsPerGame') - getStat(awayStats, 'USFBpointsPerGame'),
                getStat(homeStats, 'USFBtotalPoints') - getStat(awayStats, 'USFBtotalPoints'),
                getStat(homeStats, 'USFBtotalTouchdowns') - getStat(awayStats, 'USFBtotalTouchdowns'),
                getStat(homeStats, 'USFBtouchdownsPerGame') - getStat(awayStats, 'USFBtouchdownsPerGame'),
                getStat(homeStats, 'USFBcompletionPercent') - getStat(awayStats, 'USFBcompletionPercent'),
                getStat(homeStats, 'USFBcompletions') - getStat(awayStats, 'USFBcompletions'),
                getStat(homeStats, 'USFBcompletionsPerGame') - getStat(awayStats, 'USFBcompletionsPerGame'),
                getStat(homeStats, 'USFBnetPassingYards') - getStat(awayStats, 'USFBnetPassingYards'),
                getStat(homeStats, 'USFBnetPassingYardsPerGame') - getStat(awayStats, 'USFBnetPassingYardsPerGame'),
                getStat(homeStats, 'USFBpassingFirstDowns') - getStat(awayStats, 'USFBpassingFirstDowns'),
                getStat(homeStats, 'USFBpassingTouchdowns') - getStat(awayStats, 'USFBpassingTouchdowns'),
                getStat(homeStats, 'USFBpassingYards') - getStat(awayStats, 'USFBpassingYards'),
                getStat(homeStats, 'USFBpassingYardsPerGame') - getStat(awayStats, 'USFBpassingYardsPerGame'),
                getStat(homeStats, 'USFBpassingAttempts') - getStat(awayStats, 'USFBpassingAttempts'),
                getStat(homeStats, 'USFBpassingAttemptsPerGame') - getStat(awayStats, 'USFBpassingAttemptsPerGame'),
                getStat(homeStats, 'USFByardsPerPassAttempt') - getStat(awayStats, 'USFByardsPerPassAttempt'),
                getStat(homeStats, 'USFBrushingAttempts') - getStat(awayStats, 'USFBrushingAttempts'),
                getStat(homeStats, 'USFBrushingFirstDowns') - getStat(awayStats, 'USFBrushingFirstDowns'),
                getStat(homeStats, 'USFBrushingTouchdowns') - getStat(awayStats, 'USFBrushingTouchdowns'),
                getStat(homeStats, 'USFBrushingYards') - getStat(awayStats, 'USFBrushingYards'),
                getStat(homeStats, 'USFBrushingYardsPerGame') - getStat(awayStats, 'USFBrushingYardsPerGame'),
                getStat(homeStats, 'USFByardsPerRushAttempt') - getStat(awayStats, 'USFByardsPerRushAttempt'),
                getStat(homeStats, 'USFBreceivingFirstDowns') - getStat(awayStats, 'USFBreceivingFirstDowns'),
                getStat(homeStats, 'USFBreceivingTouchdowns') - getStat(awayStats, 'USFBreceivingTouchdowns'),
                getStat(homeStats, 'USFBreceivingYards') - getStat(awayStats, 'USFBreceivingYards'),
                getStat(homeStats, 'USFBreceivingYardsPerGame') - getStat(awayStats, 'USFBreceivingYardsPerGame'),
                getStat(homeStats, 'USFBreceivingYardsPerReception') - getStat(awayStats, 'USFBreceivingYardsPerReception'),
                getStat(homeStats, 'USFBreceivingYardsAfterCatch') - getStat(awayStats, 'USFBreceivingYardsAfterCatch'),
                getStat(homeStats, 'USFBreceivingYardsAfterCatchPerGame') - getStat(awayStats, 'USFBreceivingYardsAfterCatchPerGame'),
                getStat(homeStats, 'USFBtacklesforLoss') - getStat(awayStats, 'USFBtacklesforLoss'),
                getStat(homeStats, 'USFBtacklesforLossPerGame') - getStat(awayStats, 'USFBtacklesforLossPerGame'),
                getStat(homeStats, 'USFBinterceptions') - getStat(awayStats, 'USFBinterceptions'),
                getStat(homeStats, 'USFByardsPerInterception') - getStat(awayStats, 'USFByardsPerInterception'),
                getStat(homeStats, 'USFBsacksTotal') - getStat(awayStats, 'USFBsacksTotal'),
                getStat(homeStats, 'USFBsacksPerGame') - getStat(awayStats, 'USFBsacksPerGame'),
                getStat(homeStats, 'USFBsackYards') - getStat(awayStats, 'USFBsackYards'),
                getStat(homeStats, 'USFBsackYardsPerGame') - getStat(awayStats, 'USFBsackYardsPerGame'),
                getStat(homeStats, 'USFBstuffs') - getStat(awayStats, 'USFBstuffs'),
                getStat(homeStats, 'USFBstuffsPerGame') - getStat(awayStats, 'USFBstuffsPerGame'),
                getStat(homeStats, 'USFBstuffYards') - getStat(awayStats, 'USFBstuffYards'),
                getStat(homeStats, 'USFBpassesDefended') - getStat(awayStats, 'USFBpassesDefended'),
                getStat(homeStats, 'USFBpassesDefendedPerGame') - getStat(awayStats, 'USFBpassesDefendedPerGame'),
                getStat(homeStats, 'USFBsafties') - getStat(awayStats, 'USFBsafties'),
                getStat(homeStats, 'USFBaverageKickoffYards') - getStat(awayStats, 'USFBaverageKickoffYards'),
                getStat(homeStats, 'USFBaverageKickoffYardsPerGame') - getStat(awayStats, 'USFBaverageKickoffYardsPerGame'),
                getStat(homeStats, 'USFBextraPointAttempts') - getStat(awayStats, 'USFBextraPointAttempts'),
                getStat(homeStats, 'USFBextraPointAttemptsPerGame') - getStat(awayStats, 'USFBextraPointAttemptsPerGame'),
                getStat(homeStats, 'USFBextraPointsMade') - getStat(awayStats, 'USFBextraPointsMade'),
                getStat(homeStats, 'USFBextraPointsMadePerGame') - getStat(awayStats, 'USFBextraPointsMadePerGame'),
                getStat(homeStats, 'USFBextraPointPercent') - getStat(awayStats, 'USFBextraPointPercent'),
                getStat(homeStats, 'USFBextraPointPercentPerGame') - getStat(awayStats, 'USFBextraPointPercentPerGame'),
                getStat(homeStats, 'USFBfieldGoalAttempts') - getStat(awayStats, 'USFBfieldGoalAttempts'),
                getStat(homeStats, 'USFBfieldGoalAttemptsPerGame') - getStat(awayStats, 'USFBfieldGoalAttemptsPerGame'),
                getStat(homeStats, 'USFBfieldGoalsMade') - getStat(awayStats, 'USFBfieldGoalsMade'),
                getStat(homeStats, 'USFBfieldGoalsMadePerGame') - getStat(awayStats, 'USFBfieldGoalsMadePerGame'),
                getStat(homeStats, 'USFBfieldGoalPct') - getStat(awayStats, 'USFBfieldGoalPct'),
                getStat(homeStats, 'USFBfieldGoalPercentPerGame') - getStat(awayStats, 'USFBfieldGoalPercentPerGame'),
                getStat(homeStats, 'USFBtouchbacks') - getStat(awayStats, 'USFBtouchbacks'),
                getStat(homeStats, 'USFBtouchbacksPerGame') - getStat(awayStats, 'USFBtouchbacksPerGame'),
                getStat(homeStats, 'USFBtouchBackPercentage') - getStat(awayStats, 'USFBtouchBackPercentage'),
                getStat(homeStats, 'USFBkickReturns') - getStat(awayStats, 'USFBkickReturns'),
                getStat(homeStats, 'USFBkickReturnsPerGame') - getStat(awayStats, 'USFBkickReturnsPerGame'),
                getStat(homeStats, 'USFBkickReturnYards') - getStat(awayStats, 'USFBkickReturnYards'),
                getStat(homeStats, 'USFBkickReturnYardsPerGame') - getStat(awayStats, 'USFBkickReturnYardsPerGame'),
                getStat(homeStats, 'USFBpuntReturns') - getStat(awayStats, 'USFBpuntReturns'),
                getStat(homeStats, 'USFBpuntReturnsPerGame') - getStat(awayStats, 'USFBpuntReturnsPerGame'),
                getStat(homeStats, 'USFBpuntReturnFairCatchPct') - getStat(awayStats, 'USFBpuntReturnFairCatchPct'),
                getStat(homeStats, 'USFBpuntReturnYards') - getStat(awayStats, 'USFBpuntReturnYards'),
                getStat(homeStats, 'USFBpuntReturnYardsPerGame') - getStat(awayStats, 'USFBpuntReturnYardsPerGame'),
                getStat(homeStats, 'USFByardsPerReturn') - getStat(awayStats, 'USFByardsPerReturn'),
                getStat(homeStats, 'USFBthirdDownEfficiency') - getStat(awayStats, 'USFBthirdDownEfficiency'),
                getStat(homeStats, 'USFBtotalPenyards') - getStat(awayStats, 'USFBtotalPenyards'),
                getStat(homeStats, 'USFBaveragePenYardsPerGame') - getStat(awayStats, 'USFBaveragePenYardsPerGame'),
                getStat(homeStats, 'USFBgiveaways') - getStat(awayStats, 'USFBgiveaways'),
                getStat(homeStats, 'USFBtakeaways') - getStat(awayStats, 'USFBtakeaways'),
                getStat(homeStats, 'USFBturnoverDiff') - getStat(awayStats, 'USFBturnoverDiff'),
                getStat(homeStats, 'USFBtotalFirstDowns') - getStat(awayStats, 'USFBtotalFirstDowns'),

            ];
        case 'icehockey_nhl':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'HKYgoals') - getStat(awayStats, 'HKYgoals'),
                getStat(homeStats, 'HKYgoalsPerGame') - getStat(awayStats, 'HKYgoalsPerGame'),
                getStat(homeStats, 'HKYassists') - getStat(awayStats, 'HKYassists'),
                getStat(homeStats, 'HKYassistsPerGame') - getStat(awayStats, 'HKYassistsPerGame'),
                getStat(homeStats, 'HKYshotsIn1st') - getStat(awayStats, 'HKYshotsIn1st'),
                getStat(homeStats, 'HKYshotsIn1stPerGame') - getStat(awayStats, 'HKYshotsIn1stPerGame'),
                getStat(homeStats, 'HKYshotsIn2nd') - getStat(awayStats, 'HKYshotsIn2nd'),
                getStat(homeStats, 'HKYshotsIn2ndPerGame') - getStat(awayStats, 'HKYshotsIn2ndPerGame'),
                getStat(homeStats, 'HKYshotsIn3rd') - getStat(awayStats, 'HKYshotsIn3rd'),
                getStat(homeStats, 'HKYshotsIn3rdPerGame') - getStat(awayStats, 'HKYshotsIn3rdPerGame'),
                getStat(homeStats, 'HKYtotalShots') - getStat(awayStats, 'HKYtotalShots'),
                getStat(homeStats, 'HKYtotalShotsPerGame') - getStat(awayStats, 'HKYtotalShotsPerGame'),
                getStat(homeStats, 'HKYshotsMissed') - getStat(awayStats, 'HKYshotsMissed'),
                getStat(homeStats, 'HKYshotsMissedPerGame') - getStat(awayStats, 'HKYshotsMissedPerGame'),
                getStat(homeStats, 'HKYppgGoals') - getStat(awayStats, 'HKYppgGoals'),
                getStat(homeStats, 'HKYppgGoalsPerGame') - getStat(awayStats, 'HKYppgGoalsPerGame'),
                getStat(homeStats, 'HKYppassists') - getStat(awayStats, 'HKYppassists'),
                getStat(homeStats, 'HKYppassistsPerGame') - getStat(awayStats, 'HKYppassistsPerGame'),
                getStat(homeStats, 'HKYpowerplayPct') - getStat(awayStats, 'HKYpowerplayPct'),
                getStat(homeStats, 'HKYshortHandedGoals') - getStat(awayStats, 'HKYshortHandedGoals'),
                getStat(homeStats, 'HKYshortHandedGoalsPerGame') - getStat(awayStats, 'HKYshortHandedGoalsPerGame'),
                getStat(homeStats, 'HKYshootingPct') - getStat(awayStats, 'HKYshootingPct'),
                getStat(homeStats, 'HKYfaceoffs') - getStat(awayStats, 'HKYfaceoffs'),
                getStat(homeStats, 'HKYfaceoffsPerGame') - getStat(awayStats, 'HKYfaceoffsPerGame'),
                getStat(homeStats, 'HKYfaceoffsWon') - getStat(awayStats, 'HKYfaceoffsWon'),
                getStat(homeStats, 'HKYfaceoffsWonPerGame') - getStat(awayStats, 'HKYfaceoffsWonPerGame'),
                getStat(homeStats, 'HKYfaceoffsLost') - getStat(awayStats, 'HKYfaceoffsLost'),
                getStat(homeStats, 'HKYfaceoffsLostPerGame') - getStat(awayStats, 'HKYfaceoffsLostPerGame'),
                getStat(homeStats, 'HKYfaceoffPct') - getStat(awayStats, 'HKYfaceoffPct'),
                getStat(homeStats, 'HKYfaceoffPctPerGame') - getStat(awayStats, 'HKYfaceoffPctPerGame'),
                getStat(homeStats, 'HKYgiveaways') - getStat(awayStats, 'HKYgiveaways'),
                getStat(homeStats, 'HKYgoalsAgainst') - getStat(awayStats, 'HKYgoalsAgainst'),
                getStat(homeStats, 'HKYgoalsAgainstPerGame') - getStat(awayStats, 'HKYgoalsAgainstPerGame'),
                getStat(homeStats, 'HKYshotsAgainst') - getStat(awayStats, 'HKYshotsAgainst'),
                getStat(homeStats, 'HKYshotsAgainstPerGame') - getStat(awayStats, 'HKYshotsAgainstPerGame'),
                getStat(homeStats, 'HKYpenaltyKillPct') - getStat(awayStats, 'HKYpenaltyKillPct'),
                getStat(homeStats, 'HKYpenaltyKillPctPerGame') - getStat(awayStats, 'HKYpenaltyKillPctPerGame'),
                getStat(homeStats, 'HKYppGoalsAgainst') - getStat(awayStats, 'HKYppGoalsAgainst'),
                getStat(homeStats, 'HKYppGoalsAgainstPerGame') - getStat(awayStats, 'HKYppGoalsAgainstPerGame'),
                getStat(homeStats, 'HKYshutouts') - getStat(awayStats, 'HKYshutouts'),
                getStat(homeStats, 'HKYsaves') - getStat(awayStats, 'HKYsaves'),
                getStat(homeStats, 'HKYsavesPerGame') - getStat(awayStats, 'HKYsavesPerGame'),
                getStat(homeStats, 'HKYsavePct') - getStat(awayStats, 'HKYsavePct'),
                getStat(homeStats, 'HKYblockedShots') - getStat(awayStats, 'HKYblockedShots'),
                getStat(homeStats, 'HKYblockedShotsPerGame') - getStat(awayStats, 'HKYblockedShotsPerGame'),
                getStat(homeStats, 'HKYhits') - getStat(awayStats, 'HKYhits'),
                getStat(homeStats, 'HKYhitsPerGame') - getStat(awayStats, 'HKYhitsPerGame'),
                getStat(homeStats, 'HKYtakeaways') - getStat(awayStats, 'HKYtakeaways'),
                getStat(homeStats, 'HKYtakeawaysPerGame') - getStat(awayStats, 'HKYtakeawaysPerGame'),
                getStat(homeStats, 'HKYshotDifferential') - getStat(awayStats, 'HKYshotDifferential'),
                getStat(homeStats, 'HKYshotDifferentialPerGame') - getStat(awayStats, 'HKYshotDifferentialPerGame'),
                getStat(homeStats, 'HKYgoalDifferentialPerGame') - getStat(awayStats, 'HKYgoalDifferentialPerGame'),
                getStat(homeStats, 'HKYpimDifferential') - getStat(awayStats, 'HKYpimDifferential'),
                getStat(homeStats, 'HKYpimDifferentialPerGame') - getStat(awayStats, 'HKYpimDifferentialPerGame'),
                getStat(homeStats, 'HKYtotalPenalties') - getStat(awayStats, 'HKYtotalPenalties'),
                getStat(homeStats, 'HKYpenaltiesPerGame') - getStat(awayStats, 'HKYpenaltiesPerGame'),
                getStat(homeStats, 'HKYpenaltyMinutes') - getStat(awayStats, 'HKYpenaltyMinutes'),
                getStat(homeStats, 'HKYpenaltyMinutesPerGame') - getStat(awayStats, 'HKYpenaltyMinutesPerGame')

            ];
        case 'baseball_mlb':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'BSBbattingStrikeouts') - getStat(awayStats, 'BSBbattingStrikeouts'),
                getStat(homeStats, 'BSBrunsBattedIn') - getStat(awayStats, 'BSBrunsBattedIn'),
                getStat(homeStats, 'BSBsacrificeHits') - getStat(awayStats, 'BSBsacrificeHits'),
                getStat(homeStats, 'BSBHitsTotal') - getStat(awayStats, 'BSBHitsTotal'),
                getStat(homeStats, 'BSBwalks') - getStat(awayStats, 'BSBwalks'),
                getStat(homeStats, 'BSBruns') - getStat(awayStats, 'BSBruns'),
                getStat(homeStats, 'BSBhomeRuns') - getStat(awayStats, 'BSBhomeRuns'),
                getStat(homeStats, 'BSBdoubles') - getStat(awayStats, 'BSBdoubles'),
                getStat(homeStats, 'BSBtotalBases') - getStat(awayStats, 'BSBtotalBases'),
                getStat(homeStats, 'BSBextraBaseHits') - getStat(awayStats, 'BSBextraBaseHits'),
                getStat(homeStats, 'BSBbattingAverage') - getStat(awayStats, 'BSBbattingAverage'),
                getStat(homeStats, 'BSBsluggingPercentage') - getStat(awayStats, 'BSBsluggingPercentage'),
                getStat(homeStats, 'BSBonBasePercentage') - getStat(awayStats, 'BSBonBasePercentage'),
                getStat(homeStats, 'BSBonBasePlusSlugging') - getStat(awayStats, 'BSBonBasePlusSlugging'),
                getStat(homeStats, 'BSBgroundToFlyRatio') - getStat(awayStats, 'BSBgroundToFlyRatio'),
                getStat(homeStats, 'BSBatBatsPerHomeRun') - getStat(awayStats, 'BSBatBatsPerHomeRun'),
                getStat(homeStats, 'BSBstolenBasePercentage') - getStat(awayStats, 'BSBstolenBasePercentage'),
                getStat(homeStats, 'BSBbatterWalkToStrikeoutRatio') - getStat(awayStats, 'BSBbatterWalkToStrikeoutRatio'),
                getStat(homeStats, 'BSBsaves') - getStat(awayStats, 'BSBsaves'),
                getStat(homeStats, 'BSBpitcherStrikeouts') - getStat(awayStats, 'BSBpitcherStrikeouts'),
                getStat(homeStats, 'BSBhitsGivenUp') - getStat(awayStats, 'BSBhitsGivenUp'),
                getStat(homeStats, 'BSBearnedRuns') - getStat(awayStats, 'BSBearnedRuns'),
                getStat(homeStats, 'BSBbattersWalked') - getStat(awayStats, 'BSBbattersWalked'),
                getStat(homeStats, 'BSBrunsAllowed') - getStat(awayStats, 'BSBrunsAllowed'),
                getStat(homeStats, 'BSBhomeRunsAllowed') - getStat(awayStats, 'BSBhomeRunsAllowed'),
                getStat(homeStats, 'BSBwins') - getStat(awayStats, 'BSBwins'),
                getStat(homeStats, 'BSBshutouts') - getStat(awayStats, 'BSBshutouts'),
                getStat(homeStats, 'BSBearnedRunAverage') - getStat(awayStats, 'BSBearnedRunAverage'),
                getStat(homeStats, 'BSBwalksHitsPerInningPitched') - getStat(awayStats, 'BSBwalksHitsPerInningPitched'),
                getStat(homeStats, 'BSBwinPct') - getStat(awayStats, 'BSBwinPct'),
                getStat(homeStats, 'BSBpitcherCaughtStealingPct') - getStat(awayStats, 'BSBpitcherCaughtStealingPct'),
                getStat(homeStats, 'BSBpitchesPerInning') - getStat(awayStats, 'BSBpitchesPerInning'),
                getStat(homeStats, 'BSBrunSupportAverage') - getStat(awayStats, 'BSBrunSupportAverage'),
                getStat(homeStats, 'BSBopponentBattingAverage') - getStat(awayStats, 'BSBopponentBattingAverage'),
                getStat(homeStats, 'BSBopponentSlugAverage') - getStat(awayStats, 'BSBopponentSlugAverage'),
                getStat(homeStats, 'BSBopponentOnBasePct') - getStat(awayStats, 'BSBopponentOnBasePct'),
                getStat(homeStats, 'BSBopponentOnBasePlusSlugging') - getStat(awayStats, 'BSBopponentOnBasePlusSlugging'),
                getStat(homeStats, 'BSBsavePct') - getStat(awayStats, 'BSBsavePct'),
                getStat(homeStats, 'BSBstrikeoutsPerNine') - getStat(awayStats, 'BSBstrikeoutsPerNine'),
                getStat(homeStats, 'BSBpitcherStrikeoutToWalkRatio') - getStat(awayStats, 'BSBpitcherStrikeoutToWalkRatio'),
                getStat(homeStats, 'BSBdoublePlays') - getStat(awayStats, 'BSBdoublePlays'),
                getStat(homeStats, 'BSBerrors') - getStat(awayStats, 'BSBerrors'),
                getStat(homeStats, 'BSBpassedBalls') - getStat(awayStats, 'BSBpassedBalls'),
                getStat(homeStats, 'BSBassists') - getStat(awayStats, 'BSBassists'),
                getStat(homeStats, 'BSBputouts') - getStat(awayStats, 'BSBputouts'),
                getStat(homeStats, 'BSBcatcherCaughtStealing') - getStat(awayStats, 'BSBcatcherCaughtStealing'),
                getStat(homeStats, 'BSBcatcherCaughtStealingPct') - getStat(awayStats, 'BSBcatcherCaughtStealingPct'),
                getStat(homeStats, 'BSBcatcherStolenBasesAllowed') - getStat(awayStats, 'BSBcatcherStolenBasesAllowed'),
                getStat(homeStats, 'BSBfieldingPercentage') - getStat(awayStats, 'BSBfieldingPercentage'),
                getStat(homeStats, 'BSBrangeFactor') - getStat(awayStats, 'BSBrangeFactor')
            ];
        case 'basketball_ncaab':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints'),
                getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame'),
                getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists'),
                getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame'),
                getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio'),
                getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent'),
                getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent'),
                getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted'),
                getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade'),
                getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame'),
                getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent'),
                getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted'),
                getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade'),
                getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame'),
                getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds'),
                getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate'),
                getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers'),
                getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame'),
                getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio'),
                getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct'),
                getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted'),
                getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade'),
                getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct'),
                getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace'),
                getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint'),
                getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency'),
                getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency'),
                getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks'),
                getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame'),
                getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds'),
                getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals'),
                getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame'),
                getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate'),
                getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame'),
                getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame'),
                getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio')
            ];
        case 'basketball_wncaab':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints'),
                getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame'),
                getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists'),
                getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame'),
                getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio'),
                getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent'),
                getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent'),
                getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted'),
                getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade'),
                getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame'),
                getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent'),
                getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted'),
                getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade'),
                getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame'),
                getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds'),
                getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate'),
                getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers'),
                getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame'),
                getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio'),
                getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct'),
                getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted'),
                getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade'),
                getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct'),
                getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace'),
                getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint'),
                getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency'),
                getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency'),
                getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks'),
                getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame'),
                getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds'),
                getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals'),
                getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame'),
                getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate'),
                getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame'),
                getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame'),
                getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio'),
            ];
        case 'basketball_nba':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'BSKBtotalPoints') - getStat(awayStats, 'BSKBtotalPoints'),
                getStat(homeStats, 'BSKBpointsPerGame') - getStat(awayStats, 'BSKBpointsPerGame'),
                getStat(homeStats, 'BSKBassists') - getStat(awayStats, 'BSKBassists'),
                getStat(homeStats, 'BSKBassistsPerGame') - getStat(awayStats, 'BSKBassistsPerGame'),
                getStat(homeStats, 'BSKBassistRatio') - getStat(awayStats, 'BSKBassistRatio'),
                getStat(homeStats, 'BSKBeffectiveFgPercent') - getStat(awayStats, 'BSKBeffectiveFgPercent'),
                getStat(homeStats, 'BSKBfieldGoalPercent') - getStat(awayStats, 'BSKBfieldGoalPercent'),
                getStat(homeStats, 'BSKBfieldGoalsAttempted') - getStat(awayStats, 'BSKBfieldGoalsAttempted'),
                getStat(homeStats, 'BSKBfieldGoalsMade') - getStat(awayStats, 'BSKBfieldGoalsMade'),
                getStat(homeStats, 'BSKBfieldGoalsPerGame') - getStat(awayStats, 'BSKBfieldGoalsPerGame'),
                getStat(homeStats, 'BSKBfreeThrowPercent') - getStat(awayStats, 'BSKBfreeThrowPercent'),
                getStat(homeStats, 'BSKBfreeThrowsAttempted') - getStat(awayStats, 'BSKBfreeThrowsAttempted'),
                getStat(homeStats, 'BSKBfreeThrowsMade') - getStat(awayStats, 'BSKBfreeThrowsMade'),
                getStat(homeStats, 'BSKBfreeThrowsMadePerGame') - getStat(awayStats, 'BSKBfreeThrowsMadePerGame'),
                getStat(homeStats, 'BSKBoffensiveRebounds') - getStat(awayStats, 'BSKBoffensiveRebounds'),
                getStat(homeStats, 'BSKBoffensiveReboundsPerGame') - getStat(awayStats, 'BSKBoffensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBoffensiveReboundRate') - getStat(awayStats, 'BSKBoffensiveReboundRate'),
                getStat(homeStats, 'BSKBoffensiveTurnovers') - getStat(awayStats, 'BSKBoffensiveTurnovers'),
                getStat(homeStats, 'BSKBturnoversPerGame') - getStat(awayStats, 'BSKBturnoversPerGame'),
                getStat(homeStats, 'BSKBturnoverRatio') - getStat(awayStats, 'BSKBturnoverRatio'),
                getStat(homeStats, 'BSKBthreePointPct') - getStat(awayStats, 'BSKBthreePointPct'),
                getStat(homeStats, 'BSKBthreePointsAttempted') - getStat(awayStats, 'BSKBthreePointsAttempted'),
                getStat(homeStats, 'BSKBthreePointsMade') - getStat(awayStats, 'BSKBthreePointsMade'),
                getStat(homeStats, 'BSKBtrueShootingPct') - getStat(awayStats, 'BSKBtrueShootingPct'),
                getStat(homeStats, 'BSKBpace') - getStat(awayStats, 'BSKBpace'),
                getStat(homeStats, 'BSKBpointsInPaint') - getStat(awayStats, 'BSKBpointsInPaint'),
                getStat(homeStats, 'BSKBshootingEfficiency') - getStat(awayStats, 'BSKBshootingEfficiency'),
                getStat(homeStats, 'BSKBscoringEfficiency') - getStat(awayStats, 'BSKBscoringEfficiency'),
                getStat(homeStats, 'BSKBblocks') - getStat(awayStats, 'BSKBblocks'),
                getStat(homeStats, 'BSKBblocksPerGame') - getStat(awayStats, 'BSKBblocksPerGame'),
                getStat(homeStats, 'BSKBdefensiveRebounds') - getStat(awayStats, 'BSKBdefensiveRebounds'),
                getStat(homeStats, 'BSKBdefensiveReboundsPerGame') - getStat(awayStats, 'BSKBdefensiveReboundsPerGame'),
                getStat(homeStats, 'BSKBsteals') - getStat(awayStats, 'BSKBsteals'),
                getStat(homeStats, 'BSKBstealsPerGame') - getStat(awayStats, 'BSKBstealsPerGame'),
                getStat(homeStats, 'BSKBreboundRate') - getStat(awayStats, 'BSKBreboundRate'),
                getStat(homeStats, 'BSKBreboundsPerGame') - getStat(awayStats, 'BSKBreboundsPerGame'),
                getStat(homeStats, 'BSKBfoulsPerGame') - getStat(awayStats, 'BSKBfoulsPerGame'),
                getStat(homeStats, 'BSKBteamAssistToTurnoverRatio') - getStat(awayStats, 'BSKBteamAssistToTurnoverRatio')
            ];
        default:
            return [];
    }
}
// Define the utility functions above your existing code
async function extractSportWeights(model, sportName) {
    let weights, weightMatrix, averages = [];

    // Extract weights from the first (input) layer of the model
    weights = model.layers[0].getWeights();
    weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

    // Sum weights for each feature (column-wise)
    matrixIterator(weightMatrix, averages);

    // Return the averages array specific to the sport
    return averages;
}

function matrixIterator(weightMatrix, averages) {
    for (let i = 0; i < weightMatrix.length; i++) {
        let row = weightMatrix[i];
        // Calculate the sum of the 64 weights in the row
        let sum = row.reduce((acc, value) => acc + value, 0);

        // Calculate the average of the row
        let average = Math.abs(sum / row.length);

        // Store the average in the averages array
        averages.push(average * 10);  // Optional: Multiply for better scaling
    }
}

async function handleSportWeights(model, sport) {
    let sportWeights;

    switch (sport.name) {
        case 'americanfootball_nfl':
            sportWeights = await extractSportWeights(model, 'americanfootball_nfl');
            nflWeights = sportWeights;
            break;

        case 'americanfootball_ncaaf':
            sportWeights = await extractSportWeights(model, 'americanfootball_ncaaf');
            ncaafWeights = sportWeights;
            break;

        case 'basketball_nba':
            sportWeights = await extractSportWeights(model, 'basketball_nba');
            nbaWeights = sportWeights;
            break;

        case 'baseball_mlb':
            sportWeights = await extractSportWeights(model, 'baseball_mlb');
            mlbWeights = sportWeights;
            break;

        case 'icehockey_nhl':
            sportWeights = await extractSportWeights(model, 'icehockey_nhl');
            nhlWeights = sportWeights;
            break;

        case 'basketball_ncaab':
            sportWeights = await extractSportWeights(model, 'basketball_ncaab');
            ncaamWeights = sportWeights;
            break;

        case 'basketball_wncaab':
            sportWeights = await extractSportWeights(model, 'basketball_wncaab');
            ncaawWeights = sportWeights;
            break;

        default:
            console.log(`No weight extraction logic for sport: ${sport.name}`);
    }
}
const getDynamicStatYear = (startMonth, endMonth, currentDate) => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed, so add 1.

    // For sports that start late in the year (e.g., NFL, NBA), we'll base the statYear on the start month.
    if (currentMonth >= startMonth && currentMonth <= endMonth) {
        // In season, statYear is the start year of the season.
        return currentYear;
    } else if (currentMonth < startMonth) {
        // Before the season starts, we use the previous year as statYear.
        return currentYear - 1;
    } else {
        // After the season ends, use the start year of the season.
        return currentYear;
    }
}

const sports = [
    {
        name: "americanfootball_nfl",
        espnSport: 'football',
        league: 'nfl',
        startMonth: 9,
        endMonth: 2,
        multiYear: true,
        statYear: getDynamicStatYear(9, 2, new Date()), // NFL starts in 2024 but extends into 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 2, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.45
    },
    {
        name: "americanfootball_ncaaf",
        espnSport: 'football',
        league: 'college-football',
        startMonth: 9,
        endMonth: 1,
        multiYear: true,
        statYear: getDynamicStatYear(9, 1, new Date()), // NCAA Football starts in 2024 but ends in 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 1, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.3
    },
    {
        name: "basketball_nba",
        espnSport: 'basketball',
        league: 'nba',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NBA starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.2
    },
    {
        name: "icehockey_nhl",
        espnSport: 'hockey',
        league: 'nhl',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NHL starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.075
    },
    {
        name: "baseball_mlb",
        espnSport: 'baseball',
        league: 'mlb',
        startMonth: 3,
        endMonth: 10,
        multiYear: false,
        statYear: getDynamicStatYear(3, 10, new Date()), // MLB starts in 2024 but ends in 2024, so statYear = 2024
        prevstatYear: getDynamicStatYear(3, 10, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.025
    },
    {
        name: "basketball_ncaab",
        espnSport: 'basketball',
        league: 'mens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // NCAA Basketball starts in 2024 but ends in 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.2
    },
    {
        name: "basketball_wncaab",
        espnSport: 'basketball',
        league: 'womens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // Same as men's college basketball
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 0.2
    },
]
// Example of checking for NaN or infinite values
const checkNaNValues = (data, game) => {
    data.forEach((row, index) => {
        // console.log(row)
        if (isNaN(row) || row === Infinity || row === -Infinity || row === null || row === undefined) {
            console.log(game.id)
            console.log(`NaN or Infinity found in row ${index}`);
        }
    });
};
const mlModelTraining = async (gameData, xs, ys, sport) => {
    const decayCalc = (daysAgo, lambda) => {
        return 1 / (1 + lambda * daysAgo);
    };

    const currentDate = new Date();
    gameData.forEach(game => {
        const homeStats = game.homeTeamStats;
        const awayStats = game.awayTeamStats;

        // Extract features based on sport
        let features = extractSportFeatures(homeStats, awayStats, sport.name);

        // Calculate days since the game was played
        const gameDate = new Date(game.commence_time); // assuming game.date is in a valid format
        const daysAgo = Math.floor((currentDate - gameDate) / (1000 * 60 * 60 * 24)); // in days
        // // Apply the decay to the stat differences (assuming the features include stat differences)
        const decayWeight = decayCalc(daysAgo, sport.decayFactor);  // get the decay weight based on daysAgo

        // // Apply decay to each feature if relevant
        features = features.map(feature => feature * decayWeight);

        // Set label to 1 if home team wins, 0 if away team wins
        const correctPrediction = game.winner = 'home' ? 1 : 0;
        checkNaNValues(features, game);  // Check features

        xs.push(features);
        ys.push(correctPrediction);
    });
    // Convert arrays to tensors
    const xsTensor = tf.tensor2d(xs);
    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);
    // Define the path to the model
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;

    // Define the model
    const loadOrCreateModel = async () => {
        try {
            if (fs.existsSync(modelPath)) {
                return await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
            } else {
                let newModel = tf.sequential();

                newModel.add(tf.layers.dense({ units: 64, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));

                // Compile the model

                return newModel
            }
        } catch (err) {
            console.log(err)
        }
    }
    const model = await loadOrCreateModel()
    model.compile({
        optimizer: tf.train.adam(.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    const earlyStopping = tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: 25,
    });
    // Train the model
    await model.fit(xsTensor, ysTensor, {
        epochs: 100,
        batchSize: xs.length < 32 ? xs.length : 32,
        validationSplit: 0.3,
        shuffle: false,
        verbose: false
    });
    if (!fs.existsSync(modelDir)) {
        console.log('Creating model directory...');
        // Create the directory (including any necessary parent directories)
        fs.mkdirSync(modelDir, { recursive: true });
    }
    // Save model specific to the sport
    await model.save(`file://./model_checkpoint/${sport.name}_model`);
    return { model, xsTensor, ysTensor }
    // Log loss and accuracy
}
const predictions = async (sportOdds, ff, model) => {
    if (sportOdds.length > 0) {
        sportOdds.forEach(game => {
            if (game.homeTeamStats && game.awayTeamStats) {
                const homeStats = game.homeTeamStats;
                const awayStats = game.awayTeamStats;



                // Extract features based on sport
                const features = extractSportFeatures(homeStats, awayStats, game.sport_key);


                ff.push(features);
            }

        });
        const ffTensor = tf.tensor2d(ff);
        // Get predictions as a promise and wait for it to resolve
        const predictions = await model.predict(ffTensor);
        // Convert tensor to an array of predicted probabilities
        const probabilities = await predictions.array();  // This resolves the tensor to an array
        sportOdds.forEach(async (game, index) => {
            if (!game.awayTeamStats && !game.homeTeamStats) {

            } else {
                const predictedWinPercent = probabilities[index][0]; // Get the probability for the current game
                // Update the game with the predicted win percentage
                await Odds.findOneAndUpdate({ id: game.id }, { predictionStrength: predictedWinPercent != NaN ? predictedWinPercent : 0 });
            }

        });
    }
}
//DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
// Helper function to adjust indexes for football games
function adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nflWeights[0] : awayIndex += nflWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nflWeights[1] : awayIndex += nflWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nflWeights[2] : awayIndex += nflWeights[2];

    let nflWeightIndex = 3;
    const reverseComparisonStats = ['totalPenyards', 'averagePenYardsPerGame', 'interceptions', 'giveaways'];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += nflWeights[nflWeightIndex];
                    } else {
                        awayIndex += nflWeights[nflWeightIndex];
                    }
                    nflWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += nflWeights[nflWeightIndex];
                    } else {
                        awayIndex += nflWeights[nflWeightIndex];
                    }
                    nflWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

function adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += ncaafWeights[0] : awayIndex += ncaafWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += ncaafWeights[1] : awayIndex += ncaafWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += ncaafWeights[2] : awayIndex += ncaafWeights[2];

    let ncaafWeightIndex = 3;
    const reverseComparisonStats = ['totalPenyards', 'averagePenYardsPerGame', 'interceptions', 'giveaways'];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += ncaafWeights[ncaafWeightIndex];
                    } else {
                        awayIndex += ncaafWeights[ncaafWeightIndex];
                    }
                    ncaafWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += ncaafWeights[ncaafWeightIndex];
                    } else {
                        awayIndex += ncaafWeights[ncaafWeightIndex];
                    }
                    ncaafWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

// Helper function to adjust indexes for hockey games
function adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nhlWeights[0] : awayIndex += nhlWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nhlWeights[1] : awayIndex += nhlWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nhlWeights[2] : awayIndex += nhlWeights[2];

    let nhlWeightIndex = 3;
    const reverseComparisonStats = [];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += nhlWeights[nhlWeightIndex];
                    } else {
                        awayIndex += nhlWeights[nhlWeightIndex];
                    }
                    nhlWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += nhlWeights[nhlWeightIndex];
                    } else {
                        awayIndex += nhlWeights[nhlWeightIndex];
                    }
                    nhlWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

// Helper function to adjust indexes for basketball games
function adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nbaWeights[0] : awayIndex += nbaWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nbaWeights[1] : awayIndex += nbaWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nbaWeights[2] : awayIndex += nbaWeights[2];
    let nbaWeightIndex = 3
    const reverseComparisonStats = [];
    // Loop through homeTeam.stats to goalsAgainst each stat

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                // For reversed comparison, check if homeStat is less than or equal to awayStat
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += nbaWeights[nbaWeightIndex];
                    } else {
                        awayIndex += nbaWeights[nbaWeightIndex];
                    }
                    nbaWeightIndex++
                }

            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += nbaWeights[nbaWeightIndex];
                    } else {
                        awayIndex += nbaWeights[nbaWeightIndex];
                    }
                    nbaWeightIndex++
                }
                // For all other stats, check if homeStat is greater than or equal to awayStat

            }
        }

    }


    return { homeIndex, awayIndex };
}
// Helper function to adjust indexes for baseball games
function adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += mlbWeights[0] : awayIndex += mlbWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += mlbWeights[1] : awayIndex += mlbWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += mlbWeights[2] : awayIndex += mlbWeights[2];

    let mlbWeightIndex = 3;
    const reverseComparisonStats = ['fieldingErrors', 'oppOPS', 'oppSlugging', 'oppBattingAverage', 'walksHitsPerInningPitched', 'earnedRunAverage', 'walksPitchingTotal'];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += mlbWeights[mlbWeightIndex];
                    } else {
                        awayIndex += mlbWeights[mlbWeightIndex];
                    }
                    mlbWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += mlbWeights[mlbWeightIndex];
                    } else {
                        awayIndex += mlbWeights[mlbWeightIndex];
                    }
                    mlbWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

function adjustncaamStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam?.seasonWinLoss?.split("-")[0] >= awayTeam?.seasonWinLoss?.split("-")[0] ? homeIndex += ncaamWeights[0] : awayIndex += ncaamWeights[0];
    homeTeam?.homeWinLoss?.split("-")[0] >= awayTeam?.awayWinLoss.split("-")[0] ? homeIndex += ncaamWeights[1] : awayIndex += ncaamWeights[1];
    homeTeam?.pointDiff >= awayTeam?.pointDiff ? homeIndex += ncaamWeights[2] : awayIndex += ncaamWeights[2];

    let ncaamWeightIndex = 3;
    const reverseComparisonStats = [];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += ncaamWeights[ncaamWeightIndex];
                    } else {
                        awayIndex += ncaamWeights[ncaamWeightIndex];
                    }
                    ncaamWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += ncaamWeights[ncaamWeightIndex];
                    } else {
                        awayIndex += ncaamWeights[ncaamWeightIndex];
                    }
                    ncaamWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

function adjustwncaabStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam?.seasonWinLoss?.split("-")[0] >= awayTeam?.seasonWinLoss?.split("-")[0] ? homeIndex += ncaawWeights[0] : awayIndex += ncaawWeights[0];
    homeTeam?.homeWinLoss?.split("-")[0] >= awayTeam?.awayWinLoss.split("-")[0] ? homeIndex += ncaawWeights[1] : awayIndex += ncaawWeights[1];
    homeTeam?.pointDiff >= awayTeam?.pointDiff ? homeIndex += ncaawWeights[2] : awayIndex += ncaawWeights[2];

    let ncaawWeightIndex = 3;
    const reverseComparisonStats = [];

    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat <= awayStat) {
                        homeIndex += ncaawWeights[ncaawWeightIndex];
                    } else {
                        awayIndex += ncaawWeights[ncaawWeightIndex];
                    }
                    ncaawWeightIndex++;
                }
            } else {
                if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                    if (homeStat >= awayStat) {
                        homeIndex += ncaawWeights[ncaawWeightIndex];
                    } else {
                        awayIndex += ncaawWeights[ncaawWeightIndex];
                    }
                    ncaawWeightIndex++;
                }
            }
        }
    }

    return { homeIndex, awayIndex };
}

const indexAdjuster = (currentOdds, sport, allPastGames) => {
    currentOdds.map(async (game, index) => {
        // Check if the game is in the future
        if (moment().isBefore(moment(game.commence_time))) {

            let homeTeam;
            let awayTeam;

            // Fetch team data based on sport
            if (game.sport === 'football') {
                if (game.sport_key === 'americanfootball_nfl') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'americanfootball_ncaaf') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.away_team
                    });
                }
                homeTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'baseball') {
                homeTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'basketball') {
                if (game.sport_key === 'basketball_nba') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_ncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_wncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                }
            } else if (game.sport === 'hockey') {
                homeTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.away_team });
            }


            let homeIndex = 0;
            let awayIndex = 0;
            if (homeTeam && awayTeam && homeTeam.stats && awayTeam.stats && homeTeam.seasonWinLoss && awayTeam.seasonWinLoss) {
                // Sport-specific conditions
                if (game.sport_key === 'americanfootball_nfl') {
                    ({ homeIndex, awayIndex } = adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'americanfootball_ncaaf') {
                    ({ homeIndex, awayIndex } = adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'icehockey_nhl') {
                    ({ homeIndex, awayIndex } = adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'basketball_nba') {
                    ({ homeIndex, awayIndex } = adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'baseball_mlb') {
                    ({ homeIndex, awayIndex } = adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'basketball_ncaab') {
                    ({ homeIndex, awayIndex } = adjustncaamStats(homeTeam, awayTeam, homeIndex, awayIndex));

                }
                else if (game.sport_key === 'basketball_wncaab') {
                    ({ homeIndex, awayIndex } = adjustwncaabStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
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
            function calculateWinrate(games, sport, homeTeam, awayTeam) {

                // Step 1: Filter games where predictionCorrect is true
                const usableGames = games.filter(game => (game.homeTeamIndex > 0 && game.awayTeamIndex > 0));

                // Step 2: Filter games that match the sport league
                const leagueGames = usableGames.filter(game => game.sport_key === sport.name);

                // Step 3: Filter games where the home_team matches the team
                const homeTeamGames = usableGames.filter(game => game.home_team === homeTeam || game.away_team === homeTeam);

                // Step 4: Filter games where the away_team matches the team
                const awayTeamGames = usableGames.filter(game => game.home_team === awayTeam || game.away_team === awayTeam);

                // Step 5: Calculate winrate for each scenario
                const totalGames = usableGames.length;
                const totalPredictionCorrect = usableGames.filter(game => game.predictionCorrect === true).length
                const totalLeagueGames = leagueGames.length;
                const totalHomeTeamGames = homeTeamGames.length;
                const totalAwayTeamGames = awayTeamGames.length;

                // Function to calculate winrate percentage
                const calculatePercentage = (part, total) => total > 0 ? (part / total) * 100 : 0;

                const winrate = {
                    allPredictionCorrect: calculatePercentage(totalPredictionCorrect, totalGames),
                    leaguePredictionCorrect: calculatePercentage(leagueGames.filter(game => game.predictionCorrect === true).length, totalLeagueGames),
                    homeTeamPredictionCorrect: calculatePercentage(homeTeamGames.filter(game => game.predictionCorrect === true).length, totalHomeTeamGames),
                    awayTeamPredictionCorrect: calculatePercentage(awayTeamGames.filter(game => game.predictionCorrect === true).length, totalAwayTeamGames),
                };

                return winrate;
            }

            // Call the function
            const winrate = calculateWinrate(allPastGames, sport, game.home_team, game.away_team);
            // Get all the values of the object
            const values = Object.values(winrate);

            // Calculate the sum of the values
            const sum = values.reduce((acc, curr) => acc + curr, 0);

            // Calculate the average
            const average = sum / values.length;

            // Update the Odds database with the calculated indices
            if (sport.name === game.sport_key) {
                await Odds.findOneAndUpdate({ 'id': game.id }, {
                    homeTeamIndex: homeIndex ? homeIndex * 10 : 0,
                    awayTeamIndex: awayIndex ? awayIndex * 10 : 0,
                    homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                    awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                    homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                    awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                    homeTeamAbbr: homeTeam?.abbreviation,
                    awayTeamAbbr: awayTeam?.abbreviation,
                    winPercent: average
                });
            }
        }
    });
}
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
        "Albany Great Danes": "UAlbany Great Danes",
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
        "Maryland-Eastern Shore Hawks": "Maryland Eastern Shore Hawks"

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
            teamName = 'Penn State Lady Lions'
        } else if (teamName === 'Georgia Bulldogs') {
            teamName = 'Georgia Lady Bulldogs'
        } else if (teamName === 'Tennessee Volunteers') {
            teamName = 'Tennessee Lady Volunteers'
        } else if (teamName === "Oklahoma State Cowboys") {
            teamName = "Oklahoma State Cowgirls"
        } else if (teamName === ' UNLV Rebels') {
            teamName = 'UNLV Lady Rebels'
        } else if (teamName === 'Texas Tech Red Raiders') {
            teamName = 'Texas Tech Lady Raiders'
        }
    }

    // // Replace hyphens with spaces
    // teamName = teamName.replace(/-/g, ' '); // Replace all hyphens with spaces

    // // Remove all punctuation and extra spaces
    // teamName = teamName.replace(/[^\w\s&]/g, ''); // Removes non-alphanumeric characters except spaces and ampersands
    // teamName = teamName.replace(/\s+/g, ' ').trim(); // Remove extra spaces and trim leading/trailing spaces

    return teamName;
}



const dataSeed = async () => {

    console.log("DB CONNECTED ------------------------------------------------- STARTING SEED")
    await retrieveTeamsandStats()
    // DETERMINE TEAMS
    console.log(`Finished TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
    // CLEANED AND FORMATTED
    let currentOdds
    let allPastGames = await PastGameOdds.find({})
    async function trainSportModel(sport, gameData) {
        currentOdds = await Odds.find({ sport_key: sport.name }) //USE THIS TO POPULATE UPCOMING GAME ODDS
        if (gameData.length === 0) {
            // Handle the case where there is no data for this sport
            console.log(`No data available for ${sport.league}. Skipping model training.`);
            // You could also add logic to handle this case more gracefully, 
            // such as logging the missing sport and providing a default model.
            return;
        }
        // Function to convert the game data into tensors
        const xs = []; // Features
        const ys = []; // Labels
        // Helper function to safely extract stats with fallback

        const { model, xsTensor, ysTensor } = await mlModelTraining(gameData, xs, ys, sport)



        // After model is trained and evaluated, integrate the weight extraction
        const evaluation = model.evaluate(xsTensor, ysTensor);
        const loss = evaluation[0].arraySync();
        const accuracy = evaluation[1].arraySync();

        if (accuracy < 1 || loss > 1) {
            console.log(`${sport.name} Model Loss:`, loss);
            console.log(`${sport.name} Model Accuracy:`, accuracy);
        } else {
            let ff = []
            let sportOdds = await Odds.find({ sport_key: sport.name })
            predictions(sportOdds, ff, model)
        }

        // Handle the weights extraction after training
        await handleSportWeights(model, sport);

        // Example of accessing the weights (e.g., after training)
        // Now you can access the weights for each sport like this:


        indexAdjuster(currentOdds, sport, allPastGames)






    }
    for (sport = 0; sport < sports.length; sport++) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12
        // Assuming the sport object is already defined
        if (sports[sport].multiYear) {
            // Multi-year sports (e.g., NFL, NBA, NHL, etc.)
            if ((currentMonth >= sports[sport].startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sports[sport].endMonth)) {
                const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name })
                await trainSportModel(sports[sport], pastGames)
            }
        } else {
            // Single-year sports (e.g., MLB)
            if (currentMonth >= sports[sport].startMonth && currentMonth <= sports[sport].endMonth) {
                const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name })
                await trainSportModel(sports[sport], pastGames)
            }
        }

        console.log(`${sports[sport].name} ML DONE @ ${moment().format('HH:mm:ss')}`)
    }
    // americanfootball_nfl:    11 sec
    // americanfootball_ncaaf:  4 min
    // basketball_nba:          2 min
    // icehockey_nhl:           3 min
    // baseball_mlb:            5 min
    // basketball_ncaab:        12 min
    // basketball_wncaab:        9 min

    console.log(`FINISHED TRAINING MODEL @ ${moment().format('HH:mm:ss')}`)
    currentOdds = await Odds.find()
    const dataSize = Buffer.byteLength(JSON.stringify(currentOdds), 'utf8');
    console.log(`Data size sent: ${dataSize / 1024} KB ${moment().format('HH:mm:ss')} dataSeed`);

    currentOdds.map(async (game) => {
        try {
            // Loop over all bookmakers
            await Promise.all(game.bookmakers.map(async (bookmaker) => {
                // Loop over all markets for each bookmaker
                await Promise.all(bookmaker.markets.map(async (market) => {
                    // Loop over all outcomes for each market
                    await Promise.all(market.outcomes.map(async (outcome) => {
                        // Perform the update using arrayFilters to target the correct outcome
                        if (outcome.price < 0) {
                            await Odds.findOneAndUpdate(
                                { 'id': game.id }, // Filter by game id
                                {
                                    $set: {
                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': Math.abs(outcome.price) / (Math.abs(outcome.price) + 100)
                                    }
                                },
                                {
                                    arrayFilters: [
                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                        { 'market.key': market.key }, // Match market by key
                                        { 'outcome._id': outcome._id } // Match outcome by its _id
                                    ]
                                }
                            );
                        } else {
                            await Odds.findOneAndUpdate(
                                { 'id': game.id }, // Filter by game id
                                {
                                    $set: {
                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': 100 / (outcome.price + 100)
                                    }
                                },
                                {
                                    arrayFilters: [
                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                        { 'market.key': market.key }, // Match market by key
                                        { 'outcome._id': outcome._id } // Match outcome by its _id
                                    ]
                                }
                            );
                        }
                    }));
                }));
            }));
        } catch (error) {
            console.error('Error updating outcomes:', error);
        }
    })
    console.log(`FINISHED CALCULATING IMPLIED PROBABILITY @ ${moment().format('HH:mm:ss')}`) //CLEANED AND FORMATTED
    // Fetch current odds and iterate over them using async loop
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
}


const oddsSeed = async () => {
    // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    await axios.all(sports.filter(sport => {
        const { startMonth, endMonth, multiYear } = sport;

        // Multi-year sports have a range that spans over the calendar year
        if (multiYear) {
            // Check if current month is within the range
            if (startMonth <= moment().month() + 1 || moment().month() + 1 <= endMonth) {
                return true;
            }
        } else {
            // Single-year sports are only valid in their specific month range
            if (moment().month() + 1 >= startMonth && moment().month() + 1 <= endMonth) {
                return true;
            }
        }
        return false;
    }).map((sport) =>
        axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)
    )).then(async (data) => {
        try {

            data.map(async (item) => {
                const dataSize = Buffer.byteLength(JSON.stringify(item.data), 'utf8');
                console.log(`Data size sent: ${dataSize / 1024} KB ${moment().format('HH:mm:ss')} oddsSeed`);
                item.data.map(async (event) => {
                    if (moment().isBefore(moment(event.commence_time))) {

                        // Normalize the team names in outcomes (used for the 'name' field)
                        const normalizeOutcomes = (outcomes, league) => {
                            return outcomes.map(outcome => ({
                                ...outcome,
                                name: normalizeTeamName(outcome.name, league) // Normalize the outcome team name
                            }));
                        };

                        let oddExist = await Odds.findOne({ id: event.id });

                        // Normalize team names for home and away teams
                        const normalizedHomeTeam = normalizeTeamName(event.home_team, event.sport_key);
                        const normalizedAwayTeam = normalizeTeamName(event.away_team, event.sport_key);

                        let homeTeam
                        let awayTeam
                        let scheduleSport

                        // Fetch team data based on sport
                        if (event.sport_key === 'americanfootball_nfl') {
                            homeTeam = await UsaFootballTeam.findOne({
                                'sport_key': 'americanfootball_nfl',
                                'espnDisplayName': event.home_team
                            });
                            awayTeam = await UsaFootballTeam.findOne({
                                'sport_key': 'americanfootball_nfl',
                                'espnDisplayName': event.away_team
                            });
                            scheduleSport = 'football'
                        } else if (event.sport_key === 'americanfootball_ncaaf') {
                            homeTeam = await UsaFootballTeam.findOne({
                                'sport_key': 'americanfootball_ncaaf',
                                'espnDisplayName': event.home_team
                            });
                            awayTeam = await UsaFootballTeam.findOne({
                                'sport_key': 'americanfootball_ncaaf',
                                'espnDisplayName': event.away_team
                            });
                            scheduleSport = 'football'
                        } else if (event.sport_key === 'basketball_nba') {
                            homeTeam = await BasketballTeam.findOne({
                                'league': 'nba',
                                'espnDisplayName': event.home_team
                            });
                            awayTeam = await BasketballTeam.findOne({
                                'league': 'nba',
                                'espnDisplayName': event.away_team
                            });
                            scheduleSport = 'basketball'
                        } else if (event.sport_key === 'basketball_ncaab') {
                            homeTeam = await BasketballTeam.findOne({
                                'league': 'mens-college-basketball',
                                'espnDisplayName': event.home_team
                            });
                            awayTeam = await BasketballTeam.findOne({
                                'league': 'mens-college-basketball',
                                'espnDisplayName': event.away_team
                            });
                            scheduleSport = 'basketball'
                        } else if (event.sport_key === 'basketball_wncaab') {
                            homeTeam = await BasketballTeam.findOne({
                                'league': 'womens-college-basketball',
                                'espnDisplayName': event.home_team
                            });
                            awayTeam = await BasketballTeam.findOne({
                                'league': 'womens-college-basketball',
                                'espnDisplayName': event.away_team
                            });
                            scheduleSport = 'basketball'
                        } else if (event.sport_key === 'baseball_mlb') {
                            homeTeam = await BaseballTeam.findOne({ 'espnDisplayName': event.home_team });
                            awayTeam = await BaseballTeam.findOne({ 'espnDisplayName': event.away_team });
                            scheduleSport = 'baseball'
                        } else if (event.sport_key === 'icehockey_nhl') {
                            homeTeam = await HockeyTeam.findOne({ 'espnDisplayName': event.home_team });
                            awayTeam = await HockeyTeam.findOne({ 'espnDisplayName': event.away_team });
                            scheduleSport = 'hockey'
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

                        // Normalize the outcomes (nested inside bookmakers -> markets -> outcomes)
                        const updatedBookmakers = event.bookmakers.map(bookmaker => ({
                            ...bookmaker,
                            markets: bookmaker.markets.map(market => ({
                                ...market,
                                outcomes: normalizeOutcomes(market.outcomes, event.sport_key) // Normalize outcomes names
                            }))
                        }));


                        if (!event.sport_key) {
                            console.error(`sportType is undefined for event: ${event.id}`);
                        } else {
                            if (oddExist) {
                                // Update the existing odds with normalized team names and sport type
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    homeTeamIndex: oddExist.homeTeamIndex ? oddExist.homeTeamIndex : 0,
                                    awayTeamIndex: oddExist.awayTeamIndex ? oddExist.awayTeamIndex : 0,
                                    ...event,
                                    homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                                    awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                                    homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                                    awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                                    homeTeamAbbr: homeTeam?.abbreviation,
                                    awayTeamAbbr: awayTeam?.abbreviation,
                                    home_team: normalizedHomeTeam,
                                    away_team: normalizedAwayTeam,
                                    bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                    sport: scheduleSport,
                                });
                            } else {
                                // Create a new odds entry with normalized team names and sport type
                                await Odds.create({
                                    homeTeamIndex: 0,
                                    awayTeamIndex: 0,
                                    ...event,
                                    homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                                    awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                                    homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                                    awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                                    homeTeamAbbr: homeTeam?.abbreviation,
                                    awayTeamAbbr: awayTeam?.abbreviation,
                                    home_team: normalizedHomeTeam,
                                    away_team: normalizedAwayTeam,
                                    bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                    sport: scheduleSport,
                                });
                            }
                        }
                    }
                })
            })

            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    })
    dataSeed()
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);

}
const removeSeed = async () => {
    // console.log(process.memoryUsage());
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00`;  // YYYY-MM-DDTHH:mm:ss format
    const startOfNextYear = `${currentYear + 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format

    // Get current date and calculate the date 7 days ago
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7); // Subtract 7 days

    const yesterday = new Date(currentDate)
    yesterday.setDate(currentDate.getDate() - 1)

    // Format the dates to match your query format
    const startOfWeek = sevenDaysAgo.toISOString(); // This gives you the date 7 days ago in ISO format

    // Fetch current odds and past odds within the last week
    let currentOdds = await Odds.find();
    await removePastGames(currentOdds);

    currentOdds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 });

    let pastOdds = await PastGameOdds.find({
        commence_time: { $gte: yesterday.toISOString(), $lt: currentDate.toISOString() }
    }).sort({ commence_time: -1, winPercent: 1 });



    const currentData = Buffer.byteLength(JSON.stringify(currentOdds), 'utf8');
    console.log(`Data size sent: ${currentData / 1024} KB ${moment().format('HH:mm:ss')} removeSeed current`);
    const pastData = Buffer.byteLength(JSON.stringify(pastOdds), 'utf8');
    console.log(`Data size sent: ${pastData / 1024} KB ${moment().format('HH:mm:ss')} removeSeed past`);
    await emitToClients('gameUpdate', currentOdds);
    await emitToClients('pastGameUpdate', pastOdds);
    currentOdds = null
    pastOdds = null

}

const espnSeed = async () => {
    const fetchTeamData = async (teamID, sport) => {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.espnSport}/${sport.league}/teams/${teamID}`);
        const teamData = await response.json();
        return teamData;
    };
    const upsertTeamsInBulk = async (teams, sport) => {
        let TeamModel;
        switch (sport) {
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
        const bulkOps = teams.map(team => ({
            updateOne: {
                filter: {
                    'espnID': team.espnID,        // Unique to the team
                    'league': team.league,        // Ensures uniqueness within the league
                },
                update: { $set: team },
                upsert: true,
            }
        }));
        await TeamModel.bulkWrite(bulkOps);
    };
    const promises = [];
    const MAX_CONCURRENT_REQUESTS = 2000; // You can adjust this number to control concurrency


    // Loop through each sport
    for (let sport of sports) {
        let teamArr = [];
        console.log(`starting ${sport.league} @ ${moment().format("h:mma")}`)
        // Loop through each team ID sequentially
        if (sport.league === 'college-football' || sport.league === 'mens-college-basketball' || sport.league === 'womens-college-basketball') {
            for (let teamID = 1; teamID < 150000; teamID++) {
                try {
                    promises.push(fetchTeamData(teamID, sport).then((teamListJson) => {
                        // Log the team data if available
                        if (teamListJson && teamListJson.team && teamListJson.team.isActive) {
                            const { id: espnID, location, name: teamName, abbreviation, school, logos, displayName: espnDisplayName } = teamListJson.team;
                            // const espnDisplayName = formatDisplayName(teamListJson.team);
                            teamArr.push({
                                espnID,
                                espnDisplayName,
                                location: location,
                                teamName,
                                league: sport.league,
                                abbreviation,
                                logo: logos ? logos[0].href : undefined,
                                school
                            });
                        }
                        else {
                        }
                    }))

                } catch (error) {
                    console.error(`Error fetching data for team ID#${teamID}:`, error);
                }
                // If we reach the maximum number of concurrent requests, wait for them to resolve
                if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                    await Promise.all(promises);
                    promises.length = 0; // Clear the array after waiting
                }
            }
        } else {
            for (let teamID = 1; teamID < 150000; teamID++) {
                try {
                    promises.push(fetchTeamData(teamID, sport).then((teamListJson) => {

                        // Log the team data if available
                        if (teamListJson && teamListJson.team && teamListJson.team.isActive) {
                            const { id: espnID, location, name: teamName, abbreviation, logos } = teamListJson.team;
                            let espnDisplayName;
                            switch (teamListJson.team.displayName) {
                                case "St. Louis Blues":
                                    espnDisplayName = "St Louis Blues";
                                    break;
                                case "Montreal Canadiens":
                                    espnDisplayName = "Montréal Canadiens";
                                    break;
                                case "LA Clippers":
                                    espnDisplayName = "Los Angeles Clippers";
                                    break;
                                default:
                                    espnDisplayName = teamListJson.team.displayName;
                                    break;
                            }

                            teamArr.push({
                                espnID,
                                espnDisplayName,
                                location,
                                teamName,
                                league: sport.league,
                                abbreviation,
                                logo: logos ? logos[0].href : undefined
                            });
                        } else {
                        }
                    }))
                } catch (error) {
                    console.error(`Error fetching data for team ID#${teamID}:`, error);
                }
                // If we reach the maximum number of concurrent requests, wait for them to resolve
                if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                    await Promise.all(promises);
                    promises.length = 0; // Clear the array after waiting
                }
            }
        }
        console.log(`writing teams @ ${moment().format("h:mma")}`)
        upsertTeamsInBulk(teamArr, sport.espnSport)
        console.log(`finished teams @ ${moment().format("h:mma")}`)
    }


    // Run the normalization function
    // await normalizeAllTeamNames();
    // fetchAllTeamData(sport, teams, sport.statYear)

};


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
// oddsSeed()
// dataSeed()
// pastGameStatsPoC()

module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed }