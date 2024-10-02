const router = require('express').Router();
const oddsRoutes = require('./oddsRoutes')
const teamRoutes = require('./teamRoutes')

router.use('/odds', oddsRoutes)
router.use('/teams', teamRoutes)

module.exports = router;