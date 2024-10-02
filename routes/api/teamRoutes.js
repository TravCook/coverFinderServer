const router = require('express').Router();
const {saveTeamIndex, getTeamStats} = require('../../controllers/teamsController')


router.route('/search').post(getTeamStats)
router.route('/saveIndex').post(saveTeamIndex)

module.exports = router;