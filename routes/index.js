const router = require('express').Router();
const path = require('path');
const apiRoutes = require('./api');

router.use('/api', apiRoutes);

router.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", ["https://main.d24wadcr9d2smb.amplifyapp.com/", 'http://localhost:3000']); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


module.exports = router;
