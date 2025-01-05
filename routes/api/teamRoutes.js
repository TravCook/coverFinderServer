const router = require('express').Router();
const {getTeamStats} = require('../../controllers/teamsController')


router.route('/search').post(getTeamStats)

module.exports = router;