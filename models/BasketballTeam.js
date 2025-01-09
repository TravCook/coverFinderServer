const mongoose = require('mongoose')

const { Schema } = mongoose

const BasketballTeamSchema = new Schema({
    teamName: {
        type: String,
        required: true,
    },
    logo: {
        type: String,
        required: false,
    },
    school: {
        type: String,
        required: false
    }, //college sports only
    league: {
        type: String,
        required: true,
    },
    espnID: {
        type: String,
        required: true,
    },
    abbreviation: {
        type: String,
        required: true
    },
    espnDisplayName: {
        type: String,
        required: true,
    },
    seasonWinLoss: {
        type: String,
        required: false,
    },
    homeWinLoss: {
        type: String,
        required: false,
    },
    awayWinLoss: {
        type: String,
        required: false,
    },
    pointDiff: {
        type: Number,
        required: false
    },
    stats: {
        ReboundsTotal: {
            type: Number,
            required: false
        },
        PointsTotal: {
            type: Number,
            required: false
        },
        pointsPergame: {
            type: Number,
            required: false
        },
        blocksTotal: {
            type: Number,
            required: false
        },
        blocksPerGame: {
            type: Number,
            required: false
        },
        defensiveRebounds: {
            type: Number,
            required: false
        },
        defensiveReboundsperGame: {
            type: Number,
            required: false
        },
        offensiveRebounds: {
            type: Number,
            required: false
        },
        offensiveReboundsperGame: {
            type: Number,
            required: false
        },
        steals: {
            type: Number,
            required: false
        },
        stealsperGame: {
            type: Number,
            required: false
        },
        effectiveFieldGoalPct: {
            type: Number,
            required: false
        },
        fieldGoalMakesperAttempts: {
            type: Number,
            required: false,
            displayValue: false
        },
        freeThrowsMadeperAttemps: {
            type: Number,
            required: false,
            displayValue: false
        },
        freeThrowPct: {
            type: Number,
            required: false
        },
        totalTurnovers: {
            type: Number,
            required: false
        },
        averageTurnovers: {
            type: Number,
            required: false
        },
        threePointPct: {
            type: Number,
            required: false
        },
        falseShootingPct: {
            type: Number,
            required: false
        },
        turnoverRatio: {
            type: Number,
            required: false
        },
        assisttoTurnoverRatio: {
            type: Number,
            required: false
        },
        pointsinPaint: {
            type: Number,
            required: false
        },
        pace: {
            type: Number,
            required: false
        }
    }
    
    
})

const BasketballTeam = mongoose.model('BasketballTeam', BasketballTeamSchema)

module.exports = BasketballTeam