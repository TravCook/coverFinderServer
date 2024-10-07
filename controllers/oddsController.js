const {Odds} = require('../models')
const moment = require('moment')

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
    }
}