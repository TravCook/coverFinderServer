const router = require('express').Router();
const {getTeamStats, getAllTeams} = require('../../controllers/teamsController')

router.route('/').get(getAllTeams)
router.route('/search').post(getTeamStats)


module.exports = router;