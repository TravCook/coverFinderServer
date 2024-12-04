const express = require('express')
require('dotenv').config()
const cors = require('cors')
const {CronJob} = require('cron')
const { Odds } = require('./models');
const axios = require('axios')
const path = require('path')
const routes = require('./routes');
const db = require('./config/connection')
// Initialize the app and create a port
const app = express();
const PORT = process.env.PORT || 3001;
// Set up body parsing, static, and route middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cors())
const dataSeed = require('./seeds/seed.js')
const oddsSeed = require('./seeds/seed.js')

app.use(express.static(path.join(__dirname, '../client/build')));

app.use(routes);


const oddsCron = CronJob.from({
    cronTime: '0 0 */8 * * *',
    onTick: function () {
        dataSeed.oddsSeed()
    },
    start: false,
    timeZome: 'America/Denver'
})
const winCron = CronJob.from({
    cronTime: '0 0 */24 * * *',
    onTick: function () {
        dataSeed.winSeed()
    },
    start: false,
    timeZome: 'America/Denver'
})
const dataCron = CronJob.from({
    cronTime: '0 */15 * * * *',
    onTick: function () {
        dataSeed.dataSeed()
    },
    start: false,
    timeZome: 'America/Denver'
})

// Start the server on the port
db.once('open', () => {
    oddsCron.start()
    winCron.start()
    dataCron.start()
})

app.listen(PORT, () => console.log(`Listening on PORT: ${PORT}`));