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
                sport_key: 1,
                sport_title: 1,
                sport: 1,
                bookmakers: 1
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
        try {
            let data = myCache.get('fullData'); // Check cache first
            if (data === undefined) {
                const currentYear = new Date().getFullYear();
                const startOfYear = `${currentYear}-01-01T00:00:00`;  // YYYY-MM-DDTHH:mm:ss format
                const startOfNextYear = `${currentYear + 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format
                const startOfLastYear = `${currentYear - 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format

                // Get current date and calculate the date 7 days ago
                const currentDate = new Date();
                const sevenDaysAgo = new Date(currentDate);
                sevenDaysAgo.setDate(currentDate.getDate() - 7); // Subtract 7 days

                const yesterday = new Date(currentDate)
                yesterday.setDate(currentDate.getDate() - 1) 

                // Format the dates to match your query format
                const startOfWeek = sevenDaysAgo.toISOString(); // This gives you the date 7 days ago in ISO format

                let odds = await Odds.find({}, {
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
                    predictionStrength: 1,
                }).sort({ commence_time: 1, winPercent: 1 })

                const [footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([UsaFootballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                BasketballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                BaseballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                HockeyTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 })])

                data = {
                    odds: odds,
                    teams: {
                        football: footballTeams,
                        basketball: basketballTeams,
                        baseball: baseballTeams,
                        hockey: hockeyTeams
                    }
                }
                myCache.set('fullData', JSON.stringify(data), 60);
                // Sort data by commence_time and winPercent
            } else {
                data = JSON.parse(data)
            }
            const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
            console.log(`Data size sent: ${dataSize / 1024} KB upcomingGames`);
            return res.json(data)
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    async getQuickOdds(req, res) {
        try {
            let odds = await Odds.findOne({ id: req.params.id });

            // If no odds are found, search in pastGameOdds
            if (!odds) {
                odds = await PastGameOdds.findOne({ id: req.params.id });
            }

            // If still no odds are found, return a 404 error
            if (!odds) {
                return res.status(404).json({ message: 'Game odds not found' });
            }

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
            const currentYear = new Date().getFullYear();
            const startOfYear = `${currentYear}-01-01T00:00:00`;  // YYYY-MM-DDTHH:mm:ss format
            const startOfNextYear = `${currentYear + 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format
            const startOfLastYear = `${currentYear - 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format

            // Get current date and calculate the date 7 days ago
            const currentDate = new Date();
            const sevenDaysAgo = new Date(currentDate);
            sevenDaysAgo.setDate(currentDate.getDate() - 7); // Subtract 7 days

            const oneMonthAgo = new Date(currentDate)
            oneMonthAgo.setDate(currentDate.getDate() - 31)

            // Format the dates to match your query format
            const startOfWeek = sevenDaysAgo.toISOString(); // This gives you the date 7 days ago in ISO format
            let pastGames = await PastGameOdds.find({
                commence_time: { $gte: oneMonthAgo.toISOString(), $lt: currentDate.toISOString() }
            }).sort({ commence_time: -1, winPercent: 1 });
            const [footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([UsaFootballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                BasketballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                BaseballTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 }),
                HockeyTeam.find({}, { teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1, lastFiveGames: 1 })])

                data = {
                    pastGames: pastGames
                }

            const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
            console.log(`Data size sent: ${dataSize / 1024} KB pastGames`);
            return res.json(data);
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
