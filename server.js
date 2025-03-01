const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./config/connection');
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const { CronJob } = require('cron');
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('./models');
const { setIo } = require('./socketManager'); // Import the socket manager
const dataSeed = require('./utils/seeds/seed.js');
const { emitToClients } = require('./socketManager')
const moment = require('moment')

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
    cronTime: '0 0 8,14,21 * * *', // Runs at 8:00 AM, 2:00 PM, and 9:00 PM
    onTick: dataSeed.oddsSeed,
    timezone,
  },
  // {
  //   cronTime: '0 5 8,14,21 * * *', // Runs 5 min after the odds cron job
  //   onTick: dataSeed.dataSeed,
  //   timezone,
  // },
  {
    cronTime: '0 0 0 * * *', //once a day at midnight
    onTick: dataSeed.mlModelTrainSeed,
    timezone
  },
  {
    cronTime: '0 */5 * * * *', //every 5 minutes 1.2 mb
    onTick: dataSeed.removeSeed,
    timezone
  },
  // {
  //   cronTime: '0 0 0 0 */3 *', //every quarter
  //   onTick: dataSeed.espnSeed,
  //   timezone
  // }
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

// // Socket.IO connection event
// io.on('connection', async (socket) => {
//   console.log(`a user connected @ ${moment().format('HH:mm:ss')}`);

//   //1.2mb
//   //   const [currentOdds, pastOdds, footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([
//   //     Odds.find({}, {commence_time: 1, 
//   //       home_team: 1, 
//   //       homeTeamIndex: 1, 
//   //       homeScore: 1, 
//   //       away_team: 1, 
//   //       awayTeamIndex: 1, 
//   //       awayScore: 1, 
//   //       winPercent: 1, 
//   //       homeTeamlogo: 1, 
//   //       awayTeamlogo: 1, 
//   //       winner: 1, 
//   //       predictionCorrect: 1, 
//   //       id: 1, 
//   //       sport_key:1, 
//   //       sport_title: 1, 
//   //       sport:1, 
//   //       bookmakers: 1}).sort({ commence_time: 1, winPercent: 1 }), // Sorting in database
//   //     PastGameOdds.find({}, {commence_time: 1, 
//   //       home_team: 1, 
//   //       homeTeamIndex: 1, 
//   //       homeScore: 1, 
//   //       away_team: 1, 
//   //       awayTeamIndex: 1, 
//   //       awayScore: 1, 
//   //       winPercent: 1, 
//   //       homeTeamlogo: 1, 
//   //       awayTeamlogo: 1, 
//   //       winner: 1, 
//   //       predictionCorrect: 1, 
//   //       id: 1, 
//   //       sport_key:1, 
//   //       sport_title: 1, 
//   //       sport:1, 
//   //       bookmakers: 1}).sort({ commence_time: -1, winPercent: 1 }), // Sorting in database
//   //     UsaFootballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
//   //     BasketballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
//   //     BaseballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
//   //     HockeyTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 })
//   //   ]);

//   //   let allTeams = {
//   //       football: footballTeams,
//   //       basketball: basketballTeams,
//   //       baseball: baseballTeams,
//   //       hockey: hockeyTeams
//   //   };


//   //   console.log(`retrieved data @ ${moment().format('HH:mm:ss')}`);
//   //  emitToClients('teamUpdate', allTeams);

//   //  emitToClients('gameUpdate', currentOdds);
//   //  emitToClients('pastGameUpdate', pastOdds);

//   //  const dataSize = Buffer.byteLength(JSON.stringify({allTeams, currentOdds, pastOdds}), 'utf8'); // Get data size in bytes
//   //  console.log(`Data size sent: ${dataSize / 1024} KB`);  // Convert to KB or MB if 
//   console.log(`sent data @ ${moment().format('HH:mm:ss')}`);

//   // Handle disconnect event
//   socket.on('disconnect', () => {
//     console.log('User disconnected');
//   });
// });

// Start the server
db.once('open', () => {
  console.log(`Connected to the database`);
});



server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on PORT: ${PORT}`);
});



module.exports = io;
