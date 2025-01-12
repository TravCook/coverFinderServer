const { UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../models');
const NodeCache = require('node-cache');
const myCache = new NodeCache(); // Instantiate cache object

module.exports = {
    getTeamStats(req, res) {
        let team = myCache.get(`${req.body.searchTeam}`);
        if (team === undefined) {
            // If the team is not in cache, fetch from DB based on the sport
            if (req.body.sport === 'football') {
                UsaFootballTeam.findOne({ espnDisplayName: req.body.searchTeam })
                    .then((team) => {
                        let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 60); // Cache for 1 minute
                        if (success) {
                            return res.json(team);
                        }
                    }).catch((err) => {
                        return res.status(500).json(err);
                    });
            } else if (req.body.sport === 'basketball') {
                BasketballTeam.findOne({ espnDisplayName: req.body.searchTeam })
                    .then((team) => {
                        let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 60); // Cache for 1 minute
                        if (success) {
                            return res.json(team);
                        }
                    }).catch((err) => {
                        return res.status(500).json(err);
                    });
            } else if (req.body.sport === 'baseball') {
                BaseballTeam.findOne({ espnDisplayName: req.body.searchTeam })
                    .then((team) => {
                        let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 60); // Cache for 1 minute
                        if (success) {
                            return res.json(team);
                        }
                    }).catch((err) => {
                        return res.status(500).json(err);
                    });
            } else if (req.body.sport === 'hockey') {
                HockeyTeam.findOne({ espnDisplayName: req.body.searchTeam })
                    .then((team) => {
                        let success = myCache.set(`${req.body.searchTeam}`, JSON.stringify(team), 60); // Cache for 1 minute
                        if (success) {
                            return res.json(team);
                        }
                    }).catch((err) => {
                        return res.status(500).json(err);
                    });
            }
        } else {
            let teamJson = JSON.parse(team);
            return res.json(teamJson); // Return cached team data
        }
    },

    async getAllTeams(req, res) {
        try {
            // Fetch all teams from cache or DB if not cached
            const cacheKey = 'allTeams';
            let allTeams = myCache.get(cacheKey);
            if (allTeams === undefined) {
                const [footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([
                    UsaFootballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                    BasketballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                    BaseballTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
                    HockeyTeam.find({}, { teamId: 1, teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 })
                ]);

                allTeams = {
                    football: footballTeams,
                    basketball: basketballTeams,
                    baseball: baseballTeams,
                    hockey: hockeyTeams
                };

                myCache.set(cacheKey, JSON.stringify(allTeams), 60); // Cache for 1 minute
            } else {
                allTeams = JSON.parse(allTeams);
            }

            return res.json(allTeams);
        } catch (err) {
            console.error("Error fetching teams:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
};
