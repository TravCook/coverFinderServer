const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, HockeyTeam, BaseballTeam, Sport } = require('../models');
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
        try {
            let data = myCache.get('fullData'); // Check cache first
            if (data === undefined) {
                const currentYear = new Date().getFullYear();
                const startOfYear = `${currentYear}-01-01T00:00:00`;  // YYYY-MM-DDTHH:mm:ss format
                const startOfNextYear = `${currentYear + 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format
                const startOfLastYear = `${currentYear - 1}-01-01T00:00:00`; // YYYY-MM-DDTHH:mm:ss format

                // Get current date and calculate the date 7 days ago
                const currentDate = new Date();
                const twoWeeksAgo = new Date(currentDate);
                twoWeeksAgo.setDate(currentDate.getDate() - 12); // Subtract 7 days

                const yesterday = new Date(currentDate)
                yesterday.setDate(currentDate.getDate() - 1)

                // Format the dates to match your query format
                const startOfWeek = twoWeeksAgo.toISOString(); // This gives you the date 7 days ago in ISO format

                const oneMonthAgo = new Date(currentDate)
                oneMonthAgo.setDate(currentDate.getDate() - 31)
                let valueGames = []
                let sports = await Sport.find({})
                let odds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 })
                let pastGames = await PastGameOdds.find({
                    commence_time: { $gte: oneMonthAgo.toISOString(), $lt: currentDate.toISOString() }
                }).sort({ commence_time: -1, winPercent: 1 });

                try {
                    pastGames.map((gameData, idx) => {
                        const bookmaker = gameData?.bookmakers?.find(b => b.key === req.body.sportsbook);
                        if (bookmaker) {
                            const marketData = bookmaker?.markets?.find(m => m.key === 'h2h');

                            let outcome = marketData?.outcomes?.find(o => {
                                return o.name === (gameData.predictedWinner === 'home' ? gameData.home_team : gameData.away_team)
                            });

                            if (outcome) {
                                let currentSport = sports.find(arraySport => arraySport.name === gameData.sport_key)
                                let sportSettings = currentSport.valueBetSettings.find((setting) => setting.bookmaker === req.body.sportsbook)
                                if (sportSettings !== undefined) {
                                    let valueBetCheck = combinedCondition(gameData, outcome, sportSettings.settings.indexDiffSmallNum, sportSettings.settings.indexDiffRangeNum, sportSettings.settings.confidenceLowNum, sportSettings.settings.confidenceRangeNum)

                                    if (valueBetCheck) {
                                        valueGames.push(gameData)
                                    }
                                }

                            }

                        }
                    })
                } catch (err) {
                    console.log(err)
                }

                data = {
                    odds: odds,
                    valueGames: valueGames,
                    sports: sports,
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
        const oneMonth = new Date();
        oneMonth.setDate(oneMonth.getDate() - 30);
        oneMonth.setHours(0, 0, 0, 0);  // Set time to midnight
        try {
            let pastGames = await PastGameOdds.find({ predictedWinner: { $exists: true, $ne: null } }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1, winPercent: 1 });
            let filteredGames = pastGames.filter((game) => new Date(game.commence_time) > new Date(oneMonth))
            data = {
                pastGames: filteredGames
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
