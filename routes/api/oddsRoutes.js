const router = require('express').Router();
const { getAllOdds, getQuickOdds, getOddsBySport, getPastGames, getUpcomingMatchups} = require('../../controllers/oddsController')

router.route('/').post(getAllOdds)
router.route('/sport').post(getOddsBySport)
router.route('/pastGameOdds').post(getPastGames)
router.route('/upcomingGames').get(getUpcomingMatchups)
router.route('/:id').get(getQuickOdds)
module.exports = router;