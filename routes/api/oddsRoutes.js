const router = require('express').Router();
const {getAllOdds, getQuickOdds} = require('../../controllers/oddsController')

// router.route('/').get(getAllOdds)
router.route('/quick').post(getQuickOdds)
module.exports = router;