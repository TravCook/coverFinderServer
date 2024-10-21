const {Odds, PastGameOdds} = require('../models')
const moment = require('moment')
const pastGameOdds = require('../models/pastGameOdds')

module.exports = {
    getAllOdds(req, res) {
        Odds.find().then((odds) => {
            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(14, 'days'))){
                    timeFilter.push(odds)
                }
            })
            return res.json(timeFilter)
        }).catch((err) => {
            console.log(err);
            return res.status(500).json(err);
        })
    },
    getQuickOdds(req, res) {
        Odds.findOne({ $and: [
            {'home_team': {$regex: new RegExp(req.body.home_team), $options: 'i'}},
            {'away_team': {$regex: new RegExp(req.body.away_team), $options: 'i'}}
        ]
        }).then((odds) => {

            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },
    getOddsBySport(req, res) {
        if(req.body.sport === 'Football'){
            Odds.find({$or: [{sport_key: 'americanfootball_nfl'},{sport_key: 'americanfootball_ncaaf'}]}).then((odds) => {
            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(7, 'days'))){
                    timeFilter.push(odds)
                }
            })
            return res.json(timeFilter)
            }).catch((err) => {
                return res.status(500).json(err)
            })
        }else if(req.body.sport === 'Baseball'){
            Odds.find({sport_key: 'baseball_mlb'}).then((odds) => {
                            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(7, 'days'))){
                    timeFilter.push(odds)
                }
            })
            return res.json(timeFilter)
            }).catch((err) => {
                return res.status(500).json(err)
            })
        }else if(req.body.sport === 'Basketball'){
            Odds.find({sport_key: 'basketball_nba'}).then((odds) => {
                            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(7, 'days'))){
                    timeFilter.push(odds)
                }
            })
            return res.json(timeFilter)
            }).catch((err) => {
                return res.status(500).json(err)
            })
        }else if(req.body.sport === 'Hockey'){
            Odds.find({sport_key: 'icehockey_nhl'}).then((odds) => {
                            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(7, 'days'))){
                    timeFilter.push(odds)
                }
            })
            return res.json(timeFilter)
            }).catch((err) => {
                return res.status(500).json(err)
            })
        }
        // Odds.find({})
    },
    getLowIndex(req, res) {
        Odds.find({$or: [{'homeTeamIndex' : {$lt: -5}},{'awayTeamIndex' : {$lt: -5}}] }).then((odds) =>{
            odds.sort(
                function(a, b) {          
                   if (a.homeTeamIndex === b.homeTeamIndex) {
                      // awayTeamIndex is only important when homeTeamIndex are the same
                      return b.awayTeamIndex - a.awayTeamIndex;
                   }
                   return a.homeTeamIndex > b.homeTeamIndex ? 1 : -1;
                });
            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },
    getHighIndex(req, res) {
        Odds.find({$or: [{'homeTeamIndex' : {$gt: 5}},{'awayTeamIndex' : {$gt: 5}}] }).then((odds) =>{
            odds.sort(
                function(a, b) {          
                   if (a.homeTeamIndex === b.homeTeamIndex) {
                      // awayTeamIndex is only important when homeTeamIndex are the same
                      return b.awayTeamIndex - a.awayTeamIndex;
                   }
                   return a.homeTeamIndex < b.homeTeamIndex ? 1 : -1;
                });
            return res.json(odds)
        }).catch((err) => {
            return res.status(500).json(err);
        })
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
    }
}