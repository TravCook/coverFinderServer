const {Odds} = require('../models')
const moment = require('moment')

module.exports = {
    getAllOdds(req, res) {
        Odds.find().then((odds) => {
            let timeFilter = []
            odds.map((odds) => {
                if(moment(odds.commence_time).isBefore(moment().add(7, 'days'))){
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
            Odds.find({sport_key: 'americanfootball_nfl'}).then((odds) => {
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
    }
}