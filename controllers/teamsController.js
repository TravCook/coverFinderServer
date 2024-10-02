const {Teams} = require('../models')

module.exports = {
    saveTeamIndex(req, res) {
        let indexKey = `${req.body.market}Index`
        let updateTime = `${indexKey}UpdatedAt`
        Teams.findOneAndUpdate({_id: req.body.searchTeam}, {
            [indexKey]: req.body.index,
            [updateTime]: req.body.updatedAt

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
        }
        Teams.findOne({ espnDisplayName: req.body.searchTeam
        }).then((team) => {
            return res.json(team)
        }).catch((err) => {
            return res.status(500).json(err);
        })
    }
}