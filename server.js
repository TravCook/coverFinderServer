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
    cronTime: '0 0 1 * * *',
    onTick: function () {
        console.log('tick')
        dataSeed.oddsSeed()
    },
    start: false,
    timeZome: 'America/Denver'
})
const dataCron = CronJob.from({
    cronTime: '0 */10 * * * *',
    onTick: function () {
        console.log('tick')
        dataSeed.dataSeed()
    },
    start: false,
    timeZome: 'America/Denver'
})

// Start the server on the port
db.once('open', () => {
    oddsCron.start()
    dataCron.start()
})

app.listen(PORT, () => console.log(`Listening on PORT: ${PORT}`));