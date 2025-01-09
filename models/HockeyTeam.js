const mongoose = require('mongoose')

const { Schema } = mongoose

const HockeyTeamSchema = new Schema({
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
        goals: {
            type: Number,
            required: false
        },
        goalsPerGame: {
            type: Number,
            required: false
        },
        assists: {
            type: Number,
            required: false
        },
        assistsPerGame: {
            type: Number,
            required: false
        },
        totalShotsTaken: {
            type: Number,
            required: false
        },
        shotsTakenPerGame: {
            type: Number,
            required: false
        },
        powerPlayGoals: {
            type: Number,
            required: false
        },
        powerPlayGoalsPerGame: {
            type: Number,
            required: false
        },
        powerPlayPct: {
            type: Number,
            required: false
        },
        shootingPct: {
            type: Number,
            required: false
        },
        faceoffsWon: {
            type: Number,
            required: false
        },
        faceoffsWonPerGame: {
            type: Number,
            required: false
        },
        faceoffPercent: {
            type: Number,
            required: false
        },
        giveaways: {
            type: Number,
            required: false
        },
        penaltyMinutes: {
            type: Number,
            required: false
        },
        penaltyMinutesPerGame: {
            type: Number,
            required: false
        },
        goalsAgainst: {
            type: Number,
            required: false
        },
        goalsAgainstAverage: {
            type: Number,
            required: false
        },
        shotsAgainst: {
            type: Number,
            required: false
        },
        shotsAgainstPerGame: {
            type: Number,
            required: false
        },
        shotsBlocked: {
            type: Number,
            required: false
        },
        shotsBlockedPerGame: {
            type: Number,
            required: false
        },
        penaltyKillPct: {
            type: Number,
            required: false
        },
        totalSaves: {
            type: Number,
            required: false
        },
        savePerGame: {
            type: Number,
            required: false
        },
        savePct: {
            type: Number,
            required: false
        },
        takeaways: {
            type: Number,
            required: false
        }
    }
    
})

const HockeyTeam = mongoose.model('HockeyTeam', HockeyTeamSchema)

module.exports = HockeyTeam