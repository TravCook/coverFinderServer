const router = require('express').Router();
const { getHighIndex, getLowIndex, getAllOdds, getQuickOdds, getOddsBySport} = require('../../controllers/oddsController')

router.route('/').get(getAllOdds)
router.route('/quick').post(getQuickOdds)
router.route('/sport').post(getOddsBySport)
router.route('/highIndex').get(getHighIndex)
router.route('/lowIndex').get(getLowIndex)
module.exports = router;