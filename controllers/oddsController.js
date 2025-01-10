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
            odds = await Odds.find(query);
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

// Utility function for calculating win rate
function calculateWinRate(games, predictionCorrect) {
    const correctPicks = games.filter(game => game.predictionCorrect === predictionCorrect).length;
    return correctPicks / games.length;
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

    async getLowIndex(req, res) {
        try {
            let odds = await getCachedOdds('lowIndexOdds', { $or: [{ 'homeTeamIndex': { $lt: -5 } }, { 'awayTeamIndex': { $lt: -5 } }] });
            return res.json(odds);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getHighIndex(req, res) {
        try {
            let odds = await getCachedOdds('highIndexOdds', { $or: [{ 'homeTeamIndex': { $gt: 5 } }, { 'awayTeamIndex': { $gt: 5 } }] });
            return res.json(odds);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getWinRates(req, res) {
        try {
            const allGames = await PastGameOdds.find();
            const sportsData = {
                football: { games: await PastGameOdds.find({ sport: 'football' }), correct: 0 },
                baseball: { games: await PastGameOdds.find({ sport: 'baseball' }), correct: 0 },
                basketball: { games: await PastGameOdds.find({ sport: 'basketball' }), correct: 0 },
                hockey: { games: await PastGameOdds.find({ sport: 'hockey' }), correct: 0 },
                nfl: { games: await PastGameOdds.find({ sport_key: 'americanfootball_nfl' }), correct: 0 },
                ncaaf: { games: await PastGameOdds.find({ sport_key: 'americanfootball_ncaaf' }), correct: 0 }
            };

            // Calculate correct picks for each sport
            for (const sport in sportsData) {
                sportsData[sport].correct = sportsData[sport].games.filter(game => game.predictionCorrect === true).length;
            }

            const highIndex = await PastGameOdds.find({ $or: [{ 'homeTeamIndex': { $gt: 5 } }, { 'awayTeamIndex': { $gt: 5 } }] });
            const lowIndex = await PastGameOdds.find({ $or: [{ 'homeTeamIndex': { $lt: -5 } }, { 'awayTeamIndex': { $lt: -5 } }] });

            return res.json({
                overallWinRate: calculateWinRate(allGames, true),
                footballWinRate: calculateWinRate(sportsData.football.games, true),
                baseballWinRate: calculateWinRate(sportsData.baseball.games, true),
                basketballWinRate: calculateWinRate(sportsData.basketball.games, true),
                hockeyWinRate: calculateWinRate(sportsData.hockey.games, true),
                nflWinRate: calculateWinRate(sportsData.nfl.games, true),
                ncaafWinRate: calculateWinRate(sportsData.ncaaf.games, true),
                highIndexWinRate: calculateWinRate(highIndex, true),
                lowIndexWinRate: calculateWinRate(lowIndex, true),
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getIndexDiffWinRate(req, res) {
        try {
            const allGames = await PastGameOdds.find();
            const matchingIndexGames = allGames.filter(game => Math.abs(game.homeTeamIndex - game.awayTeamIndex) === req.body.indexDiff);
            const matchingIndexWinRate = calculateWinRate(matchingIndexGames, true);

            const sportGames = allGames.filter(game => game.sport_key === req.body.sport_key);
            const sportWinRate = calculateWinRate(sportGames, true);

            const homeTeamGames = allGames.filter(game => game.home_team === req.body.homeTeam || game.away_team === req.body.homeTeam);
            const homeTeamWinRate = calculateWinRate(homeTeamGames, true);

            const awayTeamGames = allGames.filter(game => game.home_team === req.body.awayTeam || game.away_team === req.body.awayTeam);
            const awayTeamWinRate = calculateWinRate(awayTeamGames, true);

            return res.json({
                matchingIndexWinRate,
                sportGamesWinRate: sportWinRate,
                hometeamWinRate: homeTeamWinRate,
                awayteamWinRate: awayTeamWinRate
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getPastGames(req, res) {
        try {
            const pastGames = await PastGameOdds.find();
            const filteredGames = pastGames.filter(game => moment(game.commence_time).isAfter(moment('2024-12-05')));
            return res.json(filteredGames);
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
