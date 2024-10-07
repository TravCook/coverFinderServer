const {Teams, Odds} = require('../models')

module.exports = {
    saveTeamIndex(req, res) {
        let indexKey = `${req.body.market}Index`
        let updateTime = `${indexKey}UpdatedAt`
        Teams.findOneAndUpdate({_id: req.body.searchTeam}, {
            [indexKey]: req.body.index,
            [updateTime]: req.body.updatedAt,
            gameIndex: req.body.gameIndex

        }, {new: true}).then((team)=>{
            res.json(team)
        })
    },
    getTeamStats(req, res) {
        if(req.body.searchTeam === 'St Louis Blues'){
            req.body.searchTeam = "St. Louis Blues"
        }else if(req.body.searchTeam === 'Montréal Canadiens'){
            req.body.searchTeam = 'Montreal Canadiens'
        }else if(req.body.searchTeam === 'Los Angeles Clippers'){
            req.body.searchTeam = 'LA Clippers'
        }else if(req.body.searchTeam === 'San Jose State Spartans'){
            req.body.searchTeam='San José State Spartans'
        }else if(req.body.searchTeam === 'UMass Minutemen'){
            req.body.searchTeam='Massachusetts Minutemen'
        }else if(req.body.searchTeam === 'Southern Mississippi Golden Eagles'){
            req.body.searchTeam='Southern Miss Golden Eagles'
        }else if(req.body.searchTeam === 'Hawaii Rainbow Warriors'){
            req.body.searchTeam=`Hawai'i Rainbow Warriors`
        }else if(req.body.searchTeam === 'Louisiana Ragin Cajuns'){
            req.body.searchTeam=`Louisiana Ragin' Cajuns`
        }else if(req.body.searchTeam === 'Appalachian State Mountaineers'){
            req.body.searchTeam=`App State Mountaineers`
        }
        Teams.findOne({ espnDisplayName: req.body.searchTeam
        }).then((team) => {
            return res.json(team)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    },

}