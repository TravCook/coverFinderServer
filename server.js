const express = require('express')
require('dotenv').config()
const cors = require('cors')
const path = require('path')
const routes = require('./routes')
const db = require('./config/connection')
// Initialize the app and create a port
const app = express()
const PORT = process.env.PORT || 3001
// Set up body parsing, static, and route middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(express.static(path.join(__dirname, '../client/build')))
app.use(routes)
// Cron job configurations
const { CronJob } = require('cron');
const dataSeed = require('./seeds/seed.js');
// Ensure that the timezone is passed as a valid string
const timezone = 'America/Denver';
const cronJobs = [
  {
    cronTime: '0 0 */8 * * *', // every 8 hours
    onTick: dataSeed.oddsSeed,
    timezone, // Ensure this is a string, 'America/Denver'
  },
  {
    cronTime: '0 */10 * * * *', // every 10 minutes
    onTick: dataSeed.dataSeed,
    timezone, // Ensure this is a string, 'America/Denver'
  },
];

cronJobs.forEach(({ cronTime, onTick, timezone }) => {
  // Make sure timezone is a string before passing to CronJob
  if (typeof timezone !== 'string') {
    throw new Error('Timezone must be a valid string');
  }
  const cronJob = new CronJob(cronTime, onTick, null, true, timezone);  // Ensure cron job is created correctly
  cronJob.start();
});

// Start the server on the port
db.once('open', () => {
    console.log(`Listening on PORT: ${PORT}`)
    app.listen(PORT)
})
