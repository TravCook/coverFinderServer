const mongoose = require('mongoose')

const {Schema} = mongoose

const teamStatsSchema = new Schema ({
    teamName: {
        type: String,
        required: true,
    },
    logo: {
        type: String,
        required: true,
    },
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
    winLossAsDog: {
        type: String,
        required: false,
    },
    winLossAsFav: {
        type: String,
        required: false,
    },
    winPAsDog: {
        type: String,
        required: false,
    },
    winPAsFav: {
        type: String,
        required: false,
    },
    thirdDownConvRate: {
        type: String,
        required: false,
    }, //USAFootball stat
    yardsPerPlay: {
        type: String,
        required: false,
    }, //USAFootball stat
    turnoverDiff: {
        type: String,
        required: false,
    }, //USAFootball stat
    takeawaysPerGame: {
        type: String,
        required: false,
    }, //USAFootball stat
    giveawaysPerGame: {
        type: String,
        required: false,
    }, //USAFootball stat
    yardsAllowedPerGame: {
        type: String,
        required: false,
    }, //USAFootball stat
    penaltyYardsPerGame: {
        type: String,
        required: false,
    }, //USAFootball stat
    avgTimeofPossession: {
        type: String,
        required: false,
    }, //USAFootball stat
    xGoals: {
        type: String,
        required: false,
    },        // hockey stat
    goalDiff: {
        type: String,
        required: false,
    },        // hockey stat
    xGoalsAgainst: {
        type: String,
        required: false,
    },        // hockey stat
    savePct: {
        type: String,
        required: false,
    },        // hockey stat
    shotsTaken: {
        type: String,
        required: false,
    },        // hockey stat
    shotsAgainst: {
        type: String,
        required: false,
    },       // hockey stat
    penaltiesInMinutes: {
        type: String,
        required: false,
    },        // hockey stat
    shotsBlocked: {
        type: String,
        required: false,
    },       // hockey stat
    faceoffsWon: {
        type: String,
        required: false,
    },        // hockey stat
    giveaways: {
        type: String,
        required: false,
    },        // hockey stat
    takeaways: {
        type: String,
        required: false,
    },      // hockey stat
    hits: {
        type: String,
        required: false,
    },      // baseball Stat
    walks: {
        type: String,
        required: false,
    },      // baseball Stat
    strikeouts: {
        type: String,
        required: false,
    },      // baseball Stat
    runsBattedIn: {
        type: String,
        required: false,
    },      // baseball Stat
    homeRuns: {
        type: String,
        required: false,
    },      // baseball Stat
    runsVsEra: {
        type: String,
        required: false,
    },      // baseball Stat
    strikeouts: {
        type: String,
        required: false,
    },      // baseball Stat
    saves: {
        type: String,
        required: false,
    },      // baseball Stat
    groundballs: {
        type: String,
        required: false,
    },      // baseball Stat
    fieldingErrors: {
        type: String,
        required: false,
    },      // baseball Stat
    fieldingPercentage: {
        type: String,
        required: false,
    },      // baseball Stat
    pace: {
        type: String,
        required: false,
    },      // basketball Stat
    freeThrowPct: {
        type: String,
        required: false,
    },      // basketball Stat
    effectiveFieldGoalPct: {
        type: String,
        required: false,
    },      // basketball Stat
    reboundRate: {
        type: String,
        required: false,
    },      // basketball Stat
    fieldGoalsAttempted: {
        type: String,
        required: false,
    },      // basketball Stat
    stealsPerGame: {
        type: String,
        required: false,
    },      // basketball Stat
    blocksPerGame: {
        type: String,
        required: false,
    },      // basketball Stat
    assistTurnoverRatio: {
        type: String,
        required: false,
    },      // basketball Stat 
    h2hIndex: {
        type: Number,
        required: true
    },
    h2hIndexUpdatedAt: {
        type: String,
        required: false
    }
})

const TeamStats = mongoose.model('TeamStats', teamStatsSchema)

module.exports = TeamStats