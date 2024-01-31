const router = require('express').Router();
const oddsRoutes = require('./oddsRoutes')

router.use('/odds', oddsRoutes)

module.exports = router;