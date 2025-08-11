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
const { predictions, trainSportModelKFold, isValidStatBlock } = require('../helperFunctions/mlModelFuncs/trainingHelpers')
const { valueBetGridSearch, hyperparameterRandSearch } = require('../helperFunctions/mlModelFuncs/searchHelpers');
const { normalizeTeamName, modelConfAnalyzer, } = require('../helperFunctions/dataHelpers/dataSanitizers')
const { transporter } = require('../constants')
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { gameDBSaver, statDBSaver } = require('../helperFunctions/dataHelpers/databaseSavers');
const { isSportInSeason } = require('../helperFunctions/mlModelFuncs/sportHelpers')

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs

const dataSeed = async () => {
    console.log("DB CONNECTED ------------------------------------------------- STARTING DATA SEED")
    // UPDATE TEAMS WITH MOST RECENT STATS // WORKING AS LONG AS DYNAMIC STAT YEAR CAN WORK CORRECTLY
    let sports = await db.Sports.findAll({})
    await retrieveTeamsandStats(sports)
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
    if (global.gc) global.gc();
} //UPDATED FOR SQL

const mlModelTrainSeed = async () => {
    let fourYearsAgo = new Date()
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4)

    console.log("DB CONNECTED ------------------------------------------------- STARTING ML SEED")
    const sports = await db.Sports.findAll({ include: [{ model: db.MlModelWeights, as: 'MlModelWeights' }, { model: db.HyperParams, as: 'hyperParams' }], raw: true, order: [['name', 'ASC']] });
    const odds = await db.Games.findAll({
        where: { complete: false }, include: [
            { model: db.Teams, as: 'homeTeamDetails' },
            { model: db.Teams, as: 'awayTeamDetails' },
            { model: db.Sports, as: 'sportDetails' },
            {
                model: db.Stats, as: `homeStats`, required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats, as: `awayStats`, required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }], order: [['commence_time', 'ASC']], raw: true
    });
    for (let sport of sports) {
        let inSeason = isSportInSeason(sport)
        // Multi-year sports (e.g., NFL, NBA, NHL, etc.)
        if (inSeason) {
            let upcomingGames = odds.filter((game) => game.sport_key === sport.name)
            let pastGames = await db.Games.findAll({
                where: { complete: true, sport_key: sport.name },
                include: [
                    { model: db.Teams, as: 'homeTeamDetails' },
                    { model: db.Teams, as: 'awayTeamDetails' },
                    { model: db.Sports, as: 'sportDetails' },
                    {
                        model: db.Stats, as: `homeStats`, required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    },
                    {
                        model: db.Stats, as: `awayStats`, required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    }], order: [['commence_time', 'ASC']], raw: true
            });
            if (pastGames.length > 10) {
                console.log(`${sport.name} ML STARTING @ ${moment().format('HH:mm:ss')}`)
                let model = await trainSportModelKFold(sport, pastGames, false)
                const historyLength = sport['hyperParams.historyLength'];
                const teamStatsHistory = {};

                for (const game of pastGames.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))) {
                    const homeTeamId = game.homeTeamId;
                    const awayTeamId = game.awayTeamId;

                    if (!teamStatsHistory[homeTeamId]) teamStatsHistory[homeTeamId] = [];
                    if (!teamStatsHistory[awayTeamId]) teamStatsHistory[awayTeamId] = [];

                    if (isValidStatBlock(game['homeStats.data'])) {
                        teamStatsHistory[homeTeamId].push(game['homeStats.data']);
                        if (teamStatsHistory[homeTeamId].length > historyLength) {
                            teamStatsHistory[homeTeamId].shift();
                        }
                    }

                    if (isValidStatBlock(game['awayStats.data'])) {
                        teamStatsHistory[awayTeamId].push(game['awayStats.data']);
                        if (teamStatsHistory[awayTeamId].length > historyLength) {
                            teamStatsHistory[awayTeamId].shift();
                        }
                    }
                }

                await predictions(upcomingGames, [], model, sport, false, false, teamStatsHistory)
                let newSport = await db.Sports.findOne({
                    where: { name: sport.name },
                    include: [{ model: db.MlModelWeights, as: 'MlModelWeights' }, { model: db.HyperParams, as: 'hyperParams' }],
                    raw: true
                });
                if (global.gc) global.gc();
                await pastGamesReIndex(upcomingGames, newSport)
                if (global.gc) global.gc();
            } else {
                console.log(`NOT ENOUGH ${sport.name} DATA`)
            }
            console.log(`${sport.name} ML DONE @ ${moment().format('HH:mm:ss')}`)
            if (global.gc) global.gc();
            pastGames = null
        } else {
            console.log(`${sport.name} NOT IN SEASON`)
        }


    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight
    const currentOdds = await db.Games.findAll({
        where: {
            complete: false
        },
        include: [
            {
                model: db.Teams,
                as: 'homeTeamDetails', // alias for HomeTeam join
                // No where clause needed here
            },
            {
                model: db.Teams,
                as: 'awayTeamDetails', // alias for AwayTeam join
            },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: {
                    gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
                },
                include: [
                    {
                        model: db.Markets,
                        as: 'markets',
                        where: {
                            bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
                        },
                        include: [
                            {
                                model: db.Outcomes,
                                as: 'outcomes',
                                where: {
                                    marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
                                }
                            }
                        ]
                    }
                ]
            },
            {
                model: db.Stats,
                as: `homeStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats,
                as: `awayStats`,
                required: true,
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
        where: {
            complete: true,
            commence_time: { [Op.gte]: today } // Ensure the commence_time is greater than or equal to today
        },
        include: [
            {
                model: db.Teams,
                as: 'homeTeamDetails', // alias for HomeTeam join
                // No where clause needed here
            },
            {
                model: db.Teams,
                as: 'awayTeamDetails', // alias for AwayTeam join
            },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: {
                    gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
                },
                include: [
                    {
                        model: db.Markets,
                        as: 'markets',
                        where: {
                            bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
                        },
                        include: [
                            {
                                model: db.Outcomes,
                                as: 'outcomes',
                                where: {
                                    marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
                                }
                            }
                        ]
                    }
                ]
            },
            {
                model: db.Stats,
                as: `homeStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats,
                as: `awayStats`,
                required: true,
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


    const currentDate = new Date();
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    let yesterdayGames = await db.Games.findAll({
        where: { commence_time: { [Op.gte]: yesterday }, complete: true, predictedWinner: { [Op.in]: ['home', 'away'] } },
    })
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
    // const sports = await Sport.find({})
    const sports = await db.Sports.findAll({ include: [{ model: db.MlModelWeights, as: 'MlModelWeights' }, { model: db.HyperParams, as: 'hyperParams' }], raw: true, order: [['name', 'ASC']] });
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
        // console.log(sqlSports)
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

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_LOWRES}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)

            );
        } else if (currentHour >= 17 && currentHour < 24) {
            requests = sports.map(sport =>

                axiosWithBackoff(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_SMOKEY}&regions=us&oddsFormat=american&markets=h2h,spreads,totals`)

            );
        }
        const data = await Promise.all(requests)
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

                                await statDBSaver(event, homeTeamSQL, dbSport, plainGame);
                                await statDBSaver(event, awayTeamSQL, dbSport, plainGame);
                            }

                        }
                    }
                }
            }

            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    };
    await fetchDataWithBackoff(sports.filter(sport => isSportInSeason(sport)));
    let allPastGamesSQL = await db.Games.findAll({
        where: {
            complete: true, // Only include completed games
            predictedWinner: { [Op.in]: ['home', 'away'] },
        },
        include: [
            {
                model: db.Teams,
                as: 'homeTeamDetails', // alias for HomeTeam join
                // No where clause needed here
            },
            {
                model: db.Teams,
                as: 'awayTeamDetails', // alias for AwayTeam join
            }, {
                model: db.Stats,
                as: `homeStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats,
                as: `awayStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            }
        ], where: { predictionCorrect: { [Op.not]: null } }, order: [['commence_time', 'DESC']], raw: true
    })
    for (const sport of sports) {
        let sportGamesSQL = await db.Games.findAll({
            where: { complete: false, sport_key: sport.name }, include: [
                {
                    model: db.Teams,
                    as: 'homeTeamDetails', // alias for HomeTeam join
                    // No where clause needed here
                },
                {
                    model: db.Teams,
                    as: 'awayTeamDetails', // alias for AwayTeam join
                },
                {
                    model: db.Stats,
                    as: `homeStats`,
                    required: true,
                    where: {
                        [Op.and]: [
                            { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                            { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                        ]
                    }
                },
                {
                    model: db.Stats,
                    as: `awayStats`,
                    required: true,
                    where: {
                        [Op.and]: [
                            { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                            { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                        ]
                    }
                }], order: [['commence_time', 'DESC']], raw: true
        })
        if (isSportInSeason(sport)) {
            const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
            if (fs.existsSync(modelPath)) {
                model = await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
                model.compile({
                    optimizer: tf.train.adam(sport['hyperParams.learningRate']),
                    loss: 'binaryCrossentropy',
                    metrics: ['accuracy']
                });
                let historyGames = allPastGamesSQL.filter((game) => game.sport_key === sport.name).sort((gameA, gameB) => new Date(gameB.commence_time) - new Date(gameA.commence_time)).slice(0, sport['hyperParams.historyLength'])
                await predictions(sportGamesSQL, [], model, sport, false, false, historyGames)
            } else {
                console.log(`Model not found for ${sport.name}. Skipping predictions.`);
            }

            await indexAdjuster(sportGamesSQL, sport, allPastGamesSQL, sport['MlModelWeights.featureImportanceScores'])
        }
        let inSeason = isSportInSeason(sport)
        if (inSeason) {
            // During season, keep the sport's statYear as is
            // await db.Sports.update(
            //     { statYear: sport.statYear },
            //     { where: { id } }
            // );
            console.log(`${sport.name} IS IN SEASON SO STAT YEAR WILL REMAIN ${sport.statYear}`)
        } else {
            // Off-season
            let newStatYear;
            const { startMonth, endMonth, multiYear } = sport;
            // Get current month (1-12)
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear()

            if (!multiYear) {
                // Single-year season (e.g. baseball)
                if (currentMonth < startMonth) {
                    newStatYear = currentYear;
                } else {
                    newStatYear = currentYear + 1;
                }
            } else {
                // Multi-year season (e.g. basketball)
                if (currentMonth > endMonth && currentMonth < startMonth) {
                    if (sport.name === 'americanfootball_nfl' || sport.name === 'americanfootball_ncaaf') {
                        newStatYear = currentYear
                    } else {
                        newStatYear = currentYear + 1;
                    }
                } else {
                    newStatYear = currentYear;
                }
            }
            console.log(`TEST WOULD HAVE UPDATED ${sport.name} WITH THE STAT YEAR OF ${newStatYear}`)
            // await db.Sports.update(
            //     { statYear: newStatYear },
            //     { where: { id } }
            // );
        }

    }
    if (global.gc) global.gc();
    console.log(`ODDS FETCHED AND STORED @ ${moment().format('HH:mm:ss')}`)
} //UPDATED FOR SQL

const removeSeed = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight
    // Fetch current odds and past odds within the last week
    // let currentOdds = await Odds.find();
    let currentOddsSQL = await db.Games.findAll({
        where: { complete: false }, include: [
            { model: db.Teams, as: 'homeTeamDetails' }, // alias for HomeTeam join
            { model: db.Teams, as: 'awayTeamDetails' }, // alias for AwayTeam join
            { model: db.Sports, as: 'sportDetails' }, // alias for Sport join
        ], raw: true, order: [['commence_time', 'ASC']]
    });
    await removePastGames(currentOddsSQL);
    const currentOdds = await db.Games.findAll({
        where: {
            complete: false
        },
        include: [
            {
                model: db.Teams,
                as: 'homeTeamDetails', // alias for HomeTeam join
                // No where clause needed here
            },
            {
                model: db.Teams,
                as: 'awayTeamDetails', // alias for AwayTeam join
            },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: {
                    gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
                },
                include: [
                    {
                        model: db.Markets,
                        as: 'markets',
                        where: {
                            bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
                        },
                        include: [
                            {
                                model: db.Outcomes,
                                as: 'outcomes',
                                where: {
                                    marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
                                }
                            }
                        ]
                    }
                ]
            },
            {
                model: db.Stats,
                as: `homeStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats,
                as: `awayStats`,
                required: true,
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
        where: {
            complete: true,
            commence_time: { [Op.gte]: today } // Ensure the commence_time is greater than or equal to today
        },
        include: [
            {
                model: db.Teams,
                as: 'homeTeamDetails', // alias for HomeTeam join
                // No where clause needed here
            },
            {
                model: db.Teams,
                as: 'awayTeamDetails', // alias for AwayTeam join
            },
            {
                model: db.Bookmakers,
                as: 'bookmakers',
                where: {
                    gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
                },
                include: [
                    {
                        model: db.Markets,
                        as: 'markets',
                        where: {
                            bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
                        },
                        include: [
                            {
                                model: db.Outcomes,
                                as: 'outcomes',
                                where: {
                                    marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
                                }
                            }
                        ]
                    }
                ]
            },
            {
                model: db.Stats,
                as: `homeStats`,
                required: true,
                where: {
                    [Op.and]: [
                        { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                        { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                    ]
                }
            },
            {
                model: db.Stats,
                as: `awayStats`,
                required: true,
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
} // UPDATED FOR SQL

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


module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed, mlModelTrainSeed }