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
                            },
                            impliedProb: {
                                type: Number,
                                required: false
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
    winPercent: {
        type: Number,
        required: false
    },
    predictionCorrect: {
        type: Boolean,
        required: true
    },
    homeTeamStats: {
        type: Schema.Types.Mixed,
        required: false
    },
    awayTeamStats: {
        type: Schema.Types.Mixed,
        required: false
    },
    homeTeamlogo: {
        type: String,
        required: false,
    },
    awayTeamlogo: {
        type: String,
        required: false,
    },
})

const pastGameOdds = mongoose.model('pastGameOdds', pastGameOddsSchema)

module.exports = pastGameOdds