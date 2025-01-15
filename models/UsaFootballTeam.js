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
        USFBcompletionPercent: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBcompletions: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBcompletionsPerGame: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBnetPassingYards: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBnetPassingYardsPerGame: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingFirstDowns: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingTouchdowns: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingYards: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingYardsPerGame: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingAttempts: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBpassingAttemptsPerGame: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFByardsPerPassAttempt: {
            type: Number,
            required: false,
            category: 'passing'
        },
        USFBrushingAttempts: {
            type: Number,
            required: false,
            category: 'rushing'
        },
        USFBrushingFirstDowns: {
            type: Number,
            required: false,
            category: 'rushing'
        },
        USFBrushingTouchdowns: {
            type: Number,
            required: false,
            category: 'rushing'
        },
        USFBrushingYards: {
            type: Number,
            required: false,
            category: 'rushing'
        },
        USFBrushingYardsPerGame: {
            type: Number,
            required: false,
            category: 'rushing'
        },
        USFByardsPerRushAttempt: {
            type: Number,
            required: false,
            category: 'rushing'
        },

        USFBreceivingFirstDowns: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingTouchdowns: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingYards: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingYardsPerGame: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingYardsPerReception: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingYardsAfterCatch: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBreceivingYardsAfterCatchPerGame: {
            type: Number,
            required: false,
            category: 'receiving'
        },
        USFBtotalTouchdowns: {
            type: Number,
            required: false,
            category: 'scoring'
        },
        USFBtouchdownsPerGame: {
            type: Number,
            required: false,
            category: 'scoring'
        },
        USFBtotalPoints: {
            type: Number,
            required: false,
            category: 'scoring'
        },
        USFBpointsPerGame: {
            type: Number,
            required: false,
            category: 'scoring'
        },
        USFBtacklesforLoss: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBtacklesforLossPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBinterceptions: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFByardsPerInterception: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBsacksTotal: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBsacksPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBsackYards: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBsackYardsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBstuffs: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBstuffsPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBstuffYards: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBpassesDefended: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBpassesDefendedPerGame: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBsafties: {
            type: Number,
            required: false,
            category: 'defensive'
        },
        USFBaverageKickoffYards: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBaverageKickoffYardsPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointAttempts: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointAttemptsPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointsMade: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointsMadePerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointPercent: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBextraPointPercentPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalAttempts: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalAttemptsPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalsMade: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalsMadePerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalPct: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBfieldGoalPercentPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBtouchbacks: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBtouchbacksPerGame: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBtouchBackPercentage: {
            type: Number,
            required: false,
            category: 'kicking'
        },
        USFBkickReturns: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBkickReturnsPerGame: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBkickReturnYards: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBkickReturnYardsPerGame: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBpuntReturns: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBpuntReturnsPerGame: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBpuntReturnFairCatchPct: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBpuntReturnYards: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBpuntReturnYardsPerGame: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFByardsPerReturn: {
            type: Number,
            required: false,
            category: 'returning'
        },
        USFBthirdDownEfficiency: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
        USFBtotalPenyards: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
        USFBaveragePenYardsPerGame: {
            type: Number,
            required: false,
            category: 'miscellaneous',
        },
        USFBgiveaways: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
        USFBtakeaways: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
        USFBturnoverDiff: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
        USFBtotalFirstDowns: {
            type: Number,
            required: false,
            category: 'miscellaneous'
        },
    }
})

const UsaFootballTeam = mongoose.model('UsaFootballTeam', UsaFootballTeamSchema)

module.exports = UsaFootballTeam