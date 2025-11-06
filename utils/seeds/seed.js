// seed.js
// Utility functions for seeding, updating, and maintaining sports data and ML models.
// Handles odds fetching, team/stat updates, ML training, and reporting.

require('dotenv').config();
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../models');
const db = require('../../models_sql');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const { emitToClients } = require('../../socketManager');
const { retrieveTeamsandStats } = require('../helperFunctions/dataHelpers/retrieveTeamsandStats');
const { removePastGames } = require('../helperFunctions/dataHelpers/removeHelper');
const { indexAdjuster, pastGamesReIndex } = require('../helperFunctions/mlModelFuncs/indexHelpers');
const { predictions, trainSportModelKFold, isValidStatBlock } = require('../helperFunctions/mlModelFuncs/trainingHelpers');
const { valueBetGridSearch, hyperparameterRandSearch } = require('../helperFunctions/mlModelFuncs/searchHelpers');
const { normalizeTeamName, modelConfAnalyzer } = require('../helperFunctions/dataHelpers/dataSanitizers');
const { transporter } = require('../constants');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { gameDBSaver, statDBSaver } = require('../helperFunctions/dataHelpers/databaseSavers');
const { isSportInSeason } = require('../helperFunctions/mlModelFuncs/sportHelpers');
const cliProgress = require('cli-progress');
const os = require('os');

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3';

// 1. Update teams with latest stats
const dataSeed = async () => {
    console.log("DB CONNECTED ------------------------------------------------- STARTING DATA SEED");
    let sports = await db.Sports.findAll({});
    await retrieveTeamsandStats(sports);
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
    sports = null;
    if (global.gc) global.gc();
};

// 2. Train ML models for each sport and send daily report
const mlModelTrainSeed = async () => {
    let fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    console.log("DB CONNECTED ------------------------------------------------- STARTING ML SEED");
    let sports = await db.Sports.findAll({
        include: [
            { model: db.MlModelWeights, as: 'MlModelWeights' },
            { model: db.HyperParams, as: 'hyperParams' }
        ],
        raw: true,
        order: [['name', 'ASC']]
    });

    // Fetch all incomplete games with stats and team details
    let odds = await db.Games.findAll({
        where: { complete: false },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            { model: db.Sports, as: 'sportDetails' },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ],
        order: [['commence_time', 'ASC']],
        raw: true
    });

    // Train and predict for each sport in season
    for (let sport of sports) {
        let inSeason = isSportInSeason(sport);
        if (inSeason) {
            let upcomingGames = odds.filter((game) => game.sport_key === sport.name);
            let pastGames = await db.Games.findAll({
                where: { complete: true, sport_key: sport.name },
                include: [
                    { model: db.Teams, as: 'homeTeamDetails' },
                    { model: db.Teams, as: 'awayTeamDetails' },
                    { model: db.Sports, as: 'sportDetails' },
                    {
                        model: db.Stats, as: 'homeStats', required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    },
                    {
                        model: db.Stats, as: 'awayStats', required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    }
                ],
                order: [['commence_time', 'ASC']],
                raw: true
            });

            if (pastGames.length > 10) {
                console.log(`${sport.name} ML STARTING @ ${moment().format('HH:mm:ss')}`);
                let model = await trainSportModelKFold(sport, pastGames, false);
                const historyLength = sport['hyperParams.historyLength'];
                let teamStatsHistory = {};

                // Build team stats history for rolling window
                for (const game of pastGames.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))) {
                    const homeTeamId = game.homeTeam;
                    const awayTeamId = game.awayTeam;
                    if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
                    if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];
                    if (isValidStatBlock(game['homeStats.data'], sport)) {
                        teamStatsHistory[homeTeamId].push(game['homeStats.data']);
                        if (teamStatsHistory[homeTeamId].length > historyLength) teamStatsHistory[homeTeamId].shift();
                    }
                    if (isValidStatBlock(game['awayStats.data'], sport)) {
                        teamStatsHistory[awayTeamId].push(game['awayStats.data']);
                        if (teamStatsHistory[awayTeamId].length > historyLength) teamStatsHistory[awayTeamId].shift();
                    }
                }

                // Predict on upcoming games
                await predictions(upcomingGames, [], model, sport, false, false, teamStatsHistory, pastGames);

                // Clean up
                teamStatsHistory = null;
                model = null;
                if (global.gc) global.gc();
            } else {
                console.log(`NOT ENOUGH ${sport.name} DATA`);
            }
            console.log(`${sport.name} ML DONE @ ${moment().format('HH:mm:ss')}`);
            tf.disposeVariables();
            tf.engine().reset();
            if (global.gc) global.gc();
        } else {
            console.log(`${sport.name} NOT IN SEASON`);
        }
    }

    // Emit current and past odds to clients
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentOdds = await db.Games.findAll({
        where: { complete: false },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: { gameId: { [Op.eq]: Sequelize.col('Games.id') } },
                include: [{
                    model: db.Markets,
                    as: 'markets',
                    where: { bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } },
                    include: [{
                        model: db.Outcomes,
                        as: 'outcomes',
                        where: { marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } }
                    }]
                }]
            },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ]
    });
    const pastOdds = await db.Games.findAll({
        where: { complete: true, commence_time: { [Op.gte]: today } },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: { gameId: { [Op.eq]: Sequelize.col('Games.id') } },
                include: [{
                    model: db.Markets,
                    as: 'markets',
                    where: { bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } },
                    include: [{
                        model: db.Outcomes,
                        as: 'outcomes',
                        where: { marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } }
                    }]
                }]
            },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ]
    });
    await emitToClients('gameUpdate', currentOdds);
    await emitToClients('pastGameUpdate', pastOdds);

    if (global.gc) global.gc();
    await modelConfAnalyzer();
    if (global.gc) global.gc();

    // Send daily prediction report via email
    const currentDate = new Date();
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    let yesterdayGames = await db.Games.findAll({
        where: { commence_time: { [Op.gte]: yesterday }, complete: true, predictedWinner: { [Op.in]: ['home', 'away'] } }
    });
    console.log(`Generating report for ${yesterdayGames.length} games from ${yesterday.toDateString()}`);
    const stats = {
        date: new Date().toLocaleDateString(),
        totalPredictions: yesterdayGames.length,
        wins: yesterdayGames.filter((game) => game.predictionCorrect === true).length,
        losses: yesterdayGames.filter((game) => game.predictionCorrect === false).length
    };
    // Per-sport breakdown
    const sportStatsMap = {};
    for (const game of yesterdayGames) {
        const sport = game.sport_key || 'Unknown';
        if (!sportStatsMap[sport]) {
            sportStatsMap[sport] = {
                total: 0,
                wins: 0,
                losses: 0,
                profit: 0
            };
        }
        sportStatsMap[sport].total += 1;
        if (game.predictionCorrect === true) {
            sportStatsMap[sport].wins += 1;
        } else if (game.predictionCorrect === false) {
            sportStatsMap[sport].losses += 1;
        }
        // Calculate profit: assume $100 bet per game, American odds
        if (typeof game.predictedWinnerOdds === 'number') {
            const odds = game.predictedWinnerOdds;
            if (game.predictionCorrect === true) {
                sportStatsMap[sport].profit += odds > 0 ? 100 * (odds / 100) : 100 / (Math.abs(odds) / 100);
            } else if (game.predictionCorrect === false) {
                sportStatsMap[sport].profit -= 100;
            }
        }
    }

    // Calculate overall profit and ROI
    let totalProfit = 0;
    let totalBets = 0;
    for (const sport in sportStatsMap) {
        totalProfit += sportStatsMap[sport].profit;
        totalBets += sportStatsMap[sport].total;
    }
    const roi = totalBets > 0 ? ((totalProfit / (totalBets * 100)) * 100).toFixed(2) : '0.00';

    // Build per-sport HTML
    let perSportHtml = '';
    for (const sport in sportStatsMap) {
        const s = sportStatsMap[sport];
        const winRate = s.total > 0 ? ((s.wins / s.total) * 100).toFixed(1) : '0.0';
        const roiSport = s.total > 0 ? ((s.profit / (s.total * 100)) * 100).toFixed(2) : '0.00';
        perSportHtml += `
            <tr>
                <td>${sport}</td>
                <td>${s.total}</td>
                <td style="color:green">${s.wins}</td>
                <td style="color:red">${s.losses}</td>
                <td>${winRate}%</td>
                <td>${s.profit.toFixed(2)}</td>
                <td>${roiSport}%</td>
            </tr>
        `;
    }

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
          <li>Profit: <strong style="color:blue">$${totalProfit.toFixed(2)}</strong></li>
          <li>ROI: <strong style="color:purple">${roi}%</strong></li>
        </ul>
        <hr />
        <h3>📋 Per-Sport Breakdown</h3>
        <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Sport</th>
                    <th>Total</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Win Rate</th>
                    <th>Profit ($)</th>
                    <th>ROI (%)</th>
                </tr>
            </thead>
            <tbody>
                ${perSportHtml}
            </tbody>
        </table>
        <hr />
        <p style="color:gray;font-size:0.9em;">App check-in via PM2 successful — ${new Date().toLocaleTimeString()}</p>
      `;
    const mailOptions = {
        from: '"BetterBetsAPI" betterbetsApp@gmail.com',
        to: process.env.NODEMAILER_RECIPIENT,
        subject: `Daily Sports Report - ${stats.date}`,
        html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent:", info.messageId);

    if (global.gc) global.gc();
    sports = null;
    odds = null;
};

// 3. Fetch and store odds from API, update DB, and run predictions
const oddsSeed = async () => {
    let sports = await db.Sports.findAll({
        include: [
            { model: db.MlModelWeights, as: 'MlModelWeights' },
            { model: db.HyperParams, as: 'hyperParams' }
        ],
        raw: true,
        order: [['name', 'ASC']]
    });

    // Helper: Axios with exponential backoff
    const axiosWithBackoff = async (url, retries = 5, delayMs = 1000) => {
        try {
            return await axios.get(url);
        } catch (error) {
            if (retries === 0) throw error;
            console.log(`Retrying request... (${retries} attempts left)`);
            return axiosWithBackoff(url, retries - 1, delayMs * 2);
        }
    };

    // Helper: Fetch odds for all sports with backoff and save to DB
    const fetchDataWithBackoff = async (sports) => {
        let requests;
        const currentHour = new Date().getHours();
        // Use different API keys based on hour to avoid rate limits
        if (currentHour >= 0 && currentHour < 5) {
            requests = sports.map(sport =>
                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
            );
        } else if (currentHour >= 5 && currentHour < 11) {
            requests = sports.map(sport =>
                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TRAVM}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
            );
        } else if (currentHour >= 11 && currentHour < 17) {
            requests = sports.map(sport =>
                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_SMOKEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
            );
        } else if (currentHour >= 17 && currentHour < 24) {
            requests = sports.map(sport =>
                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_LOWRES}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)
            );
        }
        const data = await Promise.all(requests);
        console.log(`Odds fetched @ ${moment().format('HH:mm:ss')}, beginning DB save...`);
        try {
            for (const item of data) {
                for (const event of item.data) {
                    if (moment().isBefore(moment(event.commence_time))) {
                        if (!event.sport_key) {
                            console.error(`sportType is undefined for event: ${event.id}`);
                        } else {
                            const dbSport = sports.find(s => s.name === event.sport_key);
                            const savedGame = await gameDBSaver(event, dbSport);
                            if (savedGame) {
                                const plainGame = savedGame.get({ plain: true });
                                const homeTeamSQL = await db.Teams.findOne({
                                    where: {
                                        espnDisplayName: normalizeTeamName(event.home_team, event.sport_key),
                                        league: dbSport.name
                                    },
                                    raw: true
                                });
                                const awayTeamSQL = await db.Teams.findOne({
                                    where: {
                                        espnDisplayName: normalizeTeamName(event.away_team, event.sport_key),
                                        league: dbSport.name
                                    },
                                    raw: true
                                });
                                await statDBSaver(event, homeTeamSQL, dbSport, plainGame, 'home');
                                await statDBSaver(event, awayTeamSQL, dbSport, plainGame, 'away');
                            }
                        }
                    }
                }
            }
            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) console.log(err);
        }
    };

    // Fetch odds for all sports in season
    await fetchDataWithBackoff(sports.filter(sport => isSportInSeason(sport)));

    // For each sport, run predictions if model exists
    let allPastGamesSQL = await db.Games.findAll({
        where: {
            complete: true,
            predictedWinner: { [Op.in]: ['home', 'away'] },
            predictionCorrect: { [Op.not]: null }
        },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ],
        order: [['commence_time', 'DESC']],
        raw: true
    });

    for (const sport of sports) {
        let sportGamesSQL = await db.Games.findAll({
            where: { complete: false, sport_key: sport.name },
            include: [
                { model: db.Teams, as: 'homeTeamDetails' },
                { model: db.Teams, as: 'awayTeamDetails' },
                {
                    model: db.Stats, as: 'homeStats', required: true,
                    where: {
                        [Op.and]: [
                            { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                            { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                        ]
                    }
                },
                {
                    model: db.Stats, as: 'awayStats', required: true,
                    where: {
                        [Op.and]: [
                            { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                            { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                        ]
                    }
                }
            ],
            order: [['commence_time', 'DESC']],
            raw: true
        });

        if (isSportInSeason(sport)) {
            const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
            if (fs.existsSync(modelPath)) {
                let model = await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
                model.compile({
                    optimizer: tf.train.adam(sport['hyperParams.learningRate']),
                    loss: { scoreOutput: 'meanSquaredError' },
                    lossWeights: { scoreOutput: sport['hyperParams.scoreLoss'] },
                    metrics: { scoreOutput: ['mae'] }
                });
                const historyLength = sport['hyperParams.historyLength'];
                let teamStatsHistory = {};
                for (const game of allPastGamesSQL.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))) {
                    const homeTeamId = game.homeTeam;
                    const awayTeamId = game.awayTeam;
                    if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
                    if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];
                    if (isValidStatBlock(game['homeStats.data'], sport)) {
                        teamStatsHistory[homeTeamId].push(game['homeStats.data']);
                        if (teamStatsHistory[homeTeamId].length > historyLength) teamStatsHistory[homeTeamId].shift();
                    }
                    if (isValidStatBlock(game['awayStats.data'], sport)) {
                        teamStatsHistory[awayTeamId].push(game['awayStats.data']);
                        if (teamStatsHistory[awayTeamId].length > historyLength) teamStatsHistory[awayTeamId].shift();
                    }
                }
                await predictions(sportGamesSQL, [], model, sport, false, false, teamStatsHistory, allPastGamesSQL.filter((game) => game.sport_key === sport.name));
                tf.disposeVariables();
                model = null;
                tf.engine().reset();
                if (global.gc) global.gc();
                teamStatsHistory = null;
            } else {
                console.log(`Model not found for ${sport.name}. Skipping predictions.`);
            }
            await indexAdjuster(sportGamesSQL, sport, allPastGamesSQL, sport['MlModelWeights.featureImportanceScores']);
        }
        sportGamesSQL = null;

        // Dynamically update stat year if needed (commented out)
        let inSeason = isSportInSeason(sport);
        if (inSeason) {
            console.log(`${sport.name} IS IN SEASON SO STAT YEAR WILL REMAIN ${sport.statYear}`);
        } else {
            let newStatYear;
            const { startMonth, endMonth, multiYear } = sport;
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            if (!multiYear) {
                newStatYear = currentMonth < startMonth ? currentYear : currentYear + 1;
            } else {
                if (currentMonth > endMonth && currentMonth < startMonth) {
                    newStatYear = (sport.name === 'americanfootball_nfl' || sport.name === 'americanfootball_ncaaf') ? currentYear : currentYear + 1;
                } else {
                    newStatYear = currentYear;
                }
            }
            console.log(`TEST WOULD HAVE UPDATED ${sport.name} WITH THE STAT YEAR OF ${newStatYear}`);
        }
    }
    allPastGamesSQL = null;
    sports = null;
    if (global.gc) global.gc();
    console.log(`ODDS FETCHED AND STORED @ ${moment().format('HH:mm:ss')}`);
};

// 4. Remove past games and update odds for clients
const removeSeed = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentOddsSQL = await db.Games.findAll({
        where: { complete: false },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            { model: db.Sports, as: 'sportDetails' }
        ],
        raw: true,
        order: [['commence_time', 'ASC']]
    });
    await removePastGames(currentOddsSQL);

    // Fetch updated odds and emit to clients
    let currentOdds = await db.Games.findAll({
        where: { complete: false },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: { gameId: { [Op.eq]: Sequelize.col('Games.id') } },
                include: [{
                    model: db.Markets,
                    as: 'markets',
                    where: { bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } },
                    include: [{
                        model: db.Outcomes,
                        as: 'outcomes',
                        where: { marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } }
                    }]
                }]
            },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ]
    });
    let pastOdds = await db.Games.findAll({
        where: { complete: true, commence_time: { [Op.gte]: today } },
        include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: { gameId: { [Op.eq]: Sequelize.col('Games.id') } },
                include: [{
                    model: db.Markets,
                    as: 'markets',
                    where: { bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } },
                    include: [{
                        model: db.Outcomes,
                        as: 'outcomes',
                        where: { marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } }
                    }]
                }]
            },
            {
                model: db.Stats, as: 'homeStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: 'awayStats', required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ]
    });
    await emitToClients('gameUpdate', currentOdds);
    await emitToClients('pastGameUpdate', pastOdds);
    currentOdds = null;
    pastOdds = null;
    currentOddsSQL = null;
    if (global.gc) global.gc();
};

// 5. (Unused) ESPN team data seeding (for reference)
const espnSeed = async () => {
    // Not used in main workflow; left for reference.
};

// 6. Value bet grid search for all sports
const valueBetSearch = async () => {
    const sports = await db.Sports.findAll({
        include: [
            { model: db.MlModelWeights, as: 'MlModelWeights' },
            { model: db.HyperParams, as: 'hyperParams' }
        ],
        raw: true,
        order: [['name', 'ASC']]
    });

    hyperparameterRandSearch(sports);
    // for (const sport of sports) {
    //     await valueBetGridSearch(sport);
    // }
};

// 7. Reset models (retrain)
const modelReset = async () => {
    await mlModelTrainSeed();
    // Optionally: await dataSeed(); await oddsSeed();
};

// 8. (Unused) Past baseball pitcher stats update (for reference)
const pastBaseballPitcherStats = async () => {
    // Not used in main workflow; left for reference.
};


// Export main seed functions
module.exports = {
    dataSeed,
    oddsSeed,
    removeSeed,
    mlModelTrainSeed,
    valueBetSearch
};
