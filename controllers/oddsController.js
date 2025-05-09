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

                // Get current date and calculate the date 7 days ago
                const currentDate = new Date();
                const oneWeekAgo = new Date(currentDate);
                oneWeekAgo.setDate(currentDate.getDate() - 14); // Subtract 7 days
                oneWeekAgo.setHours(0, 0, 0, 0);  // Set time to midnight

                let valueGames = []
                let sports = await Sport.find({}).sort({ name: 1 })
                let odds = await Odds.find({}).sort({ commence_time: 1, winPercent: 1 })
                let pastGames = await PastGameOdds.find({
                    predictionCorrect: { $exists: true },
                }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1 });
                let allTimeProfit = 0
                let allTimeValueProfit = 0
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
                                let sportSettings = currentSport.valueBetSettings?.find((setting) => setting.bookmaker === req.body.sportsbook)
                                if (sportSettings !== undefined) {
                                    let valueBetCheck = combinedCondition(gameData, outcome, sportSettings.settings.indexDiffSmallNum, sportSettings.settings.indexDiffRangeNum, sportSettings.settings.confidenceLowNum, sportSettings.settings.confidenceRangeNum)

                                    if (valueBetCheck) {
                                        valueGames.push(gameData)
                                        let valuewagerDecOdds = outcome.price > 0 ? (parseFloat(outcome.price) / 100) + 1 : (-100 / parseFloat(outcome.price)) + 1
                                        if (gameData.predictionCorrect === true) {
                                            allTimeValueProfit += (valuewagerDecOdds * 1) - 1
                                        } else if (gameData.predictionCorrect === false) {
                                            allTimeValueProfit -= 1
                                        }
                                    }
                                }

                            }
                            let wagerDecOdds = outcome.price > 0 ? (parseFloat(outcome.price) / 100) + 1 : (-100 / parseFloat(outcome.price)) + 1
                            if (gameData.predictionCorrect === true) {
                                allTimeProfit += (wagerDecOdds * 1) - 1
                            } else if (gameData.predictionCorrect === false) {
                                allTimeProfit -= 1
                            }
                        }
                    })
                } catch (err) {
                    console.log(err)
                }
                data = {
                    allTimeProfit: allTimeProfit,
                    allTimeValueProfit: allTimeValueProfit,
                    odds: odds,
                    valueGames: valueGames,
                    sports: sports,
                    pastGames: pastGames
                }
                pastGames = []
                odds = []
                sports = []
                valueGames = []
                myCache.set('fullData', JSON.stringify(data), 60);
            } else {
                data = JSON.parse(data)
            }
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
        const twoWeeks = new Date();
        twoWeeks.setDate(twoWeeks.getDate() - 15);
        twoWeeks.setHours(0, 0, 0, 0);  // Set time to midnight
        const oneWeek = new Date();
        oneWeek.setDate(oneWeek.getDate() - 7);
        oneWeek.setHours(0, 0, 0, 0);  // Set time to midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);  // Set time to midnight
        try {
            pastGames = await PastGameOdds.find({ predictedWinner: {$exists: true} }).select('-homeTeamStats -awayTeamStats').sort({ commence_time: -1 });
            data = {
                pastGames: pastGames
            }
            pastGames = []
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
