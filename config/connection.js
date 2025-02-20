const mongoose = require('mongoose');

if(process.env.PRODUCTION === 'true'){
  mongoose.connect( 
     process.env.MONGODB_URI || 
    'mongodb://127.0.0.1:27017/coverFinder'
    );
}else{
  mongoose.connect( 
    //  process.env.MONGODB_URI || 
    'mongodb://127.0.0.1:27017/coverFinder'
    );
}


module.exports = mongoose.connection;