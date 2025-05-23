require('dotenv').config()
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../models');
const axios = require('axios');
const moment = require('moment')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const { emitToClients } = require('../../socketManager');
const { retrieveTeamsandStats } = require('../helperFunctions/dataHelpers/retrieveTeamsandStats')
const { removePastGames } = require('../helperFunctions/dataHelpers/removeHelper')
const { indexAdjuster, pastGamesReIndex } = require('../helperFunctions/mlModelFuncs/indexHelpers')
const { predictions, trainSportModelKFold } = require('../helperFunctions/mlModelFuncs/trainingHelpers')
const { hyperparameterRandSearch, valueBetGridSearch } = require('../helperFunctions/mlModelFuncs/searchHelpers');
const { normalizeTeamName } = require('../helperFunctions/dataHelpers/dataSanitizers')
const { transporter } = require('../constants')

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs

const dataSeed = async () => {
    console.log("DB CONNECTED ------------------------------------------------- STARTING DATA SEED")
    // UPDATE TEAMS WITH MOST RECENT STATS // WORKING AS LONG AS DYNAMIC STAT YEAR CAN WORK CORRECTLY
    let sports = await Sport.find({})
    await retrieveTeamsandStats(sports)
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
    sports = []
    if (global.gc) global.gc();
}

const mlModelTrainSeed = async () => {
    console.log("DB CONNECTED ------------------------------------------------- STARTING ML SEED")
    const sports = await Sport.find({})
    const odds = await Odds.find()
    for (let sport of sports) {
        // retrieve upcoming games
        let upcomingGames = odds.filter((game) => game.sport_key === sport.name)
        // Multi-year sports (e.g., NFL, NBA, NHL, etc.)
        if (upcomingGames.length > 0) {
            let pastGames = await PastGameOdds.find({ sport_key: sport.name }).sort({ commence_time: -1 })
            if (pastGames.length > 10) {
                console.log(`${sport.name} ML STARTING @ ${moment().format('HH:mm:ss')}`)
                await trainSportModelKFold(sport, pastGames)
            } else {
                console.log(`NOT ENOUGH ${sport.name} DATA`)
            }
            console.log(`${sport.name} ML DONE @ ${moment().format('HH:mm:ss')}`)
        } else {
            console.log(`${sport.name} NOT IN SEASON`)
        }

    }
    if (global.gc) global.gc();
    upcomingGames = []
    pastGames = []
    await pastGamesReIndex()
    await valueBetGridSearch(sports)
    const currentDate = new Date();
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    let yesterdayGames = await PastGameOdds.find({ commence_time: { $gte: yesterday } })
    const stats = {
        date: new Date().toLocaleDateString(),
        totalPredictions: yesterdayGames.length,
        wins: yesterdayGames.filter((game) => game.predictionCorrect === true).length,
        losses: yesterdayGames.filter((game) => game.predictionCorrect === false).length,
        //TODO ADD SPORTS BREAKDOWN STATS
        //TODO ADD BIGGEST WIN
    };

    const html = `
        <h2>📊 Daily Sports Prediction Report - ${stats.date}</h2>
        <p>This is your automated status report. App is running (PM2 active).</p>
        <hr />
        <h3>🏁 Overall Summary</h3>
        <ul>
          <li>Total Predictions: <strong>${stats.totalPredictions}</strong></li>
          <li>Wins: <strong style="color:green">${stats.wins}</strong></li>
          <li>Losses: <strong style="color:red">${stats.losses}</strong></li>
          <li>Win Rate: <strong>${((stats.wins / stats.totalPredictions) * 100).toFixed(1)}%</strong></li>
        </ul>
      
        <hr />
        <p style="color:gray;font-size:0.9em;">App check-in via PM2 successful — ${new Date().toLocaleTimeString()}</p>
      `;

    //   <h3>🏀 Wins by Sport</h3>
    //   <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;">
    //     <tr><th>Sport</th><th>Wins</th><th>Losses</th></tr>
    //     ${Object.entries(stats.sportsBreakdown).map(([sport, {wins, losses}]) => `
    //       <tr>
    //         <td>${sport}</td>
    //         <td style="color:green">${wins}</td>
    //         <td style="color:red">${losses}</td>
    //       </tr>
    //     `).join('')}
    //   </table>

    //   <h3>💥 Biggest Win</h3>
    //   <p>
    //     <strong>${stats.biggestWin.matchup}</strong> (${stats.biggestWin.sport}) <br />
    //     Odds: ${stats.biggestWin.odds} <br />
    //     Result: <strong style="color:green">${stats.biggestWin.result}</strong>
    //   </p>

    const mailOptions = {
        from: '"BetterBetsAPI" betterbetsApp@gmail.com',
        to: process.env.NODEMAILER_RECIPIENT,
        subject: `Daily Sports Report - ${stats.date}`,
        html,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent:", info.messageId);

    if (global.gc) global.gc();
}

const oddsSeed = async () => {
    const sports = await Sport.find({})
    // RETRIEVE ODDS
    console.log(`BEGINNING ODDS SEEDING @ ${moment().format('HH:mm:ss')}`)
    const axiosWithBackoff = async (url, retries = 5, delayMs = 1000) => {
        try {
            const response = await axios.get(url);
            return response;
        } catch (error) {
            if (retries === 0) throw error;
            console.log(`Retrying request... (${retries} attempts left)`);
            // await delay(delayMs);
            return axiosWithBackoff(url, retries - 1, delayMs * 2);  // Exponential backoff
        }
    };

    const fetchDataWithBackoff = async (sports) => {
        let requests
        const currentDate = new Date()
        const currentHour = currentDate.getHours()
        if (currentHour >= 0 && currentHour < 5) {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)

            );
        } else if (currentHour >= 5 && currentHour < 11) {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TRAVM}&regions=us&oddsFormat=american&markets=h2h`)

            );
        } else if (currentHour >= 11 && currentHour < 17) {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_LOWRES}&regions=us&oddsFormat=american&markets=h2h`)

            );
        } else if (currentHour >= 17 && currentHour < 24) {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_SMOKEY}&regions=us&oddsFormat=american&markets=h2h`)

            );
        }
        await axios.all(requests).then(async (data) => {
            try {
                data.map(async (item) => {
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
                                    'espnDisplayName': normalizedHomeTeam
                                });
                                awayTeam = await UsaFootballTeam.findOne({
                                    'sport_key': 'americanfootball_nfl',
                                    'espnDisplayName': normalizedAwayTeam
                                });
                                scheduleSport = 'football'
                            } else if (event.sport_key === 'americanfootball_ncaaf') {
                                homeTeam = await UsaFootballTeam.findOne({
                                    'sport_key': 'americanfootball_ncaaf',
                                    'espnDisplayName': normalizedHomeTeam
                                });
                                awayTeam = await UsaFootballTeam.findOne({
                                    'sport_key': 'americanfootball_ncaaf',
                                    'espnDisplayName': normalizedAwayTeam
                                });
                                scheduleSport = 'football'
                            } else if (event.sport_key === 'basketball_nba') {
                                homeTeam = await BasketballTeam.findOne({
                                    'league': 'nba',
                                    'espnDisplayName': normalizedHomeTeam
                                });
                                awayTeam = await BasketballTeam.findOne({
                                    'league': 'nba',
                                    'espnDisplayName': normalizedAwayTeam
                                });
                                scheduleSport = 'basketball'
                            } else if (event.sport_key === 'basketball_ncaab') {
                                homeTeam = await BasketballTeam.findOne({
                                    'league': 'mens-college-basketball',
                                    'espnDisplayName': normalizedHomeTeam
                                });
                                awayTeam = await BasketballTeam.findOne({
                                    'league': 'mens-college-basketball',
                                    'espnDisplayName': normalizedAwayTeam
                                });
                                scheduleSport = 'basketball'
                            } else if (event.sport_key === 'basketball_wncaab') {
                                homeTeam = await BasketballTeam.findOne({
                                    'league': 'womens-college-basketball',
                                    'espnDisplayName': normalizedHomeTeam
                                });
                                awayTeam = await BasketballTeam.findOne({
                                    'league': 'womens-college-basketball',
                                    'espnDisplayName': normalizedAwayTeam
                                });
                                scheduleSport = 'basketball'
                            } else if (event.sport_key === 'baseball_mlb') {
                                homeTeam = await BaseballTeam.findOne({ 'espnDisplayName': normalizedHomeTeam });
                                awayTeam = await BaseballTeam.findOne({ 'espnDisplayName': normalizedAwayTeam });
                                scheduleSport = 'baseball'
                            } else if (event.sport_key === 'icehockey_nhl') {
                                homeTeam = await HockeyTeam.findOne({ 'espnDisplayName': normalizedHomeTeam });
                                awayTeam = await HockeyTeam.findOne({ 'espnDisplayName': normalizedAwayTeam });
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

                                    try {

                                        await Odds.findOneAndUpdate({ id: event.id }, {
                                            homeTeamIndex: oddExist.homeTeamIndex ? oddExist.homeTeamIndex : 0,
                                            awayTeamIndex: oddExist.awayTeamIndex ? oddExist.awayTeamIndex : 0,
                                            homeTeamScaledIndex: oddExist.homeTeamScaledIndex ? oddExist.homeTeamScaledIndex : 0,
                                            awayTeamScaledIndex: oddExist.awayTeamScaledIndex ? oddExist.awayTeamScaledIndex : 0,
                                            ...event,
                                            homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                                            awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                                            homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                                            awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                                            homeTeamAbbr: homeTeam?.abbreviation,
                                            awayTeamAbbr: awayTeam?.abbreviation,
                                            homeTeamShort: homeTeam?.teamName,
                                            awayTeamShort: awayTeam?.teamName,
                                            home_team: normalizedHomeTeam,
                                            away_team: normalizedAwayTeam,
                                            bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                            sport: scheduleSport,
                                        });
                                        try {
                                            // Loop over all bookmakers
                                            await Promise.all(updatedBookmakers.map(async (bookmaker) => {
                                                // Loop over all markets for each bookmaker
                                                await Promise.all(bookmaker.markets.map(async (market) => {
                                                    // Loop over all outcomes for each market
                                                    await Promise.all(market.outcomes.map(async (outcome) => {
                                                        // Perform the update using arrayFilters to target the correct outcome
                                                        if (outcome.price < 0) {
                                                            try {
                                                                await Odds.findOneAndUpdate(
                                                                    { 'id': event.id }, // Filter by game id
                                                                    {
                                                                        $set: {
                                                                            'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': Math.abs(outcome.price) / (Math.abs(outcome.price) + 100)
                                                                        }
                                                                    },
                                                                    {
                                                                        arrayFilters: [
                                                                            { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                                                            { 'market.key': market.key }, // Match market by key
                                                                            { 'outcome.name': outcome.name } // Match outcome by its _id
                                                                        ]
                                                                    }
                                                                );
                                                            } catch (err) {
                                                                console.log(err)
                                                            }

                                                        } else {
                                                            try {
                                                                await Odds.findOneAndUpdate(
                                                                    { 'id': event.id }, // Filter by game id
                                                                    {
                                                                        $set: {
                                                                            'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': 100 / (outcome.price + 100)
                                                                        }
                                                                    },
                                                                    {
                                                                        arrayFilters: [
                                                                            { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                                                            { 'market.key': market.key }, // Match market by key
                                                                            { 'outcome.name': outcome.name } // Match outcome by its _id
                                                                        ]
                                                                    }
                                                                );
                                                            } catch (err) {
                                                                console.log(err)
                                                            }

                                                        }
                                                    }));
                                                }));
                                            }));
                                        } catch (error) {
                                            console.error('Error updating implied probability:', error);
                                        }
                                    } catch (err) {
                                        console.log(err)
                                    }
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
                                        homeTeamShort: homeTeam?.teamName,
                                        awayTeamShort: awayTeam?.teamName,
                                        bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                        sport: scheduleSport,
                                    });
                                    try {
                                        // Loop over all bookmakers
                                        await Promise.all(updatedBookmakers.map(async (bookmaker) => {
                                            // Loop over all markets for each bookmaker
                                            await Promise.all(bookmaker.markets.map(async (market) => {
                                                // Loop over all outcomes for each market
                                                await Promise.all(market.outcomes.map(async (outcome) => {
                                                    // Perform the update using arrayFilters to target the correct outcome
                                                    if (outcome.price < 0) {
                                                        try {
                                                            await Odds.findOneAndUpdate(
                                                                { 'id': event.id }, // Filter by game id
                                                                {
                                                                    $set: {
                                                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': Math.abs(outcome.price) / (Math.abs(outcome.price) + 100)
                                                                    }
                                                                },
                                                                {
                                                                    arrayFilters: [
                                                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                                                        { 'market.key': market.key }, // Match market by key
                                                                        { 'outcome.name': outcome.name } // Match outcome by its _id
                                                                    ]
                                                                }
                                                            );
                                                        } catch (err) {
                                                            console.log(err)
                                                        }

                                                    } else {
                                                        try {
                                                            await Odds.findOneAndUpdate(
                                                                { 'id': event.id }, // Filter by game id
                                                                {
                                                                    $set: {
                                                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': 100 / (outcome.price + 100)
                                                                    }
                                                                },
                                                                {
                                                                    arrayFilters: [
                                                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                                                        { 'market.key': market.key }, // Match market by key
                                                                        { 'outcome.name': outcome.name } // Match outcome by its _id
                                                                    ]
                                                                }
                                                            );
                                                        } catch (err) {
                                                            console.log(err)
                                                        }

                                                    }
                                                }));
                                            }));
                                        }));
                                    } catch (error) {
                                        console.error('Error updating implied probability:', error);
                                    }
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
    let allPastGames = await PastGameOdds.find({ predictionCorrect: { $exists: true } }).sort({ commence_time: -1 })

    for (const sport of sports) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12

        if (sport.multiYear
            && ((currentMonth >= sport.startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sport.endMonth))
            || !sport.multiYear
            && (currentMonth >= sport.startMonth && currentMonth <= sport.endMonth)) {

            // retrieve upcoming games
            const upcomingGames = await Odds.find({ sport_key: sport.name })

            const sportWeightDB = await Weights.findOne({ league: sport.name })

            let weightArray = sportWeightDB?.featureImportanceScores

            if (upcomingGames.length > 0 && weightArray !== undefined) {
                let model
                await indexAdjuster(upcomingGames, sport, allPastGames, weightArray)

                const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;

                if (fs.existsSync(modelPath)) {
                    model = await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
                    model.compile({
                        optimizer: tf.train.adam(sport.hyperParameters.learningRate),
                        loss: 'binaryCrossentropy',
                        metrics: ['accuracy']
                    });

                    await predictions(upcomingGames, [], model, sport)
                } else {
                    console.log(`No Model, skipping predictions for ${sport.name}`)
                }
            }

        }

    }
    allPastGames = null
    console.log(`ODDS FETCHED AND STORED @ ${moment().format('HH:mm:ss')}`)
}

const removeSeed = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight
    // Fetch current odds and past odds within the last week
    let currentOdds = await Odds.find();
    await removePastGames(currentOdds);
    currentOdds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 });
    let pastOdds = await PastGameOdds.find({
        commence_time: { $gte: today }
    }).sort({ commence_time: -1, winPercent: 1 });
    await emitToClients('gameUpdate', currentOdds);
    await emitToClients('pastGameUpdate', pastOdds);
    currentOdds = null
    pastOdds = null
    if (global.gc) global.gc();
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

//TAKES ABOUT 1 HOUR
const paramAndValueSeed = async () => {
    const sports = await Sport.find({}).sort({name: 1}).lean()
    // await valueBetGridSearch(sports)
    // if (global.gc) global.gc();
    await hyperparameterRandSearch(sports)
    if (global.gc) global.gc();
}

// paramAndValueSeed()
// mlModelTrainSeed()
//TODO: ANALYZE ML MODEL TRAIN SEED AND ADDRESS RAM ISSUES ON EC2 INSTANCE

module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed, mlModelTrainSeed, paramAndValueSeed }