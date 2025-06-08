const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, HockeyTeam, BaseballTeam, Sport, Weights } = require('../models');
const moment = require('moment');
const NodeCache = require('node-cache');
const db = require('../models_sql');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { combinedCondition } = require('../utils/constants');
const myCache = new NodeCache(); // Instantiate cache object

// Utility function for filtering odds based on commence time
function filterOddsByCommenceTime(odds, days = 30) {
    return odds.filter(odds => moment(odds.commence_time).isBefore(moment().add(days, 'days')));
}

// Cache the odds if needed
async function getCachedOdds(cacheKey, query, filterDays = 30) {
    let odds = myCache.get(cacheKey); // Check cache first
    if (odds === undefined) {
        try {
            // Fetch from database if not in cache
            odds = await Odds.find(query, {
                commence_time: 1,
                home_team: 1,
                homeTeamIndex: 1,
                homeScore: 1,
                away_team: 1,
                awayTeamIndex: 1,
                awayScore: 1,
                winPercent: 1,
                homeTeamlogo: 1,
                awayTeamlogo: 1,
                winner: 1,
                predictionCorrect: 1,
                id: 1,
                sport_key: 1,
                sport_title: 1,
                sport: 1,
                bookmakers: 1,
                homeTeamStats: 1,
                awayTeamStats: 1
            });
            // Apply filter
            odds = filterOddsByCommenceTime(odds, filterDays);
            // Store in cache for 1 minute (to avoid querying DB repeatedly)
            myCache.set(cacheKey, JSON.stringify(odds), 2700);
        } catch (err) {
            throw new Error('Error fetching odds: ' + err.message);
        }
    } else {
        odds = JSON.parse(odds); // Return cached result
    }
    return odds;
}

module.exports = {
    async getAllOdds(req, res) {
        const today = new Date()
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7); // 7 days ago
        sevenDaysAgo.setHours(0, 0, 0, 0); // Set to midnight 
        try {
            let data = myCache.get('fullData');
            if (!data) {
                // const games = await db.Games.findAll({
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
                // const pastSQLgames = await db.Games.findAll({
                //     where: {
                //         complete: true,
                //         commence_time: {
                //             [Op.gt]: sevenDaysAgo
                //         }
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
                // let plainGames = games.map((game) => game.get({ plain: true }))
                // let plainPastGames = pastSQLgames.map((game) => game.get({ plain: true }))
                const [sports, odds, pastGames, mlModelWeights] = await Promise.all([
                    Sport.find({}).sort({ name: 1 }),
                    Odds.find({}).sort({ commence_time: 1, winPercent: 1 }),
                    PastGameOdds.find({ predictedWinner: { $exists: true }, commence_time: { $gte: sevenDaysAgo } }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1 }),
                    Weights.find()
                ]);

                data = { odds, sports, pastGames, mlModelWeights };
                myCache.set('fullData', JSON.stringify(data), 300); // Don't stringify unless needed
            }else{
                data = JSON.parse(data);
            }

            return res.json(data);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },
    

    async getOddsBySport(req, res) {
        try {
            let odds = await getCachedOdds(`${req.body.sport.toLowerCase()}Odds`, { sport_title: req.body.sport });
            return res.json(odds);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getPastGames(req, res) {
        try {
            pastGames = await PastGameOdds.find({ predictedWinner: { $exists: true } }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1 });
            data = {
                pastGames: pastGames
            }
            pastGames = null
            return res.json(data);

        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

};
