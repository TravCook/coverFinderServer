const {Odds} = require('../models')

module.exports = {
    getAllOdds(req, res) {
        Odds.find().then((odds) => {
            return res.json(odds)
        }).catch((err) => {
            console.log(err);
            return res.status(500).json(err);
        })
    },
    getQuickOdds(req, res) {
        console.log(req.body)
        Odds.findOne({ $and: [
            {'home_team': {$regex: new RegExp(req.body.home_team), $options: 'i'}},
            {'away_team': {$regex: new RegExp(req.body.away_team), $options: 'i'}}
        ]
        }).then((odds) => {
            console.log(odds)
            return res.json(odds)
        }).catch((err) => {
            console.log(err);
            return res.status(500).json(err);
        })
    }
}