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
const dataSeed = require('./seeds/seed.js');
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
    cronTime: '0 0 */8 * * *', // every 12 hours
    onTick: dataSeed.oddsSeed,
    timezone,
  },
  {
    cronTime: '0 */15 * * * *', // every 15 minutes
    onTick: dataSeed.dataSeed,
    timezone,
  },
  {
    cronTime: '*/30 * * * * *', //every 30 seconds
    onTick: dataSeed.removeSeed,
    timezone
  },
  // {
  //   cronTime: '* * * * */3 *', //every quarter
  //   onTick: dataSeed.espnSeed,
  //   timezone
  // }
];

cronJobs.forEach(({ cronTime, onTick, timezone }) => {
  const cronJob = new CronJob(cronTime, onTick, null, true, timezone);
  cronJob.start();
});

// Socket.IO connection event
io.on('connection', async (socket) => {
  console.log(`a user connected @ ${moment().format('HH:mm:ss')}`);

    const [currentOdds, pastOdds, footballTeams, basketballTeams, baseballTeams, hockeyTeams] = await Promise.all([
      Odds.find({}, {commence_time: 1, 
        home_team: 1, 
        homeTeamIndex: 1, 
        homeScore: 1, 
        away_team: 1, 
        awayTeamIndex: 1, 
        awayScore: 1, 
        winPercent: 1, 
        homeTeamlogo: 1, 
        awayTeamlogo: 1, 
        winner: 1, 
        predictionCorrect: 1, 
        id: 1, 
        sport_key:1, 
        sport_title: 1, 
        sport:1, 
        bookmakers: 1}).sort({ commence_time: 1, winPercent: 1 }), // Sorting in database
      PastGameOdds.find({}, {commence_time: 1, 
        home_team: 1, 
        homeTeamIndex: 1, 
        homeScore: 1, 
        away_team: 1, 
        awayTeamIndex: 1, 
        awayScore: 1, 
        winPercent: 1, 
        homeTeamlogo: 1, 
        awayTeamlogo: 1, 
        winner: 1, 
        predictionCorrect: 1, 
        id: 1, 
        sport_key:1, 
        sport_title: 1, 
        sport:1, 
        bookmakers: 1}).sort({ commence_time: -1, winPercent: 1 }), // Sorting in database
      UsaFootballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
      BasketballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
      BaseballTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 }),
      HockeyTeam.find({},  {  teamName: 1, logo: 1, espnDisplayName: 1, espnID: 1, league: 1, abbreviation: 1 })
    ]);

    let allTeams = {
        football: footballTeams,
        basketball: basketballTeams,
        baseball: baseballTeams,
        hockey: hockeyTeams
    };
    console.log(`retrieved data @ ${moment().format('HH:mm:ss')}`);
   emitToClients('teamUpdate', allTeams);

   emitToClients('gameUpdate', currentOdds);
   emitToClients('pastGameUpdate', pastOdds);
  console.log(`sent data @ ${moment().format('HH:mm:ss')}`);
  
  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
db.once('open', () => {
  console.log(`Connected to the database`);
});



server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on PORT: ${PORT}`);
});



module.exports = io ;
