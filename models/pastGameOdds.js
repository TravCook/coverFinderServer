const mongoose = require('mongoose')

const { Schema } = mongoose;

const pastGameOddsSchema = new Schema({
    id: {
        type: String,
        required: true,
        trim: true
    },
    sport_key: {
        type: String,
        required: true,
    },
    sport_key: {
        type: String,
        required: true
    },
    sport_title: {
        type: String,
        required: true
    },
    commence_time: {
        type: String,
        required: true
    },
    home_team: {
        type: String,
        required: true,
    },
    away_team: {
        type: String,
        required: true,
    },
    sport: {
        type: String,
        required: true
    },
    bookmakers: [
        {
            key: {
                type: String,
                required: true,
            },
            title: {
                type: String,
                required: true,
            },
            last_update: {
                type: Date,
                required: true,
            },
            markets: [
                {
                    key: {
                        type: String,
                        required: true,
                    },
                    outcomes: [
                        {
                            name: {
                                type: String,
                                required: true,
                            },
                            price: {
                                type: Number,
                                required: true,
                            }
                        }
                    ]
                }
            ]
        },
    ],
    homeTeamIndex: {
        type: Number,
        required: false
    },
    awayTeamIndex: {
        type: Number,
        required: false
    },
    winner: {
        type: String,
        required: true
    },
    homeScore: {
        type: Number,
        required: true
    },
    awayScore: {
        type: Number,
        required: true
    },
    predictionCorrect: {
        type: Boolean,
        required: true
    }
})

const pastGameOdds = mongoose.model('pastGameOdds', pastGameOddsSchema)

module.exports = pastGameOdds