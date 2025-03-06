require('dotenv').config()
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../../models');
const axios = require('axios')
const moment = require('moment')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const { emitToClients } = require('../../socketManager');
const { retrieveTeamsandStats } = require('../helperFunctions/dataHelpers/retrieveTeamsandStats')
const { removePastGames } = require('../helperFunctions/dataHelpers/removeHelper')
const { indexAdjuster } = require('../helperFunctions/mlModelFuncs/indexHelpers')
const { pastGameStatsPoC } = require('../helperFunctions/dataHelpers/pastGamesHelper')
const { extractSportFeatures, trainSportModelKFold, handleSportWeights, evaluateMetrics } = require('../helperFunctions/mlModelFuncs/trainingHelpers')
const { normalizeTeamName, checkNaNValues } = require('../helperFunctions/dataHelpers/dataSanitizers')
const { impliedProbCalc } = require('../helperFunctions/dataHelpers/impliedProbHelp')
const { sports } = require('../constants');
const pastGameOdds = require('../../models/pastGameOdds');

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs

// Define the utility functions above your existing code
const mlModelTrainSeed = async () => {
    for (sport = 0; sport < sports.length; sport++) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12
        // Assuming the sport object is already defined
        if (sports[sport].multiYear) {
            // Multi-year sports (e.g., NFL, NBA, NHL, etc.)
            if ((currentMonth >= sports[sport].startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sports[sport].endMonth)) {
                const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name }).sort({ commence_time: -1 })
                if (pastGames.length > 0) {
                    await trainSportModelKFold(sports[sport], pastGames)
                }
            }
        } else {
            // Single-year sports (e.g., MLB)
            if (currentMonth >= sports[sport].startMonth && currentMonth <= sports[sport].endMonth) {
                const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name }).sort({ commence_time: -1 })
                if (pastGames.length > 0) {
                    await trainSportModelKFold(sports[sport], pastGames)
                }

            }
        }

        console.log(`${sports[sport].name} ML DONE @ ${moment().format('HH:mm:ss')}`)
    }
}

const dataSeed = async () => {

    console.log("DB CONNECTED ------------------------------------------------- STARTING SEED")
    await retrieveTeamsandStats()
    // DETERMINE TEAMS
    console.log(`Finished TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
    // CLEANED AND FORMATTED
    let currentOdds
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12

    for (let sport = 0; sport < sports.length; sport++) {
        const modelPath = `./model_checkpoint/${sports[sport].name}_model/model.json`;
        // Define the path to the model directory
        const modelDir = `./model_checkpoint/${sports[sport].name}_model`;
        const loadOrCreateModel = async () => {
            try {
                if (fs.existsSync(modelPath)) {
                    return await tf.loadLayersModel(`file://./model_checkpoint/${sports[sport].name}_model/model.json`);
                }
            } catch (err) {
                console.log(err)
            }
        }

        const model = await loadOrCreateModel()
        if (model) {

            let sportGames = await Odds.find({
                sport_key: sports[sport].name
            })

            let ff = []
            if (sportGames.length > 0) {
                // Step 1: Extract the features for each game
                for (const game of sportGames) {
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const homeStats = game.homeTeamStats;
                        const awayStats = game.awayTeamStats;

                        // Extract features based on sport
                        const features = extractSportFeatures(homeStats, awayStats, game.sport_key);
                        ff.push(features);  // Add the features for each game
                    }
                }
                // Step 2: Create a Tensor for the features array
                const ffTensor = tf.tensor2d(ff);

                // Step 3: Get the predictions
                const predictions = await model.predict(ffTensor, {training: false});


                // Step 4: Convert predictions tensor to array
                const probabilities = await predictions.array();  // Resolves to an array





                for (let index = 0; index < sportGames.length; index++) {
                    const game = sportGames[index];
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const predictedWinPercent = probabilities[index][0]; // Probability for the home team win

                        // Make sure to handle NaN values safely
                        const predictionStrength = Number.isNaN(predictedWinPercent) ? 0 : predictedWinPercent;

                        // Step 6: Determine the predicted winner
                        const predictedWinner = predictedWinPercent >= 0.5 ? 'home' : 'away';

                        // Update the game with prediction strength
                        await Odds.findOneAndUpdate(
                            { id: game.id },
                            {
                                predictionStrength: predictionStrength > .50 ? predictionStrength : 1 - predictionStrength,
                                predictedWinner: predictedWinner,
                                predictionCorrect: game.winner === predictedWinner ? true : false
                            }
                        );
                    }
                }
                // Step 5: Loop through each game and update with predicted probabilities

            }

            // Handle the weights extraction after training
            await handleSportWeights(model, sports[sport]);

            let allPastGames = await PastGameOdds.find()
            indexAdjuster(sportGames, sports[sport], allPastGames)
        }
        console.log(`${sports[sport].name} ML DONE @ ${moment().format('HH:mm:ss')}`)

    }



    currentOdds = await Odds.find()
    impliedProbCalc(currentOdds)

    const dataSize = Buffer.byteLength(JSON.stringify(currentOdds), 'utf8');
    console.log(`Data size sent: ${dataSize / 1024} KB ${moment().format('HH:mm:ss')} dataSeed`);

    // Fetch current odds and iterate over them using async loop
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
}

const oddsSeed = async () => {
    // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    const axiosWithBackoff = async (url, retries = 5, delayMs = 1000) => {
        try {
            const response = await axios.get(url);
            return response;
        } catch (error) {
            if (retries === 0) throw error;
            console.log(`Retrying request... (${retries} attempts left)`);
            await delay(delayMs);
            return axiosWithBackoff(url, retries - 1, delayMs * 2);  // Exponential backoff
        }
    };

    const fetchDataWithBackoff = async (sports) => {

        // const requests = sports.map(sport => {
        //     if(process.env.PRODUCTION === 'true'){
        //         axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)
        //     }else{
        //         console.log(process.env.PRODUCTION)
        //         axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TRAVM}&regions=us&oddsFormat=american&markets=h2h`)
        //     }
        // });
        let requests
        if (process.env.PRODUCTION === 'true') {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)

            );
        } else {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TRAVM}&regions=us&oddsFormat=american&markets=h2h`)

            );
        }
        await axios.all(requests).then(async (data) => {
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
        });
    };

    await fetchDataWithBackoff(sports.filter(sport => {
        const { startMonth, endMonth, multiYear } = sport;
        if (multiYear) {
            if (startMonth <= moment().month() + 1 || moment().month() + 1 <= endMonth) {
                return true;
            }
        } else {
            if (moment().month() + 1 >= startMonth && moment().month() + 1 <= endMonth) {
                return true;
            }
        }
        return false;
    }));

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

const pastGamesRePredict = async () => {
    sports.forEach(async (sport) => {
        if (sport.name != 'americanfootball_ncaaf') {
            let pastGames = await PastGameOdds.find({
                sport_key: sport.name,
                commence_time: { $gte: '2025-01-14T00:40:00Z' }
            });

            // Define the path to the model
            const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
            // Define the path to the model directory
            const modelDir = `./model_checkpoint/${sport.name}_model`;

            // Define the model
            const loadOrCreateModel = async () => {
                try {
                    if (sport.name != 'baseball_mlb') {
                        return await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
                    }

                } catch (err) {
                    console.log(err)
                }
            }
            const model = await loadOrCreateModel()
            // console.log(model)
            // model.compile({
            //     optimizer: tf.train.adam(.0001),
            //     loss: 'binaryCrossentropy',
            //     metrics: ['accuracy']
            // });
            // // Train the model
            // await model.fit(xsTensor, ysTensor, {
            //     epochs: 100,
            //     batchSize: 64,
            //     validationSplit: 0.3,

            //     verbose: false
            // });
            //TODO LOAD ML CHECKPOINT FOR SPORT
            //TODO RUN PAST GAMES FOR SPORT THROUGH PREDICTION, CHANGING THE VALUE OF PREDICTED WINNER TO THE NEW PREDICTION
            let ff = []
            if (pastGames.length > 0) {
                // Step 1: Extract the features for each game
                for (const game of pastGames) {
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const homeStats = game.homeTeamStats;
                        const awayStats = game.awayTeamStats;

                        // Extract features based on sport
                        const features = extractSportFeatures(homeStats, awayStats, game.sport_key);
                        ff.push(features);  // Add the features for each game
                    }
                }

                // Step 2: Create a Tensor for the features array
                const ffTensor = tf.tensor2d(ff);

                const logits = model.predict(ffTensor, {training: false}); // logits without sigmoid

                // Step 3: Get the predictions
                const predictions = await model.predict(ffTensor, {training: false});

                // Step 4: Convert predictions tensor to array
                const probabilities = await predictions.array();  // Resolves to an array
                console.log(probabilities)

                // Step 5: Loop through each game and update with predicted probabilities
                for (let index = 0; index < pastGames.length; index++) {
                    const game = pastGames[index];
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const predictedWinPercent = probabilities[index][0]; // Probability for the home team win

                        // Make sure to handle NaN values safely
                        const predictionStrength = Number.isNaN(predictedWinPercent) ? 0 : predictedWinPercent;

                        // Step 6: Determine the predicted winner
                        const predictedWinner = predictedWinPercent >= 0.5 ? 'home' : 'away';

                        // Update the game with prediction strength
                        await PastGameOdds.findOneAndUpdate(
                            { id: game.id },
                            {
                                predictionStrength: predictionStrength > .50 ? predictionStrength : 1 - predictionStrength,
                                predictedWinner: predictedWinner,
                                predictionCorrect: game.winner === predictedWinner ? true : false
                            }
                        );
                    }
                }
            }
        }

    })


}

const hyperparameterGridSearch = async () => {
    // const learningRates = [.00001, .0001, .001, .01, .1]
    // const batchSizes = [16, 32, 64, 128, 256]
    // const epochs = [10, 50, 100, 200]
    // const l2Regs = [.00001, .0001, .001, .01, .1]
    // const dropoutRegs = [.2, .25, .3, .35, .4, .45, .5]
    // const hiddenLayers = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    // const kernalInitializers = ['glorotNormal', 'glorotUniform', 'heNormal', 'heUniform']
    // const numKFolds = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    // const layerNeurons = [16, 32, 64, 128, 256, 512, 1000]

    const paramSpace = {
        learningRates: [.00001, .0001, .001, .01, .1],
        batchSizes: [16, 32, 64, 128, 256],
        epochs: [10, 50, 100, 200],
        l2Regs: [.00001, .0001, .001, .01, .1],
        dropoutRegs: [.2, .25, .3, .35, .4, .45, .5],
        hiddenLayers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
        kernalInitializers: ['glorotNormal', 'glorotUniform', 'heNormal', 'heUniform'],
        numKFolds: [2, 3, 4, 5, 6, 7, 8, 9, 10],
        layerNeurons: [16, 32, 64, 128, 256, 512, 1000],
    }

    const createModel = async (learningRate, batchSize, epochs, l2Reg, dropoutReg, hiddenLayerNum, kernalinitializer, numKFolds, layerNeurons, xs) => {
        const model = tf.sequential()
        const l2Regularizer = tf.regularizers.l2({ l2: l2Reg });  // Adjust the value to suit your needs
        model.add(tf.layers.dense({ units: xs[0].length, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
        for (i = 0; i < hiddenLayerNum; i++) {
            model.add(tf.layers.dense({ units: layerNeurons, activation: 'relu', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
            model.add(tf.layers.dropout({ rate: dropoutReg }));
        }
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));

        model.compile({
            optimizer: tf.train.adam(learningRate),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model
    }

    // Function to split data into k folds
    function getKFoldData(k, data) {
        const folds = [];
        const foldSize = Math.floor(data.length / k);

        for (let i = 0; i < k; i++) {
            const start = i * foldSize;
            const end = (i + 1) * foldSize;
            const fold = data.slice(start, end); // Get the i-th fold
            folds.push(fold);
        }

        return folds;
    }

    // Function to perform training and validation on each fold
    async function trainAndEvaluateKFold(model, k, X_train, y_train, epoch, batchSize) {
        const xArray = X_train.arraySync();  // Convert tensor to array
        const yArray = y_train.arraySync();  // Convert tensor to array


        const folds = getKFoldData(k, xArray);
        let foldAccuracies = [];

        for (let i = 0; i < k; i++) {
            const valFold = folds[i];
            const trainFolds = [...folds.slice(0, i), ...folds.slice(i + 1)].flat(); // Combine the remaining folds for training

            // Split into inputs and targets for this fold
            const [X_train_fold, y_train_fold] = [trainFolds.map(d => d[0]), trainFolds.map(d => d[1])];
            const [X_val_fold, y_val_fold] = [valFold.map(d => d[0]), valFold.map(d => d[1])];

            console.log(model)


            // Evaluate the model performance on the validation fold
            const evalResult = model.evaluate(X_val_fold, y_val_fold);
            const accuracy = evalResult[1].dataSync()[0]; // Get the accuracy score
            foldAccuracies.push(accuracy);
        }

        // Return the average accuracy across all folds
        const avgAccuracy = foldAccuracies.reduce((a, b) => a + b, 0) / foldAccuracies.length;
        return avgAccuracy;
    }
    for (let sport of sports) {
        let bestAccuracy = 0;
        let bestParams = {
            epochs: 10,
            batchSize: 16,
            KFolds: 2,
            hiddenLayerNum: 2,
            learningRate: .00001,
            l2Reg: .00001,
            dropoutReg: .2,
            layerNeurons: 16,
            kernalInitializer: 'glorotNormal'
        };
        for (let iterations = 0; iterations < 100; iterations++) {
            let currentParams = {}

            for (const param in paramSpace) {
                const values = paramSpace[param]

                const randomIndex = Math.floor(Math.random() * values.length)
                currentParams[param] = values[randomIndex]
            }


            console.log(`--------------- ${sport.name}-------------------`)
            let gameData = await PastGameOdds.find({ sport_key: sport.name })

            function decayCalcByGames(gamesProcessed, decayFactor) { //FOR USE TO DECAY BY GAMES PROCESSED
                // Full strength for the last 25 games
                const gamesDecayThreshold = sport.gameDecayThreshold;
                if (gamesProcessed <= gamesDecayThreshold) {
                    return 1; // No decay for the most recent 25 games
                } else {
                    // Apply decay based on the number of games processed
                    const decayFactorAdjusted = decayFactor || 0.99;  // Use a default decay factor if none is provided
                    const decayAmount = Math.pow(decayFactorAdjusted, (gamesProcessed - gamesDecayThreshold));
                    return decayAmount;  // Decay decreases as the games processed increases
                }
            }
            let xs = []
            let ys = []
            let gamesProcessed = 0; // Track how many games have been processed
            // FOR USE TO DECAY BY GAMES PROCESSED
            gameData.forEach(game => {
                const homeStats = game.homeTeamStats;
                const awayStats = game.awayTeamStats;

                // Extract features based on sport
                let features = extractSportFeatures(homeStats, awayStats, sport.name);

                // Calculate decay based on the number of games processed
                const decayWeight = decayCalcByGames(gamesProcessed, sport.decayFactor);  // get the decay weight based on gamesProcessed

                // Apply decay to each feature
                features = features.map(feature => feature * decayWeight);

                // Set label to 1 if home team wins, 0 if away team wins
                const correctPrediction = game.winner === 'home' ? 1 : 0;
                checkNaNValues(features, game);  // Check features

                xs.push(features);
                ys.push(correctPrediction);

                gamesProcessed++;  // Increment the counter for games processed
            });
            // Function to calculate dynamic class weights
            const calculateClassWeights = (ys) => {

                const homeWins = ys.filter(y => y === 1).length;   // Count the home wins (ys = 1)
                const homeLosses = ys.filter(y => y === 0).length; // Count the home losses (ys = 0)


                const totalExamples = homeWins + homeLosses;
                const classWeightWin = totalExamples / (2 * homeWins);   // Weight for home wins
                const classWeightLoss = totalExamples / (2 * homeLosses); // Weight for home losses

                return {
                    0: classWeightLoss, // Weight for home losses
                    1: classWeightWin   // Weight for home wins
                };
            };

            // Convert arrays to tensors
            const xsTensor = tf.tensor2d(xs);

            const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

            // Flatten ysTensor to convert it to a 1D array
            const ysArray = await ysTensor.reshape([-1]).array();
            // Dynamically calculate class weights
            const classWeights = calculateClassWeights(ysArray);

            // Create a fresh model for each hyperparameter combination
            const model = await createModel(currentParams.learningRate, currentParams.batchSize, currentParams.epoch, currentParams.l2Reg, currentParams.dropoutReg, currentParams.hiddenLayerNum, currentParams.kernalInitializer, currentParams.KFolds, currentParams.layerNeuronNum, xs);
            // Perform K-Fold cross-validation with this hyperparameter combination
            //const avgAccuracy = await trainAndEvaluateKFold(model, KFolds, xsTensor, ysTensor, epoch, batchSize); // 5-fold cross-validation
            // Train the model on the current fold
            await model.fit(xsTensor, ysTensor, {
                epochs: currentParams.epoch, // Example epochs, you should set this dynamically
                batchSize: currentParams.batchSize, // Example batch size, you should set this dynamically
                validationSplit: 0.3,
                classWeight: classWeights,
                verbose: false,
                shuffle: false,
            });
            const evaluation = model.evaluate(xsTensor, ysTensor);
            const loss = evaluation[0].arraySync();
            const accuracy = evaluation[1].arraySync();
            // Now, calculate precision, recall, and F1-score

            const metrics = evaluateMetrics(ysTensor, model.predict(xsTensor, {training: false}));
            // Log the metrics
            console.log(`${sport.name} Model Loss:`, loss);
            console.log(`${sport.name} Model Accuracy:`, accuracy);
            console.log(`${sport.name} Model Precision:`, metrics.precision);
            console.log(`${sport.name} Model Recall:`, metrics.recall);
            console.log(`${sport.name} Model F1-Score:`, metrics.f1Score);
            console.log(`truePositives: ${metrics.truePositives}`);
            console.log(`falsePositives: ${metrics.falsePositives}`);
            console.log(`falseNegatives: ${metrics.falseNegatives}`);
            console.log(`trueNegatives: ${metrics.trueNegatives}`);

            // console.log(`Average accuracy across folds: ${avgAccuracy}`);

            // // Track the best performing hyperparameters based on k-fold cross-validation
            if (metrics.f1Score > bestAccuracy) {
                console.log('new bestParams', {
                    bestAccuracy: metrics.f1Score,
                    epochs: currentParams.epochs,
                    batchSize: currentParams.batchSizes,
                    KFolds: currentParams.numKFolds,
                    hiddenLayerNum: currentParams.hiddenLayers,
                    learningRate: currentParams.learningRates,
                    l2Reg: currentParams.l2Regs,
                    dropoutReg: currentParams.dropoutRegs,
                    kernalInitializer: currentParams.kernalInitializers
                })
                bestAccuracy = metrics.f1Score;
                bestParams = {
                    bestAccuracy: metrics.f1Score,
                    epochs: currentParams.epochs,
                    batchSize: currentParams.batchSizes,
                    KFolds: currentParams.numKFolds,
                    hiddenLayerNum: currentParams.hiddenLayers,
                    learningRate: currentParams.learningRates,
                    l2Reg: currentParams.l2Regs,
                    dropoutReg: currentParams.dropoutRegs,
                    kernalInitializer: currentParams.kernalInitializers
                };
            }

        }




        console.log('Best Hyperparameters:', bestParams);
        console.log('Best Cross-Validation Accuracy:', bestAccuracy);

        if (!fs.existsSync('./hyperParameterTesting')) {
            console.log('Creating model directory...');
            // Create the directory (including any necessary parent directories)
            fs.mkdirSync('./hyperParameterTesting', { recursive: true });
        }
        fs.writeFile(`./hyperParameterTesting/${sport.name}bestSettings.json`, JSON.stringify(bestParams), function (err) {
            if (err) {
                console.log(err)
            }
        })
    }




}



// hyperparameterGridSearch()
// pastGamesRePredict()
// oddsSeed()
dataSeed()
// removeSeed()
// pastGameStatsPoC()
// mlModelTrainSeed()

module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed, mlModelTrainSeed }