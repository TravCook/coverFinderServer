const router = require('express').Router();
const { getAllOdds, getOddsBySport, getPastGames} = require('../../controllers/oddsController')

router.route('/').post(getAllOdds)
router.route('/sport').post(getOddsBySport)
router.route('/pastGameOdds').post(getPastGames)
module.exports = router;