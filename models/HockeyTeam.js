const mongoose = require('mongoose')

const { Schema } = mongoose

const HockeyTeamSchema = new Schema({
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
        goals: {
            type: Number,
            required: true
        },
        goalsPerGame: {
            type: Number,
            required: true
        },
        assists: {
            type: Number,
            required: true
        },
        assistsPerGame: {
            type: Number,
            required: true
        },
        totalShotsTaken: {
            type: Number,
            required: true
        },
        shotsTakenPerGame: {
            type: Number,
            required: true
        },
        powerPlayGoals: {
            type: Number,
            required: true
        },
        powerPlayGoalsPerGame: {
            type: Number,
            required: true
        },
        powerPlayPct: {
            type: Number,
            required: true
        },
        shootingPct: {
            type: Number,
            required: true
        },
        faceoffsWon: {
            type: Number,
            required: true
        },
        faceoffsWonPerGame: {
            type: Number,
            required: true
        },
        faceoffPercent: {
            type: Number,
            required: true
        },
        giveaways: {
            type: Number,
            required: true
        },
        penaltyMinutes: {
            type: Number,
            required: true
        },
        penaltyMinutesPerGame: {
            type: Number,
            required: true
        },
        goalsAgainst: {
            type: Number,
            required: true
        },
        goalsAgainstAverage: {
            type: Number,
            required: true
        },
        shotsAgainst: {
            type: Number,
            required: true
        },
        shotsAgainstPerGame: {
            type: Number,
            required: true
        },
        shotsBlocked: {
            type: Number,
            required: true
        },
        shotsBlockedPerGame: {
            type: Number,
            required: true
        },
        penaltyKillPct: {
            type: Number,
            required: true
        },
        totalSaves: {
            type: Number,
            required: true
        },
        savePerGame: {
            type: Number,
            required: true
        },
        savePct: {
            type: Number,
            required: true
        },
        takeaways: {
            type: Number,
            required: true
        }
    }
    
})

const HockeyTeam = mongoose.model('HockeyTeam', HockeyTeamSchema)

module.exports = HockeyTeam