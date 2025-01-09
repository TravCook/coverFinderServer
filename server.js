const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const db = require('./config/connection');
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const { CronJob } = require('cron');
const { setIo } = require('./socketManager'); // Import the socket manager
const dataSeed = require('./seeds/seed.js');

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
    cronTime: '0 0 */8 * * *', // every 8 hours
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
  {
    cronTime: '* * * * * */4', //every quarter
    onTick: dataSeed.espnSeed,
    timezone
  }
];

// cronJobs.forEach(({ cronTime, onTick, timezone }) => {
//   const cronJob = new CronJob(cronTime, onTick, null, true, timezone);
//   cronJob.start();
// });

// Socket.IO connection event
io.on('connection', (socket) => {
  console.log('a user connected');
  
  // Optionally handle events from the client
  socket.on('message', (data) => {
    console.log('Message from client:', data);
  });

  // Broadcast message to all clients
  socket.emit('welcome', { message: 'Welcome to the server!' });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
db.once('open', () => {
  console.log(`Connected to the database`);
  dataSeed.espnSeed()
});



server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on PORT: ${PORT}`);
});



module.exports = io ;
