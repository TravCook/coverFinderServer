// socketManager.js
let io; // Declare a variable to hold the io instance

// Function to set the io instance
const setIo = (_io) => {
  io = _io; // Assign the io instance passed from the server to this module
};

// Function to emit events to clients
const emitToClients = (event, data) => {
  if (io) {
    io.emit(event, data); // Emit the event to all connected clients
  } else {
    console.error('Socket.io is not initialized yet!');
  }
};

// Export the functions using module.exports
module.exports = {
  setIo,
  emitToClients,
};
