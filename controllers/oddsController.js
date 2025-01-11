const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, HockeyTeam, BaseballTeam } = require('../models');
const moment = require('moment');
const NodeCache = require('node-cache');
const myCache = new NodeCache();

// Utility function for filtering odds based on commence time
function filterOddsByCommenceTime(odds, days = 30) {
    return odds.filter(odds => moment(odds.commence_time).isBefore(moment().add(days, 'days')));
}

// Cache the odds if needed
async function getCachedOdds(cacheKey, query, filterDays = 30) {
    let odds = myCache.get(cacheKey);
    if (odds === undefined) {
        try {
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
                bookmakers: 1});
            odds = filterOddsByCommenceTime(odds, filterDays);
            myCache.set(cacheKey, JSON.stringify(odds), 1); // Cache for 5 minutes
        } catch (err) {
            throw new Error('Error fetching odds: ' + err.message);
        }
    } else {
        odds = JSON.parse(odds);
    }
    return odds;
}


module.exports = {
    async getAllOdds(req, res) {
        try {
            let odds = await getCachedOdds('allOdds', {});
            return res.json(odds.sort((a, b) => {
                const timeA = moment.utc(a.commence_time).startOf('minute');  // Round to the start of the minute
                const timeB = moment.utc(b.commence_time).startOf('minute');  // Round to the start of the minute
            
                if (timeA.isSame(timeB)) {
                    return a.winPercent - b.winPercent;  // Sort by winPercent if times are the same
                } else {
                    return timeA.isBefore(timeB) ? -1 : 1;  // Sort by commence_time otherwise
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
        // const sportKeys = {
        //     'Football': ['americanfootball_nfl', 'americanfootball_ncaaf'],
        //     'Baseball': ['baseball_mlb'],
        //     'Basketball': ['basketball_nba'],
        //     'Hockey': ['icehockey_nhl']
        // };
        
        // const sportKey = sportKeys[req.body.sport];
        // if (!sportKey) {
        //     return res.status(400).json({ message: 'Invalid sport' });
        // }

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
                bookmakers: 1});
            return res.json(pastGames);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getUpcomingMatchups(req, res) {
        try{
            let nextNFL = []
            let nextNCAAF = []
            let nextNHL = []
            let nextNBA = []
            let nextMLB = []
            
            const odds = await Odds.find({})
            let sortedOdds = odds.sort((a, b) => moment(a.commence_time) - moment(b.commence_time))
            
            for (let game of sortedOdds) {
                let homeTeam
                let awayTeam
            
                if (game.sport_title === 'NFL' && nextNFL.length < 3) {
                    homeTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.home_team })
                    awayTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.away_team })
                    nextNFL.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    })
                } else if (game.sport_title === 'NCAAF' && nextNCAAF.length < 3) {
                    homeTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.home_team })
                    awayTeam = await UsaFootballTeam.findOne({ espnDisplayName: game.away_team })
                    nextNCAAF.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    })
                } else if (game.sport_title === 'NBA' && nextNBA.length < 3) {
                    homeTeam = await BasketballTeam.findOne({ espnDisplayName: game.home_team })
                    awayTeam = await BasketballTeam.findOne({ espnDisplayName: game.away_team })
                    nextNBA.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    })
                } else if (game.sport_title === 'NHL' && nextNHL.length < 3) {
                    homeTeam = await HockeyTeam.findOne({ espnDisplayName: game.home_team })
                    awayTeam = await HockeyTeam.findOne({ espnDisplayName: game.away_team })
                    nextNHL.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    })
                } else if (game.sport_title === 'MLB' && nextMLB.length < 3) {
                    homeTeam = await BaseballTeam.findOne({ espnDisplayName: game.home_team })
                    awayTeam = await BaseballTeam.findOne({ espnDisplayName: game.away_team })
                    nextMLB.push({
                        homeTeamLogo: homeTeam.logo,
                        awayTeamLogo: awayTeam.logo
                    })
                }
            }
            let responseOBJ = {
                nextNFLGames: nextNFL,
                nextNCAAFGames: nextNCAAF,
                nextNBAGames: nextNBA,
                nextNHLGames: nextNHL,
                nextMLBGames: nextMLB,
            }
            res.json(responseOBJ)
            
        } catch (err) {
            return res.status(500).json({ message: err.message})
        }
    }
};
