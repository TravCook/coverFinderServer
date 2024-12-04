const {Teams, Odds} = require('../models')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

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
        let team = myCache.get(`${req.body.searchTeam}`)
        if(team==undefined){
            Teams.findOne({ espnDisplayName: req.body.searchTeam
            }).then((team) => {
                let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 10800)
                if(success){
                  return res.json(team)  
                }
            }).catch((err) => {
                return res.status(500).json(err);
            })
        }else{
            let teamJson = JSON.parse(team)
            return res.json(teamJson)
        }
        
    },

}