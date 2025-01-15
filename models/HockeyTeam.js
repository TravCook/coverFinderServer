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
        HKYgoals: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYgoalsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYassists: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYassistsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn1st: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn1stPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn2nd: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn2ndPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn3rd: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsIn3rdPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYtotalShots: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYtotalShotsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsMissed: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshotsMissedPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYppgGoals: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYppgGoalsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYppassists: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYppassistsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYpowerplayPct: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshortHandedGoals: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshortHandedGoalsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYshootingPct: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffs: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffsPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffsWon: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffsWonPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffsLost: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffsLostPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffPct: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYfaceoffPctPerGame: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYgiveaways: {
            type: Number,
            required: false,
            category: 'offensive'
        },
        HKYgoalsAgainst: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYgoalsAgainstPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYshotsAgainst: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYshotsAgainstPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYpenaltyKillPct: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYpenaltyKillPctPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYppGoalsAgainst: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYppGoalsAgainstPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYshutouts: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYsaves: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYsavesPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYsavePct: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYblockedShots: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYblockedShotsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYhits: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYhitsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYtakeaways: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYtakeawaysPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        HKYshotDifferential: {
            type: Number,
            required: false,
            category: 'general'
        },
        HKYshotDifferentialPerGame: {
            type: Number,
            required: false,
            category: 'general'
        },
        HKYgoalDifferentialPerGame: {
            type: Number,
            required: false,
            category: 'general'
        },
        HKYpimDifferential: {
            type: Number,
            required: false,
            category: 'general'
        },
        HKYpimDifferentialPerGame: {
            type: Number,
            required: false,
            category: 'general'
        },
        HKYtotalPenalties: {
            type: Number,
            required: false,
            category: 'penalties'
        },
        HKYpenaltiesPerGame: {
            type: Number,
            required: false,
            category: 'penalties'
        },
        HKYpenaltyMinutes: {
            type: Number,
            required: false,
            category: 'penalties'
        },
        HKYpenaltyMinutesPerGame: {
            type: Number,
            required: false,
            category: 'penalties'
        }
    }
    
})

const HockeyTeam = mongoose.model('HockeyTeam', HockeyTeamSchema)

module.exports = HockeyTeam