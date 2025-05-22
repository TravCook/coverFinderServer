const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, HockeyTeam, BaseballTeam, Sport, Weights } = require('../models');
const moment = require('moment');
const NodeCache = require('node-cache');
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
        let sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        try {
            let data = myCache.get('fullData'); // Check cache first
            if (data === undefined) {
                let sports = await Sport.find({}).sort({ name: 1 })
                let odds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 })
                let pastGames = await PastGameOdds.find({ predictedWinner: { $exists: true }, commence_time: {$gte: sevenDaysAgo} }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1 });
                let mlModelWeights = await Weights.find()

                data = {
                    odds: odds,
                    sports: sports,
                    pastGames: pastGames,
                    mlModelWeights: mlModelWeights
                }
                odds = []
                sports = []
                myCache.set('fullData', JSON.stringify(data), 60);

            } else {
                data = JSON.parse(data)
            }
            return res.json(data)
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
            pastGames = []
            return res.json(data);

        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

};
