const mongoose = require('mongoose')

const { Schema } = mongoose

const UsaFootballTeamSchema = new Schema({
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
        pointsPerGame: {
            type: Number,
            required: true
        },
        totalPoints: {
            type: Number,
            required: true
        },
        totalFirstDowns: {
            type: Number,
            required: true
        },
        rushingFirstDowns: {
            type: Number,
            required: true
        },
        passingFirstDowns: {
            type: Number,
            required: true
        },
        thirdDownEfficiency: {
            type: Number,
            required: true
        },
        netPassingYardsPerGame: {
            type: Number,
            required: true
        },
        interceptions: {
            type: Number,
            required: true
        },
        completionPercent: {
            type: Number,
            required: true
        },
        rushingYards: {
            type: Number,
            required: true
        },
        rushingYardsPerGame: {
            type: Number,
            required: true
        },
        yardsPerRushAttempt: {
            type: Number,
            required: true
        },
        yardsPerGame: {
            type: Number,
            required: true
        },
        fGgoodPct: {
            type: Number,
            required: true
        },
        touchBackPercentage: {
            type: Number,
            required: true
        },
        totalPenyards: {
            type: Number,
            required: true
        }, 
        averagePenYardsPerGame: {
            type: Number,
            required: true,
        }, 
        giveaways: {
            type: Number,
            required: true
        },
        takeaways: {
            type: Number,
            required: true
        },
        turnoverDiff: {
            type: Number,
            required: true
        },
        sacksTotal: {
            type: Number,
            required: true
        }, 
        sacksPerGame: {
            type: Number,
            required: true,
        }, 
        yardsLostPerSack: {
            type: Number,
            required: true
        }, 
        passesDefended: {
            type: Number,
            required: true
        },
        passesDefendedPerGame: {
            type: Number,
            required: true,
        },
        tacklesforLoss: {
            type: Number,
            required: true
        },
        tacklesforLossPerGame: {
            type: Number,
            required: true,
        }
    }
})

const UsaFootballTeam = mongoose.model('UsaFootballTeam', UsaFootballTeamSchema)

module.exports = UsaFootballTeam