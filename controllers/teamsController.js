const { Odds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam} = require('../models')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

module.exports = {
    getTeamStats(req, res) {
        let team = myCache.get(`${req.body.searchTeam}`)
        if(team==undefined){
            if(req.body.sport === 'football'){
                UsaFootballTeam.findOne({ espnDisplayName: req.body.searchTeam }).then((team) => {
                    let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 1)
                    if(success){
                      return res.json(team)  
                    }
                }).catch((err) => {
                    return res.status(500).json(err);
                })
            }else if(req.body.sport === 'basketball'){
                BasketballTeam.findOne({ espnDisplayName: req.body.searchTeam }).then((team) => {
                    let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 1)
                    if(success){
                      return res.json(team)  
                    }
                }).catch((err) => {
                    return res.status(500).json(err);
                })
            }else if(req.body.sport === 'baseball'){
                BaseballTeam.findOne({ espnDisplayName: req.body.searchTeam }).then((team) => {
                    let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 1)
                    if(success){
                      return res.json(team)  
                    }
                }).catch((err) => {
                    return res.status(500).json(err);
                })
            }else if(req.body.sport === 'hockey'){
                HockeyTeam.findOne({ espnDisplayName: req.body.searchTeam }).then((team) => {
                    let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 1)
                    if(success){
                      return res.json(team)  
                    }
                }).catch((err) => {
                    return res.status(500).json(err);
                })
            }
        }else{
            let teamJson = JSON.parse(team)
            return res.json(teamJson)
        }
        
    },
    async getAllTeams(req, res) {
        try {
            const [footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([
                UsaFootballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                BasketballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                BaseballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                HockeyTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 })
            ]);
    
            let allTeams = {
                football: footballTeams,
                basketball: basketballTeams,
                baseball: baseballTeams,
                hockey: hockeyTeams
            };
    
            return res.json(allTeams);
        } catch (err) {
            console.error("Error fetching teams:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }

}