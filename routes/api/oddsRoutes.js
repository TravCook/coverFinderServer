const router = require('express').Router();
const {getAllOdds, getQuickOdds, getOddsBySport} = require('../../controllers/oddsController')

router.route('/').get(getAllOdds)
router.route('/quick').post(getQuickOdds)
router.route('/sport').post(getOddsBySport)
module.exports = router;