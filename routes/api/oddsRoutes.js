const router = require('express').Router();
const { getHighIndex, getLowIndex, getAllOdds, getQuickOdds, getOddsBySport, getWinRates, getIndexDiffWinRate, getPastGames, getUpcomingMatchups} = require('../../controllers/oddsController')

router.route('/').get(getAllOdds)
router.route('/sport').post(getOddsBySport)
router.route('/highIndex').get(getHighIndex)
router.route('/lowIndex').get(getLowIndex)
router.route('/winRates').get(getWinRates)
router.route('/winRateDiff').post(getIndexDiffWinRate)
router.route('/pastGameOdds').post(getPastGames)
router.route('/upcomingGames').get(getUpcomingMatchups)
router.route('/:id').get(getQuickOdds)
module.exports = router;