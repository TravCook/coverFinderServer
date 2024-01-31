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
    ]
})

const Odds = mongoose.model('Odds', oddsSchema)

module.exports = Odds