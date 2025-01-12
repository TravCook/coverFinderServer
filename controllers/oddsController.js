const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, HockeyTeam, BaseballTeam } = require('../models');
const moment = require('moment');
const NodeCache = require('node-cache');
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
                sport_key:1, 
                sport_title: 1, 
                sport:1, 
                bookmakers: 1
            });
            // Apply filter
            odds = filterOddsByCommenceTime(odds, filterDays);
            // Store in cache for 1 minute (to avoid querying DB repeatedly)
            myCache.set(cacheKey, JSON.stringify(odds), 60);
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
        try {
            let odds = await getCachedOdds('allOdds', {});
            // Sort data by commence_time and winPercent
            return res.json(odds.sort((a, b) => {
                const timeA = moment.utc(a.commence_time).startOf('minute');
                const timeB = moment.utc(b.commence_time).startOf('minute');
                if (timeA.isSame(timeB)) {
                    return a.winPercent - b.winPercent;
                } else {
                    return timeA.isBefore(timeB) ? -1 : 1;
                }
            }));
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getQuickOdds(req, res) {
        try {
            const odds = await Odds.findOne({id: req.params.id});
            return res.json(odds);
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
            const pastGames = await PastGameOdds.find({}, {
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
                sport_key:1, 
                sport_title: 1, 
                sport:1, 
                bookmakers: 1
            });
            return res.json(pastGames);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getUpcomingMatchups(req, res) {
        try {
            let nextNFL = [], nextNCAAF = [], nextNHL = [], nextNBA = [], nextMLB = [];
            const odds = await Odds.find({});
            let sortedOdds = odds.sort((a, b) => moment(a.commence_time) - moment(b.commence_time));

            // Check if team logos are in cache, if not fetch from DB
            for (let game of sortedOdds) {
                let homeTeam, awayTeam;

                if (game.sport_title === 'NFL' && nextNFL.length < 3) {
                    homeTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.home_team });
                    awayTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.away_team });
                    nextNFL.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    });
                } else if (game.sport_title === 'NCAAF' && nextNCAAF.length < 3) {
                    homeTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.home_team });
                    awayTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.away_team });
                    nextNCAAF.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    });
                } else if (game.sport_title === 'NBA' && nextNBA.length < 3) {
                    homeTeam = await BasketballTeam.findOne({ espnDisplayName: game.home_team });
                    awayTeam = await BasketballTeam.findOne({ espnDisplayName: game.away_team });
                    nextNBA.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    });
                } else if (game.sport_title === 'NHL' && nextNHL.length < 3) {
                    homeTeam = await HockeyTeam.findOne({ espnDisplayName: game.home_team });
                    awayTeam = await HockeyTeam.findOne({ espnDisplayName: game.away_team });
                    nextNHL.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    });
                } else if (game.sport_title === 'MLB' && nextMLB.length < 3) {
                    homeTeam = await BaseballTeam.findOne({ espnDisplayName: game.home_team });
                    awayTeam = await BaseballTeam.findOne({ espnDisplayName: game.away_team });
                    nextMLB.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    });
                }
            }

            let responseOBJ = {
                nextNFLGames: nextNFL,
                nextNCAAFGames: nextNCAAF,
                nextNBAGames: nextNBA,
                nextNHLGames: nextNHL,
                nextMLBGames: nextMLB,
            };
            res.json(responseOBJ);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    }
};
