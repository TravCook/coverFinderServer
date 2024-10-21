const { Odds, PastGameOdds } = require('../models')
const moment = require('moment')
const pastGameOdds = require('../models/pastGameOdds')
const NodeCache = require("node-cache");
const myCache = new NodeCache();
module.exports = {
    async getAllOdds(req, res) {
        let odds = myCache.get('allOdds')
        if (odds == undefined) {
            await Odds.find().then((odds) => {
                let timeFilter = []
                odds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(14, 'days'))) {
                        timeFilter.push(odds)
                    }
                })
                // console.log(odds)
                let success = myCache.set('allOdds', JSON.stringify(timeFilter), 10800)
                if (success) {
                    return res.json(odds)
                }

            }).catch((err) => {
                console.log(err);
                return res.status(500).json(err);
            })
        } else {
            const JSONodds = JSON.parse(odds)
            let timeFilter = []
            JSONodds.map((odds) => {
                if (moment(odds.commence_time).isBefore(moment().add(14, 'days'))) {
                    timeFilter.push(odds)
                }
            })
            res.json(JSONodds)
        }


    },
    getQuickOdds(req, res) {
        Odds.findOne({
            $and: [
                { 'home_team': { $regex: new RegExp(req.body.home_team), $options: 'i' } },
                { 'away_team': { $regex: new RegExp(req.body.away_team), $options: 'i' } }
            ]
        }).then((odds) => {

            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },
    getOddsBySport(req, res) {
        if (req.body.sport === 'Football') {
            let odds = myCache.get('footballOdds')
            if (odds == undefined) {
                Odds.find({ $or: [{ sport_key: 'americanfootball_nfl' }, { sport_key: 'americanfootball_ncaaf' }] }).then((odds) => {
                    let timeFilter = []
                    odds.map((odds) => {
                        if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                            timeFilter.push(odds)
                        }
                    })
                    myCache.set('footballOdds', JSON.stringify(timeFilter), 10800)
                    return res.json(timeFilter)
                }).catch((err) => {
                    return res.status(500).json(err)
                })
            } else {
                let timeFilter = []
                let jsonOdds = JSON.parse(odds)
                jsonOdds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                        timeFilter.push(odds)
                    }
                })

                return res.json(jsonOdds)
            }

        } else if (req.body.sport === 'Baseball') {
            let odds = myCache.get('baseballOdds')
            if (odds == undefined) {
                Odds.find({ sport_key: 'baseball_mlb' }).then((odds) => {
                    let timeFilter = []
                    odds.map((odds) => {
                        if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                            timeFilter.push(odds)
                        }
                    })
                    myCache.set('baseballOdds', JSON.stringify(timeFilter), 10800)
                    return res.json(timeFilter)
                }).catch((err) => {
                    return res.status(500).json(err)
                })
            } else {
                let timeFilter = []
                let jsonOdds = JSON.parse(odds)
                jsonOdds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                        timeFilter.push(odds)
                    }
                })

                return res.json(jsonOdds)
            }

        } else if (req.body.sport === 'Basketball') {
            let odds = myCache.get('basketballOdds')
            if (odds == undefined) {
                Odds.find({ sport_key: 'basketball_nba' }).then((odds) => {
                    let timeFilter = []
                    odds.map((odds) => {
                        if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                            timeFilter.push(odds)
                        }
                    })
                    myCache.set('basketballOdds', JSON.stringify(timeFilter), 10800)
                    return res.json(timeFilter)
                }).catch((err) => {
                    return res.status(500).json(err)
                })
            }else{
                let timeFilter = []
                let jsonOdds = JSON.parse(odds)
                jsonOdds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                        timeFilter.push(odds)
                    }
                })

                return res.json(jsonOdds)
            }
        } else if (req.body.sport === 'Hockey') {
            let odds = myCache.get('hockeyOdds')
            if (odds == undefined) {
                Odds.find({ sport_key: 'icehockey_nhl' }).then((odds) => {
                    let timeFilter = []
                    odds.map((odds) => {
                        if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                            timeFilter.push(odds)
                        }
                    })
                    myCache.set('hockeyOdds', timeFilter, 10800)
                    return res.json(timeFilter)
                }).catch((err) => {
                    return res.status(500).json(err)
                })
            }else{
                let timeFilter = []
                let jsonOdds = JSON.parse(odds)
                jsonOdds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(7, 'days'))) {
                        timeFilter.push(odds)
                    }
                })

                return res.json(jsonOdds)
            }

        }
    },
    getLowIndex(req, res) {
        Odds.find({ $or: [{ 'homeTeamIndex': { $lt: -5 } }, { 'awayTeamIndex': { $lt: -5 } }] }).then((odds) => {
            // odds.sort(
            //     function(a, b) {          
            //        if (a.homeTeamIndex === b.homeTeamIndex) {
            //           // awayTeamIndex is only important when homeTeamIndex are the same
            //           return b.awayTeamIndex - a.awayTeamIndex;
            //        }
            //        return a.homeTeamIndex > b.homeTeamIndex ? 1 : -1;
            //     });
            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },
    getHighIndex(req, res) {
        Odds.find({ $or: [{ 'homeTeamIndex': { $gt: 5 } }, { 'awayTeamIndex': { $gt: 5 } }] }).then((odds) => {
            // odds.sort(
            //     function(a, b) {          
            //        if (a.homeTeamIndex === b.homeTeamIndex) {
            //           // awayTeamIndex is only important when homeTeamIndex are the same
            //           return b.awayTeamIndex - a.awayTeamIndex;
            //        }
            //        return a.homeTeamIndex < b.homeTeamIndex ? 1 : -1;
            //     });
            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },
    async getWinRates(req, res) {
        const allGames = await PastGameOdds.find()
        let footballGames = []
        let nflGames = []
        let ncaafGames = []
        let baseballGames = []
        let basketballGames = []
        let hockeyGames = []
        let highIndex = []
        let lowIndex = []
        let highIndexDifference = []
        let lowIndexDifference = []
        allGames.map((game) => {
            if (game.sport === 'football') {
                footballGames.push(game)
            } else if (game.sport === 'baseball') {
                baseballGames.push(game)
            } else if (game.sport === 'basketball') {
                basketballGames.push(game)
            } else if (game.sport === 'hockey') {
                hockeyGames.push(game)
            } else if (game.sport_key === 'americanfootball_nfl') {
                nflGames.push(game)
            } else if (game.sport_key === 'americanfootball_ncaaf') {
                ncaafGames.push(game)
            } else if (game.homeTeamIndex > 5 || game.awayTeamIndex > 5) {
                highIndexGames.push(game)
            } else if (game.homeTeamIndex < -5 || game.awayTeamIndex < -5) {
                lowIndexGames.push(game)
            }
            else if (game.homeTeamIndex - game.awayTeamIndex >= 5 || game.awayTeamIndex - game.homeTeamIndex >= 5) {
                highIndexDifference.push(game)
            } else if (game.homeTeamIndex - game.awayTeamIndex <= 5 || game.awayTeamIndex - game.homeTeamIndex <= 5) {
                lowIndexDifference.push(game)
            }
        })

        let overallCorrectPicks = 0
        let footballCorrectPicks = 0
        let nflCorrectPicks = 0
        let ncaafCorrectPicks = 0
        let baseballCorrectPicks = 0
        let basketballCorrectPicks = 0
        let hockeyCorrectPicks = 0
        let highIndexCorrect = 0
        let lowIndexCorrect = 0
        let highIndexDiffCorrect = 0
        let lowIndexDiffCorrect = 0
        for (game = 0; game < allGames.length; game++) {
            if (allGames[game].predictionCorrect === true) {
                overallCorrectPicks++
            }
        }

        // allGames.map((game) => {
        //     if(game.predictionCorrect === true){
        //         overallCorrectPicks++
        //     }
        // })
        footballGames.map((game) => {
            if (game.predictionCorrect === true) {
                footballCorrectPicks++
            }
        })
        baseballGames.map((game) => {
            if (game.predictionCorrect === true) {
                baseballCorrectPicks++
            }
        })
        basketballGames.map((game) => {
            if (game.predictionCorrect === true) {
                basketballCorrectPicks++
            }
        })
        hockeyGames.map((game) => {
            if (game.predictionCorrect === true) {
                hockeyCorrectPicks++
            }
        })
        nflGames.map((game) => {
            if (game.predictionCorrect === true) {
                nflCorrectPicks++
            }
        })
        ncaafGames.map((game) => {
            if (game.predictionCorrect === true) {
                ncaafCorrectPicks++
            }
        })
        highIndex.map((game) => {
            if (game.predictionCorrect === true) {
                highIndexCorrect++
            }
        })
        lowIndex.map((game) => {
            if (game.predictionCorrect === true) {
                lowIndexCorrect++
            }
        })
        highIndexDifference.map((game) => {
            if (game.predictionCorrect === true) {
                highIndexDiffCorrect++
            }
        })
        lowIndexDifference.map((game) => {
            if (game.predictionCorrect === true) {
                lowIndexDiffCorrect++
            }
        })


        return res.json({
            overallWinRate: overallCorrectPicks / allGames.length,
            footballWinRate: footballCorrectPicks / footballGames.length,
            nflWinRate: nflCorrectPicks / nflGames.length,
            ncaafWinRate: ncaafCorrectPicks / ncaafGames.length,
            baseballWinRate: baseballCorrectPicks / baseballGames.length,
            hockeyWinRate: hockeyCorrectPicks / hockeyGames.length,
            basketballWinRate: basketballCorrectPicks / basketballGames.length,
            highIndexWinRate: highIndexCorrect / highIndex.length,
            lowIndexWinRate: lowIndexCorrect / lowIndex.length,
            highIndexDiffWinRate: highIndexDiffCorrect / highIndexDifference.length,
            lowIndexDiffWinRate: lowIndexDiffCorrect / lowIndexDifference.length
        })
    },
    async getIndexDiffWinRate(req, res) {
        let odds = myCache.get('pastOdds')
        if (odds == undefined) {
            const allGames = await PastGameOdds.find()
            let matchingIndex = allGames.filter(function (item) {
                return item.homeTeamIndex - item.awayTeamIndex === req.body.indexDiff || item.awayTeamIndex - item.homeTeamIndex === req.body.indexDiff
            })
            let sportGames = allGames.filter(function (item) {
                return item.sport === req.body.sport
            })
            for (game = 0; game < allGames.length; game++) {
                // if(allGames[game].homeTeamIndex - allGames[game].awayTeamIndex === req.body.indexDiff || allGames[game].awayTeamIndex - allGames[game].homeTeamIndex === req.body.indexDiff){
                //     matchingIndex.push(allGames[game])

                // }
                if (allGames[game].sport === req.body.sport) {
                    sportGames.push(allGames[game])
                }
            }
            let sportGamesCorrect = sportGames.filter(function (item) {
                return item.predictionCorrect
            }).length
            let matchingIndexCorrect = matchingIndex.filter(function (item) {
                return item.predictionCorrect
            }).length
            let success = myCache.set('pastOdds', JSON.stringify(allGames), 10800)
            if (success) {
                return res.json({
                    matchingIndexWinRate: matchingIndexCorrect / matchingIndex.length,
                    sportGamesWinRate: sportGamesCorrect / sportGames.length
                })
            }

        } else {
            const allGames = JSON.parse(odds)
            let matchingIndex = allGames.filter(function (item) {
                return item.homeTeamIndex - item.awayTeamIndex === req.body.indexDiff || item.awayTeamIndex - item.homeTeamIndex === req.body.indexDiff
            })
            let sportGames = allGames.filter(function (item) {
                return item.sport === req.body.sport
            })
            for (game = 0; game < allGames.length; game++) {
                if (allGames[game].sport === req.body.sport) {
                    sportGames.push(allGames[game])
                }
            }
            let sportGamesCorrect = sportGames.filter(function (item) {
                return item.predictionCorrect
            }).length
            let matchingIndexCorrect = matchingIndex.filter(function (item) {
                return item.predictionCorrect
            }).length
            return res.json({
                matchingIndexWinRate: matchingIndexCorrect / matchingIndex.length,
                sportGamesWinRate: sportGamesCorrect / sportGames.length
            })
        }

    }
}