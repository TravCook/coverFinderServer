const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./config/connection');
const sqlDB = require('./models_sql/index.js'); // Import the SQL database connection
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const { CronJob } = require('cron');
const { setIo } = require('./socketManager'); // Import the socket manager
const dataSeed = require('./utils/seeds/seed.js');

// Set the random seed
Math.seedrandom(122021)

// Initialize the app and create a port
const app = express();
const PORT = process.env.PORT || 3001;

// Set up body parsing, static, and route middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/build')));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",  // Allow socket connections from this origin
    methods: ["GET", "POST"],        // Allow these methods
    allowedHeaders: ["Content-Type"],// You can add more allowed headers if needed
  }
});
setIo(io)
app.use(routes);
// Cron job configurations
const timezone = 'America/Denver';
const cronJobs = [
  {
    cronTime: '0 */5 4-23 * * *', //every 1 minutes 1.2 mb -- removes old games && updates live scores 
    onTick: dataSeed.removeSeed,
    timezone
  },
  {
    cronTime: '0 0 4,8,12,16,20 * * *', // Runs at 8:00 AM, 2:00 PM, and 9:00 PM -- retrieves odds from the-odds-api -- 53 sec TODO: 1,3,6,9,12,14,16,18,22
    onTick: dataSeed.oddsSeed,
    timezone,
  },
  {
    cronTime: '0 30 */4 * * *', //every hour, at the 30min mark, except 12-3 when ML train runs -- gets team stats and saves to db -- 2 min
    onTick: dataSeed.dataSeed,
    timezone
  },
  // {
  //   cronTime: '0 0 0 * * 1-7', //once a day at midnight, not sunday -- train ML model to past games
  //   onTick: dataSeed.mlModelTrainSeed,
  //   timezone
  // },
  // {
  //   cronTime: '0 0 0 * * */7', // Once a week at 12 am -- complete random searches for params and value bets
  //   onTick: dataSeed.paramAndValueSeed,
  //   timezone,
  // },
];

// Create an object to track the running status of each cron job by its cronTime (or a unique ID)
let jobStatuses = {};

cronJobs.forEach(({ cronTime, onTick, timezone }) => {
  const cronJob = new CronJob(cronTime, async () => {
    // Check if the job is already running by checking the jobStatuses object
    if (jobStatuses[cronTime]) {
      console.log(`Job for ${cronTime} is already running, skipping this interval.`);
      return; // Exit early if the job is already running
    }

    try {
      // Set the flag to indicate the job is running for this specific cronTime
      jobStatuses[cronTime] = true;

      // Run the actual job logic
      await onTick(); // This will be your removeSeed function or any other job
    } catch (error) {
      console.error(`Error during cron job for ${cronTime}:`, error);
    } finally {
      // Reset the flag for this specific cronTime to allow it to run again in the future
      jobStatuses[cronTime] = false;
    }
  }, null, true, timezone);

  cronJob.start();
});


server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on PORT: ${PORT}`);
});

module.exports = io;
