const mongoose = require('mongoose')

const { Schema } = mongoose

const BaseballTeamSchema = new Schema({
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
        strikeoutsTotal: {
            type: Number,
            required: false
        },
        rBIsTotal: {
            type: Number,
            required: false
        },
        hitsTotal: {
            type: Number,
            required: false
        },
        stolenBasesTotal: {
            type: Number,
            required: false
        },
        walksTotal: {
            type: Number,
            required: false
        },
        runsTotal: {
            type: Number,
            required: false
        },
        homeRunsTotal: {
            type: Number,
            required: false
        },
        totalBases: {
            type: Number,
            required: false
        },
        extraBaseHitsTotal: {
            type: Number,
            required: false
        },
        battingAverageTotal: {
            type: Number,
            required: false
        },
        sluggingPercentage: {
            type: Number,
            required: false
        },
        onBasePercent: {
            type: Number,
            required: false
        },
        onBasePlusSlugging: {
            type: Number,
            required: false
        },
        stolenBasePct: {
            type: Number,
            required: false
        },
        walkToStrikeoutRatio: {
            type: Number,
            required: false
        },
        saves: {
            type: Number,
            required: false
        },
        strikeoutsPitchingTotal: {
            type: Number,
            required: false
        },
        walksPitchingTotal: {
            type: Number,
            required: false
        },
        qualityStarts: {
            type: Number,
            required: false
        },
        earnedRunAverage: {
            type: Number,
            required: false
        },
        walksHitsPerInningPitched: {
            type: Number,
            required: false
        },
        groundToFlyRatio: {
            type: Number,
            required: false
        },
        runSupportAverage: {
            type: Number,
            required: false
        },
        oppBattingAverage: {
            type: Number,
            required: false
        },
        oppSlugging: {
            type: Number,
            required: false
        },
        oppOPS: {
            type: Number,
            required: false
        },
        savePct: {
            type: Number,
            required: false
        },
        strikeoutPerNine: {
            type: Number,
            required: false
        },
        strikeoutToWalkRatioPitcher: {
            type: Number,
            required: false
        },
        doublePlays: {
            type: Number,
            required: false
        },
        fieldingErrors: {
            type: Number,
            required: false
        },
        fieldingPercentage: {
            type: Number,
            required: false
        },
    }
    
})

const BaseballTeam = mongoose.model('BaseballTeam', BaseballTeamSchema)

module.exports = BaseballTeam