const mongoose = require('mongoose')

const { Schema } = mongoose

const BasketballTeamSchema = new Schema({
    teamName: {
        type: String,
        required: true,
    },
    logo: {
        type: String,
        required: true,
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
        required: true,
    },
    homeWinLoss: {
        type: String,
        required: true,
    },
    awayWinLoss: {
        type: String,
        required: true,
    },
    pointDiff: {
        type: Number,
        required: true
    },
    stats: {
        ReboundsTotal: {
            type: Number,
            required: true
        },
        PointsTotal: {
            type: Number,
            required: true
        },
        pointsPergame: {
            type: Number,
            required: true
        },
        blocksTotal: {
            type: Number,
            required: true
        },
        blocksPerGame: {
            type: Number,
            required: true
        },
        defensiveRebounds: {
            type: Number,
            required: true
        },
        defensiveReboundsperGame: {
            type: Number,
            required: true
        },
        offensiveRebounds: {
            type: Number,
            required: true
        },
        offensiveReboundsperGame: {
            type: Number,
            required: true
        },
        steals: {
            type: Number,
            required: true
        },
        stealsperGame: {
            type: Number,
            required: true
        },
        effectiveFieldGoalPct: {
            type: Number,
            required: true
        },
        fieldGoalMakesperAttempts: {
            type: Number,
            required: true,
            displayValue: true
        },
        freeThrowsMadeperAttemps: {
            type: Number,
            required: true,
            displayValue: true
        },
        freeThrowPct: {
            type: Number,
            required: true
        },
        totalTurnovers: {
            type: Number,
            required: true
        },
        averageTurnovers: {
            type: Number,
            required: true
        },
        threePointPct: {
            type: Number,
            required: true
        },
        trueShootingPct: {
            type: Number,
            required: true
        },
        turnoverRatio: {
            type: Number,
            required: true
        },
        assisttoTurnoverRatio: {
            type: Number,
            required: true
        },
        pointsinPaint: {
            type: Number,
            required: true
        },
        pace: {
            type: Number,
            required: true
        }
    }
    
    
})

const BasketballTeam = mongoose.model('BasketballTeam', BasketballTeamSchema)

module.exports = BasketballTeam