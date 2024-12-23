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
                let success = myCache.set('allOdds', JSON.stringify(timeFilter), 840)
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
                    myCache.set('footballOdds', JSON.stringify(timeFilter), 840)
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
                    myCache.set('baseballOdds', JSON.stringify(timeFilter), 840)
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
                    myCache.set('basketballOdds', JSON.stringify(timeFilter), 840)
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
                    myCache.set('hockeyOdds', JSON.stringify(timeFilter), 840)
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
        let odds = myCache.get('lowIndexOdds')
        if(odds == undefined){
            Odds.find({ $or: [{ 'homeTeamIndex': { $lt: -5 } }, { 'awayTeamIndex': { $lt: -5 } }] }).then((odds) => {
                let timeFilter = []
                odds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(14, 'days'))) {
                        timeFilter.push(odds)
                    }
                })
                // console.log(odds)
                let success = myCache.set('lowIndexOdds', JSON.stringify(timeFilter), 840)
                if (success) {
                    return res.json(timeFilter)
                }
                return res.json(odds)
            }).catch((err) => {
                return res.status(500).json(err);
            })
        }else{
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
    getHighIndex(req, res) {
        let odds = myCache.get('highIndexOdds')
        if(odds == undefined){
            Odds.find({ $or: [{ 'homeTeamIndex': { $gt: 5 } }, { 'awayTeamIndex': { $gt: 5 } }] }).then((odds) => {
                let timeFilter = []
                odds.map((odds) => {
                    if (moment(odds.commence_time).isBefore(moment().add(14, 'days'))) {
                        timeFilter.push(odds)
                    }
                })
                // console.log(odds)
                let success = myCache.set('highIndexOdds', JSON.stringify(timeFilter), 840)
                if (success) {
                    return res.json(timeFilter)
                }
                return res.json(odds)
            }).catch((err) => {
                return res.status(500).json(err);
            })
        }else{
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
    async getWinRates(req, res)  {
        const allGames = await PastGameOdds.find()
        const footballGames = await PastGameOdds.find({sport: 'football'})
        const nflGames = await PastGameOdds.find({sport_key: 'americanfootball_nfl'})
        const ncaafGames = await PastGameOdds.find({sport_key: 'americanfootball_ncaaf'})
        const baseballGames = await PastGameOdds.find({sport: 'baseball'})
        const basketballGames = await PastGameOdds.find({sport: 'basketball'})
        const hockeyGames = await PastGameOdds.find({sport: 'hockey'})
        const highIndex = await PastGameOdds.find({$or: [{'homeTeamIndex' : {$gt: 5}},{'awayTeamIndex' : {$gt: 5}}] })
        const lowIndex = await PastGameOdds.find({$or: [{'homeTeamIndex' : {$lt: -5}},{'awayTeamIndex' : {$lt: -5}}] })
        let highIndexDifference = []
        let lowIndexDifference = []
        allGames.map((game) => {
            if(game.homeTeamIndex - game.awayTeamIndex >= 5 || game.awayTeamIndex - game.homeTeamIndex >= 5){
                highIndexDifference.push(game)
            }else if(game.homeTeamIndex - game.awayTeamIndex <= 5 || game.awayTeamIndex - game.homeTeamIndex <= 5){
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
        allGames.map((game) => {
            if(game.predictionCorrect === true){
                overallCorrectPicks++
            }
        })
        footballGames.map((game) => {
            if(game.predictionCorrect === true){
                footballCorrectPicks++
            }
        })
        baseballGames.map((game) => {
            if(game.predictionCorrect === true){
                baseballCorrectPicks++
            }
        })
        basketballGames.map((game) => {
            if(game.predictionCorrect === true){
                basketballCorrectPicks++
            }
        })
        hockeyGames.map((game) => {
            if(game.predictionCorrect === true){
                hockeyCorrectPicks++
            }
        })
        nflGames.map((game) => {
            if(game.predictionCorrect === true){
                nflCorrectPicks++
            }
        })
        ncaafGames.map((game) => {
            if(game.predictionCorrect === true){
                ncaafCorrectPicks++
            }
        })
        highIndex.map((game) => {
            if(game.predictionCorrect === true){
                highIndexCorrect++
            }
        })
        lowIndex.map((game) => {
            if(game.predictionCorrect === true){
                lowIndexCorrect++
            }
        })
        highIndexDifference.map((game) => {
            if(game.predictionCorrect === true){
                highIndexDiffCorrect++
            }
        })
        lowIndexDifference.map((game) => {
            if(game.predictionCorrect === true){
                lowIndexDiffCorrect++
            }
        })


    return res.json({
        overallWinRate : overallCorrectPicks/allGames.length,
        footballWinRate: footballCorrectPicks/footballGames.length,
        nflWinRate: nflCorrectPicks/nflGames.length,
        ncaafWinRate: ncaafCorrectPicks/ncaafGames.length,
        baseballWinRate: baseballCorrectPicks/baseballGames.length,
        hockeyWinRate: hockeyCorrectPicks/hockeyGames.length,
        basketballWinRate: basketballCorrectPicks/basketballGames.length,
        highIndexWinRate: highIndexCorrect/highIndex.length,
        lowIndexWinRate: lowIndexCorrect/lowIndex.length,
        highIndexDiffWinRate: highIndexDiffCorrect/highIndexDifference.length,
        lowIndexDiffWinRate: lowIndexDiffCorrect/lowIndexDifference.length
    })

},
    async getIndexDiffWinRate(req, res) {
        let odds = myCache.get('pastOdds')
        if (odds == undefined) {
            const allGames = await PastGameOdds.find()
            let success = myCache.set('pastOdds', JSON.stringify(allGames), 10800)
            // console.log(req.body)
            if (success) {
                return res.json({
                    matchingIndexWinRate: allGames.filter((game) => (game.homeTeamIndex - game.awayTeamIndex === req.body.indexDiff ||game.awayTeamIndex - game.homeTeamIndex === req.body.indexDiff)).filter((game)=>game.predictionCorrect===true).length / allGames.filter((game) => (game.homeTeamIndex - game.awayTeamIndex === req.body.indexDiff ||game.awayTeamIndex - game.homeTeamIndex === req.body.indexDiff )).length,
                    sportGamesWinRate: allGames.filter((game)=> game.sport_key === req.body.sport_key).filter((game)=>game.predictionCorrect===true).length / allGames.filter((game)=> game.sport_key === req.body.sport_key).length,
                    hometeamWinRate: allGames.filter((game)=>game.home_team === req.body.homeTeam || game.away_team === req.body.homeTeam).filter((game)=>game.predictionCorrect===true).length /  allGames.filter((game)=>game.home_team === req.body.homeTeam || game.away_team === req.body.homeTeam).length,
                    awayteamWinRate: allGames.filter((game)=>game.home_team === req.body.awayTeam || game.away_team === req.body.awayTeam).filter((game)=>game.predictionCorrect===true).length /  allGames.filter((game)=>game.home_team === req.body.awayTeam || game.away_team === req.body.awayTeam).length
                })
            }

        } else {
            const allGames = JSON.parse(odds)
            return res.json({
                matchingIndexWinRate: allGames.filter((game) => (game.homeTeamIndex - game.awayTeamIndex === req.body.indexDiff ||game.awayTeamIndex - game.homeTeamIndex === req.body.indexDiff)).filter((game)=>game.predictionCorrect===true).length / allGames.filter((game) => (game.homeTeamIndex - game.awayTeamIndex === req.body.indexDiff ||game.awayTeamIndex - game.homeTeamIndex === req.body.indexDiff )).length,
                sportGamesWinRate: allGames.filter((game)=> game.sport_key === req.body.sport_key).filter((game)=>game.predictionCorrect===true).length / allGames.filter((game)=> game.sport_key === req.body.sport_key).length,
                hometeamWinRate: allGames.filter((game)=>game.home_team === req.body.homeTeam || game.away_team === req.body.homeTeam).filter((game)=>game.predictionCorrect===true).length /  allGames.filter((game)=>game.home_team === req.body.homeTeam || game.away_team === req.body.homeTeam).length,
                awayteamWinRate: allGames.filter((game)=>game.home_team === req.body.awayTeam || game.away_team === req.body.awayTeam).filter((game)=>game.predictionCorrect===true).length /  allGames.filter((game)=>game.home_team === req.body.awayTeam || game.away_team === req.body.awayTeam).length
            })
        }

    },
    async getPastGames(req, res) {
        const pastGames = await PastGameOdds.find()

        res.json(pastGames.filter((game) => moment(game.commence_time).isAfter(moment('2024-12-05'))))
    }
}