const mongoose = require('mongoose')
const moment = require('moment')

const { Schema } = mongoose;

const winRateSchema = new Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    }, // date
    overallWinRate: {
        type: Number,
        required: true
    }, // overallwinrate
    winrateByLeague: [{
        league: String,
        winRate: Number,
    }], // winrate by each league
    winrateByTeam: [{
        team: String,
        winRate: Number,
    }], //winrate by team
    highIndexWinRate: {
        type: Number,
        required: true
    },// winrate of index over 5
    lowIndexWinRate: {
        type: Number,
        required: true
    },// winrate of index under -5
    // todaysWinrate: {
    //     type: Number,
    //     required: true
    // }// winrate by date
})  

const WinRate = mongoose.model('WinRate', winRateSchema)

module.exports = WinRate