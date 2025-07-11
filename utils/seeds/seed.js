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
const { normalizeTeamName, normalizeOutcomes, modelConfAnalyzer, } = require('../helperFunctions/dataHelpers/dataSanitizers')
const { transporter, getImpliedProbability } = require('../constants')
const { statMinMax, statMeanStdDev, generateGlobalStats } = require('../helperFunctions/dataHelpers/pastGamesHelper');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { gameDBSaver, statDBSaver } = require('../helperFunctions/dataHelpers/databaseSavers');
const { raw } = require('express');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap } = require('../statMaps');

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs

const dataSeed = async () => {
    console.log("DB CONNECTED ------------------------------------------------- STARTING DATA SEED")
    // UPDATE TEAMS WITH MOST RECENT STATS // WORKING AS LONG AS DYNAMIC STAT YEAR CAN WORK CORRECTLY
    // let sports = await Sport.find({})
    let sports = await db.Sports.findAll({})
    await retrieveTeamsandStats(sports)
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
    if (global.gc) global.gc();
} //UPDATED FOR SQL

const mlModelTrainSeed = async () => {
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
        // retrieve upcoming games
        let upcomingGames = odds.filter((game) => game.sport_key === sport.name)
        // Multi-year sports (e.g., NFL, NBA, NHL, etc.)
        if (upcomingGames.length > 0) {
            const pastGames = await db.Games.findAll({
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
                await trainSportModelKFold(sport, pastGames, false, odds)
                let newSport = await db.Sports.findOne({
                    where: { name: sport.name },
                    include: [{ model: db.MlModelWeights, as: 'MlModelWeights' }, { model: db.HyperParams, as: 'hyperParams' }],
                    raw: true
                });
                if (global.gc) global.gc();
                // await pastGamesReIndex(upcomingGames, newSport)
                if (global.gc) global.gc();
            } else {
                console.log(`NOT ENOUGH ${sport.name} DATA`)
            }
            console.log(`${sport.name} ML DONE @ ${moment().format('HH:mm:ss')}`)
        } else {
            console.log(`${sport.name} NOT IN SEASON`)
        }

    }

    // const today = new Date();
    // today.setHours(0, 0, 0, 0);  // Set time to midnight
    // const currentOdds = await db.Games.findAll({
    //     where: {
    //         complete: false
    //     },
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
    // const pastOdds = await db.Games.findAll({
    //     where: {
    //         complete: true,
    //         commence_time: { [Op.gte]: today } // Ensure the commence_time is greater than or equal to today
    //     },
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
    // await emitToClients('gameUpdate', currentOdds);
    // await emitToClients('pastGameUpdate', pastOdds);
    if (global.gc) global.gc();
    // await valueBetGridSearch(sports)
    if (global.gc) global.gc();
    // await hyperparameterRandSearch(sports)

    // await modelConfAnalyzer();
    if (global.gc) global.gc();

    // TODO RESUME WORK HERE TO REFACTOR FOR SQL
    // if (global.gc) global.gc();
    // upcomingGames = []
    // pastGames = []


    // const currentDate = new Date();
    // const yesterday = new Date(currentDate);
    // yesterday.setDate(currentDate.getDate() - 1);
    // yesterday.setHours(0, 0, 0, 0);
    // let yesterdayGames = await PastGameOdds.find({ commence_time: { $gte: yesterday } }).select('-homeTeamStats -awayTeamStats')
    // const stats = {
    //     date: new Date().toLocaleDateString(),
    //     totalPredictions: yesterdayGames.length,
    //     wins: yesterdayGames.filter((game) => game.predictionCorrect === true).length,
    //     losses: yesterdayGames.filter((game) => game.predictionCorrect === false).length,
    //     //TODO ADD SPORTS BREAKDOWN STATS
    //     //TODO ADD BIGGEST WIN
    // };

    // const html = `
    //     <h2>📊 Daily Sports Prediction Report - ${stats.date}</h2>
    //     <p>This is your automated status report. App is running (PM2 active).</p>
    //     <hr />
    //     <h3>🏁 Overall Summary</h3>
    //     <ul>
    //       <li>Total Predictions: <strong>${stats.totalPredictions}</strong></li>
    //       <li>Wins: <strong style="color:green">${stats.wins}</strong></li>
    //       <li>Losses: <strong style="color:red">${stats.losses}</strong></li>
    //       <li>Win Rate: <strong>${((stats.wins / stats.totalPredictions) * 100).toFixed(1)}%</strong></li>
    //     </ul>

    //     <hr />
    //     <p style="color:gray;font-size:0.9em;">App check-in via PM2 successful — ${new Date().toLocaleTimeString()}</p>
    //   `;

    // //   <h3>🏀 Wins by Sport</h3>
    // //   <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;">
    // //     <tr><th>Sport</th><th>Wins</th><th>Losses</th></tr>
    // //     ${Object.entries(stats.sportsBreakdown).map(([sport, {wins, losses}]) => `
    // //       <tr>
    // //         <td>${sport}</td>
    // //         <td style="color:green">${wins}</td>
    // //         <td style="color:red">${losses}</td>
    // //       </tr>
    // //     `).join('')}
    // //   </table>

    // //   <h3>💥 Biggest Win</h3>
    // //   <p>
    // //     <strong>${stats.biggestWin.matchup}</strong> (${stats.biggestWin.sport}) <br />
    // //     Odds: ${stats.biggestWin.odds} <br />
    // //     Result: <strong style="color:green">${stats.biggestWin.result}</strong>
    // //   </p>

    // const mailOptions = {
    //     from: '"BetterBetsAPI" betterbetsApp@gmail.com',
    //     to: process.env.NODEMAILER_RECIPIENT,
    //     subject: `Daily Sports Report - ${stats.date}`,
    //     html,
    // };

    // const info = await transporter.sendMail(mailOptions);

    // console.log("Message sent:", info.messageId);

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

            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
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
            }], where: { predictionCorrect: { [Op.not]: null } }, order: [['commence_time', 'DESC']], raw: true
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
        if (sportGamesSQL.length > 0) {
            const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
            if (fs.existsSync(modelPath)) {
                model = await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
                model.compile({
                    optimizer: tf.train.adam(sport['hyperParams.learningRate']),
                    loss: 'binaryCrossentropy',
                    metrics: ['accuracy']
                });
                await predictions(sportGamesSQL, [], model, sport)
            } else {
                console.log(`Model not found for ${sport.name}. Skipping predictions.`);
            }

            await indexAdjuster(sportGamesSQL, sport, allPastGamesSQL, sport['MlModelWeights.featureImportanceScores'])
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

//TAKES ABOUT 1 HOUR
// const paramAndValueSeed = async () => {
//     const sports = await Sport.find({}).sort({ name: 1 }).lean()
//     await hyperparameterRandSearch(sports)
//     if (global.gc) global.gc();
// }

// const teamInfoUpdater = async () => {
//     const teams = await db.Teams.findAll()
//     const sports = await db.Sports.findAll()
//     for(const sport of sports){
//         console.log(`Starting ${sport.name} Team updates`)
//         let sportTeams = teams.filter((team) => team.league === sport.name)
//         for(const team of sportTeams){
//             const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.espnSport}/${sport.league}/teams/${team.espnID}`);
//             const teamData = await response.json();
//             let darkBGLogo = teamData.team.logos?.find((logo) => {
//                 return logo.rel.find((rel) => rel === 'dark')
//             })
//             let lightBGLogo = teamData.team.logos?.find((logo) => {
//                 return logo.rel.find((rel) => rel === 'default')
//             })
//             let school
//             if(teamData.team.location && team.espnLeague.includes('college')){
//                 school = teamData.team.location
//             }
//             await db.Teams.update({
//                 school: school,
//                 mainColor: teamData.team.color ? teamData.team.color : null,
//                 secondaryColor: teamData.team.alternateColor ? teamData.team.alternateColor : null,
//                 lightLogo: lightBGLogo ? lightBGLogo.href : team.logo,
//                 darkLogo: darkBGLogo ? darkBGLogo.href : team.logo

//             }, {
//                 where: {id: team.id}
//             })
//         }
//         console.log(`Finished ${sport.name} Team updates`)
//     }

// }

// teamInfoUpdater()
// modelConfAnalyzer()
// removeSeed()
// oddsSeed()
mlModelTrainSeed()
// dataSeed()
// statMinMax()
//TODO: ANALYZE ML MODEL TRAIN SEED AND ADDRESS RAM ISSUES ON EC2 INSTANCE

module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed, mlModelTrainSeed }