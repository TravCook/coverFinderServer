const mongoose = require('mongoose')

const { Schema } = mongoose;

const oddsSchema = new Schema({
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
        type: Date,
        required: true
    },
    home_team: {
        type: String,
        required: true,
    },
    homeTeamShort: {
        type: String,
        required: false,
    },
    away_team: {
        type: String,
        required: true,
    },
    awayTeamShort: {
        type: String,
        required: false,
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
    homeTeamScaledIndex: {
        type: Number,
        required: false
    },
    awayTeamScaledIndex: {
        type: Number,
        required: false
    },
    winPercent: {
        type: Number,
        required: false
    },
    predictedWinner: {
        type: String,
        required: false
    },
    predictionStrength: {
        type: Number,
        required: false
    },
    homeScore: {
        type: Number,
        required: false
    },
    awayScore: {
        type: Number,
        required: false
    },
    timeRemaining: {
        type: String,
        required: false
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
    awayTeamAbbr: {
        type: String,
        required: false
    },
    homeTeamAbbr: {
        type: String,
        required: false
    },
})

const Odds = mongoose.model('Odds', oddsSchema)

module.exports = Odds