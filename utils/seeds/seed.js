require('dotenv').config()
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../models');
const db = require('../../models_sql');
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
const { normalizeTeamName, normalizeOutcomes, cleanStats, getCommonStats } = require('../helperFunctions/dataHelpers/dataSanitizers')
const { transporter, getImpliedProbability } = require('../constants')
const { statMinMax } = require('../helperFunctions/dataHelpers/pastGamesHelper');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { gameDBSaver } = require('../helperFunctions/dataHelpers/databaseSavers')

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
    let yesterdayGames = await PastGameOdds.find({ commence_time: { $gte: yesterday } }).select('-homeTeamStats -awayTeamStats')
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight
    let currentOdds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 });
    let pastOdds = await PastGameOdds.find({
        commence_time: { $gte: today }
    }).sort({ commence_time: -1, winPercent: 1 });
    await emitToClients('gameUpdate', currentOdds);
    await emitToClients('pastGameUpdate', pastOdds);
    currentOdds = null
    pastOdds = null
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
        const sqlSports = await db.Sports.findAll({ raw: true })
        console.log(sqlSports)
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
                                // let dbSport = sqlSports.filter((sport) => sport.name === event.sport_key)
                                // console.log(dbSport)
                                // await gameDBSaver(event, dbSport[0])
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
    sportWeightDB = null
    upcomingGames = null
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
    const sports = await Sport.find({}).sort({ name: 1 }).lean()
    await valueBetGridSearch(sports)
    // if (global.gc) global.gc();
    // await hyperparameterRandSearch(sports)
    if (global.gc) global.gc();
}

const dbSwitcher = async () => {
    try {
        await db.sequelize.sync({ force: true }).then(() => {
            console.log(`Connected to the SQL database`);
        })
    } catch (e) {
        console.error('Error connecting to the database:', e);
    }
    let sports = await Sport.find({}).sort({ name: 1 }).lean()

    for (let sport of sports) {
        let weights = await Weights.findOne({ league: sport.name }).sort({ league: 1 }).lean()
        const [SQLsport, created] = await db.Sports.upsert({
            name: sport.name,
            espnSport: sport.espnSport,
            league: sport.league,
            startMonth: sport.startMonth,
            endMonth: sport.endMonth,
            multiYear: sport.multiYear,
            statYear: sport.statYear,
            prevStatYear: sport.prevStatYear,
            sigmoidIQRSharpness: sport.sigmoidIQRSharpness,
            averageIndex: sport.averageIndex,
        }, {
            where: { name: sport.name }
        })
        const [hyperParams, createdHP] = await db.HyperParams.upsert({
            bestAccuracy: sport.hyperParameters.bestAccuracy,
            epochs: sport.hyperParameters.epochs,
            batchSize: sport.hyperParameters.batchSize,
            kFolds: sport.hyperParameters.kFolds,
            hiddenLayers: sport.hyperParameters.hiddenLayers,
            learningRate: sport.hyperParameters.learningRate,
            l2Reg: sport.hyperParameters.l2Reg,
            dropoutReg: sport.hyperParameters.dropoutReg,
            kernalInitializer: sport.hyperParameters.kernalInitializer,
            layerNeurons: sport.hyperParameters.layerNeurons,
            decayFactor: sport.hyperParameters.decayFactor,
            gameDecayThreshold: sport.hyperParameters.gameDecayThreshold,
            sport: SQLsport.id
        }, {
            where: { sport: SQLsport.id }
        })
        const [weightsSQL, createdWeights] = await db.MlModelWeights.upsert({
            sport: SQLsport.id,
            featureImportanceScores: weights?.featureImportanceScores,
            hiddenToOutputWeights: weights?.hiddenToOutputWeights,
            inputToHiddenWeights: weights?.inputToHiddenWeights,
        }, {
            where: { sport: SQLsport.id }
        })
        for (let valueBetSettings of sport.valueBetSettings) {
            const [valueBetSQL, createdValueBet] = await db.ValueBetSettings.upsert({
                sport: SQLsport.id,
                bookmaker: valueBetSettings.bookmaker,
                indexDiffSmall: valueBetSettings.settings.indexDiffSmallNum,
                indexDiffRange: valueBetSettings.settings.indexDiffRangeNum,
                confidenceSmall: valueBetSettings.settings.confidenceSmallNum,
                confidenceRange: valueBetSettings.settings.confidenceRangeNum,
                bestWinrate: valueBetSettings.settings.bestWinrate,
                bestTotalGames: valueBetSettings.settings.bestTotalGames,
                bestConfidenceInterval: valueBetSettings.settings.bestConfidenceInterval,
            }, {
                where: { sport: SQLsport.id, bookmaker: valueBetSettings.bookmaker }
            })
        }
        let TeamModel
        let statModel
        let statAlias
        switch (sport.league) {
            case 'college-football':
                TeamModel = UsaFootballTeam;
                statModel = db.UsaFootballStats
                statAlias = 'UsaFootballStatsDetails'
                break;
            case 'nfl':
                TeamModel = UsaFootballTeam;
                statModel = db.UsaFootballStats
                statAlias = 'UsaFootballStatsDetails'
                break;
            case 'nba':
                TeamModel = BasketballTeam;
                statModel = db.BasketballStats
                statAlias = 'BasketballStatsDetails'
                break;
            case 'mens-college-basketball':
                TeamModel = BasketballTeam;
                statModel = db.BasketballStats
                statAlias = 'BasketballStatsDetails'
                break;
            case 'womens-college-basketball':
                TeamModel = BasketballTeam;
                statModel = db.BasketballStats
                statAlias = 'BasketballStatsDetails'
                break;
            case 'nhl':
                TeamModel = HockeyTeam;
                statModel = db.HockeyStats
                statAlias = 'HockeyStatsDetails'
                break;
            case 'mlb':
                TeamModel = BaseballTeam;
                statModel = db.BaseballStats
                statAlias = 'BaseballStatsDetails'
                break;
            default:
                console.error("Unsupported sport:", sport.league);
                continue; // Skip unsupported sports
        }
        let allTeams = await TeamModel.find({ league: sport.league }).lean()

        for (let team of allTeams) {
            const [createdTeamSQL, createdTeam] = await db.Teams.upsert({
                teamName: normalizeTeamName(team.teamName, sport.name),
                logo: team.logo,
                school: team.school ? team.school : ' ', // Default to empty string if school is not set
                league: sport.name,
                espnID: team.espnID, // Ensure this is the correct field for ESPN ID
                abbreviation: team.abbreviation,
                espnDisplayName: team.espnDisplayName,
                mainColor: team.mainColor ? team.mainColor : ' ', // Default to black if mainColor is not set
                secondaryColor: team.secondaryColor ? team.secondaryColor : ' ', // Default to black if secondaryColor is not set
                currentStats: cleanStats(getCommonStats(team))
            }, { where: { espnID: team.espnID, league: sport.name } })
        }

        let allOdds = await Odds.find({ sport_key: sport.name }).sort({ commence_time: 1 }).lean()
        let allPastGames = await PastGameOdds.find({ sport_key: sport.name }).sort({ commence_time: 1 }).lean()

        for (let game of allOdds) {
            let gameSQL = await gameDBSaver(game, SQLsport)
            let homeTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.home_team, game.sport_key), league: sport.name }, raw: true })
            let awayTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.away_team, game.sport_key), league: sport.name }, raw: true })
            // console.log(gameSQL)
            if (homeTeam && awayTeam) {
                await db.Stats.upsert({
                    gameId: gameSQL.id, // Use the SQL game ID
                    teamId: homeTeam.id, // Use the SQL team ID for home team
                    sport: SQLsport.id, // Use the SQL sport ID
                    data: {
                        ...game.homeTeamStats, // Spread the home team stats
                    }
                }, {
                    where: { gameId: gameSQL.id, teamId: homeTeam.id }
                })

                await db.Stats.upsert({
                    gameId: gameSQL.id, // Use the SQL game ID
                    teamId: awayTeam.id, // Use the SQL team ID for home team
                    sport: SQLsport.id, // Use the SQL sport ID
                    data: {
                        ...game.awayTeamStats, // Spread the home team stats
                    }
                }, {
                    where: { gameId: gameSQL.id, teamId: awayTeam.id }
                })
            }

        }

        for (let game of allPastGames) {
            let gameSQL = await gameDBSaver(game, SQLsport, true)
            let homeTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.home_team, game.sport_key), league: sport.name }, raw: true })
            let awayTeam = await db.Teams.findOne({ where: { espnDisplayName: normalizeTeamName(game.away_team, game.sport_key), league: sport.name }, raw: true })
            // console.log(gameSQL)
            if (homeTeam && awayTeam) {
                await db.Stats.upsert({
                    gameId: gameSQL.id, // Use the SQL game ID
                    teamId: homeTeam.id, // Use the SQL team ID for home team
                    sport: SQLsport.id, // Use the SQL sport ID
                    data: {
                        ...game.homeTeamStats, // Spread the home team stats
                    }
                }, {
                    where: { gameId: gameSQL.id, teamId: homeTeam.id }
                })

                await db.Stats.upsert({
                    gameId: gameSQL.id, // Use the SQL game ID
                    teamId: awayTeam.id, // Use the SQL team ID for home team
                    sport: SQLsport.id, // Use the SQL sport ID
                    data: {
                        ...game.awayTeamStats, // Spread the home team stats
                    }
                }, {
                    where: { gameId: gameSQL.id, teamId: awayTeam.id }
                })
            }

        }





    }
    // const games = await db.Games.findAll({
    //     include: [
    //         {
    //             model: db.Teams,
    //             as: 'homeTeamDetails', // alias for HomeTeam join
    //             // No where clause needed here
    //         },
    //         {
    //             model: db.Teams,
    //             as: 'awayTeamDetails', // alias for AwayTeam join
    //         },
    //         {
    //             model: db.Bookmakers,
    //             as: 'bookmakers',
    //             where: {
    //                 gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
    //             },
    //             include: [
    //                 {
    //                     model: db.Markets,
    //                     as: 'markets',
    //                     where: {
    //                         bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
    //                     },
    //                     include: [
    //                         {
    //                             model: db.Outcomes,
    //                             as: 'outcomes',
    //                             where: {
    //                                 marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
    //                             }
    //                         }
    //                     ]
    //                 }
    //             ]
    //         },
    //         {
    //             model: db.Stats,
    //             as: `homeStats`,
    //             required: true,
    //             where: {
    //                 [Op.and]: [
    //                     { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
    //                     { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
    //                 ]
    //             }
    //         },
    //         {
    //             model: db.Stats,
    //             as: `awayStats`,
    //             required: true,
    //             where: {
    //                 [Op.and]: [
    //                     { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
    //                     { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
    //                 ]
    //             }
    //         }
    //     ]
    // });
    // let plainGames = games.map((game) => game.get({ plain: true }))
    // console.log('plainGames', plainGames)
    // if (plainGames.length > 0) {
    //     console.log('bookmakers', plainGames[0].bookmakers)
    //     console.log('homeStats', plainGames[0].homeStats)
    //     console.log('awayStats', plainGames[0].awayStats)
    //     if (plainGames[0].bookmakers) {
    //         console.log('markets', plainGames[0].bookmakers[0].markets)

    //         if (plainGames[0].bookmakers[0].markets) {
    //             console.log('outcomes', plainGames[0].bookmakers[0].markets[0].outcomes)
    //         }
    //     }
    // }
    console.log(`SQL DB SWITCH COMPLETE @ ${moment().format('HH:mm:ss')}`)
}

const ramUsageTester = async () => {
    await dataSeed()
    if (global.gc) global.gc();
    console.log('------------------------------ODDS SEED -------------------------')
    await oddsSeed()
    if (global.gc) global.gc();
    console.log('------------------------------REMOVE SEED -------------------------')
    await removeSeed()
    if (global.gc) global.gc();
    console.log('------------------------------MODEL TRAIN SEED -------------------------')
    await mlModelTrainSeed()
}


// dbSwitcher() //THIS FUNCTION WORKS TO TAKE THE CURRENT STATE OF THE DB INTO SQL. THE NEXT MOVE TO MAKE IS TO CHANGE ALL SEED FUNCTIONS TO WRITE TO THE SQL DB, MAKE THE TWO DBS WORK IN TANDEM FIRST, THEN TURN OFF NOSQL LATER
//TODO: FINISH RUNNING DBSWITCHER, CONFIRM ALL DATA IS IN SQL, PERHAPS BY TYING THE CONTROLLER TO THE FRONT END AND SEEING IF EVERYTHING DISPLAYS CORRECTLY
//TODO: AFTER ABOVE STEP IS DONE AND CONFIRMED, WORK ON CONVERTING THE SEED FUNCTIONS TO SQL QUERIES
//TODO: GO TO DATABASESAVERS.JS AND CONTINUE WORKING ON ODDSSEED FUNCTIONALITY WITH SQL
// oddsSeed()
mlModelTrainSeed()
// paramAndValueSeed()
//TODO: ANALYZE ML MODEL TRAIN SEED AND ADDRESS RAM ISSUES ON EC2 INSTANCE

module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed, mlModelTrainSeed, paramAndValueSeed }