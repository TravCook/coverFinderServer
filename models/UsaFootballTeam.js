const mongoose = require('mongoose')

const { Schema } = mongoose

const UsaFootballTeamSchema = new Schema({
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
        pointsPerGame: {
            type: Number,
            required: false
        },
        totalPoints: {
            type: Number,
            required: false
        },
        totalFirstDowns: {
            type: Number,
            required: false
        },
        rushingFirstDowns: {
            type: Number,
            required: false
        },
        passingFirstDowns: {
            type: Number,
            required: false
        },
        thirdDownEfficiency: {
            type: Number,
            required: false
        },
        netPassingYardsPerGame: {
            type: Number,
            required: false
        },
        interceptions: {
            type: Number,
            required: false
        },
        completionPercent: {
            type: Number,
            required: false
        },
        rushingYards: {
            type: Number,
            required: false
        },
        rushingYardsPerGame: {
            type: Number,
            required: false
        },
        yardsPerRushAttempt: {
            type: Number,
            required: false
        },
        yardsPerGame: {
            type: Number,
            required: false
        },
        fGgoodPct: {
            type: Number,
            required: false
        },
        touchBackPercentage: {
            type: Number,
            required: false
        },
        totalPenyards: {
            type: Number,
            required: false
        }, 
        averagePenYardsPerGame: {
            type: Number,
            required: false,
        }, 
        giveaways: {
            type: Number,
            required: false
        },
        takeaways: {
            type: Number,
            required: false
        },
        turnoverDiff: {
            type: Number,
            required: false
        },
        sacksTotal: {
            type: Number,
            required: false
        }, 
        sacksPerGame: {
            type: Number,
            required: false,
        }, 
        yardsLostPerSack: {
            type: Number,
            required: false
        }, 
        passesDefended: {
            type: Number,
            required: false
        },
        passesDefendedPerGame: {
            type: Number,
            required: false,
        },
        tacklesforLoss: {
            type: Number,
            required: false
        },
        tacklesforLossPerGame: {
            type: Number,
            required: false,
        }
    }
})

const UsaFootballTeam = mongoose.model('UsaFootballTeam', UsaFootballTeamSchema)

module.exports = UsaFootballTeam