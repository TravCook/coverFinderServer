const mongoose = require('mongoose')

const { Schema } = mongoose

const BaseballTeamSchema = new Schema({
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
        strikeoutsTotal: {
            type: Number,
            required: true
        },
        rBIsTotal: {
            type: Number,
            required: true
        },
        hitsTotal: {
            type: Number,
            required: true
        },
        stolenBasesTotal: {
            type: Number,
            required: true
        },
        walksTotal: {
            type: Number,
            required: true
        },
        runsTotal: {
            type: Number,
            required: true
        },
        homeRunsTotal: {
            type: Number,
            required: true
        },
        totalBases: {
            type: Number,
            required: true
        },
        extraBaseHitsTotal: {
            type: Number,
            required: true
        },
        battingAverageTotal: {
            type: Number,
            required: true
        },
        sluggingPercentage: {
            type: Number,
            required: true
        },
        onBasePercent: {
            type: Number,
            required: true
        },
        onBasePlusSlugging: {
            type: Number,
            required: true
        },
        stolenBasePct: {
            type: Number,
            required: true
        },
        walkToStrikeoutRatio: {
            type: Number,
            required: true
        },
        saves: {
            type: Number,
            required: true
        },
        strikeoutsPitchingTotal: {
            type: Number,
            required: true
        },
        walksPitchingTotal: {
            type: Number,
            required: true
        },
        qualityStarts: {
            type: Number,
            required: true
        },
        earnedRunAverage: {
            type: Number,
            required: true
        },
        walksHitsPerInningPitched: {
            type: Number,
            required: true
        },
        groundToFlyRatio: {
            type: Number,
            required: true
        },
        runSupportAverage: {
            type: Number,
            required: true
        },
        oppBattingAverage: {
            type: Number,
            required: true
        },
        oppSlugging: {
            type: Number,
            required: true
        },
        oppOPS: {
            type: Number,
            required: true
        },
        savePct: {
            type: Number,
            required: true
        },
        strikeoutPerNine: {
            type: Number,
            required: true
        },
        strikeoutToWalkRatioPitcher: {
            type: Number,
            required: true
        },
        doublePlays: {
            type: Number,
            required: true
        },
        fieldingErrors: {
            type: Number,
            required: true
        },
        fieldingPercentage: {
            type: Number,
            required: true
        },
    }
    
})

const BaseballTeam = mongoose.model('BaseballTeam', BaseballTeamSchema)

module.exports = BaseballTeam